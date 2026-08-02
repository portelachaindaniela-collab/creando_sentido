#!/usr/bin/env node
'use strict';

/**
 * Auditoria automatica de ORIGEN -- reglas fijas, sin subagente de Claude
 * ni autenticacion de Anthropic. Mismo espiritu que scheduler/rules_engine.js
 * de ligaf-scraper (PDG): reglas booleanas, deterministicas, sin juicio.
 *
 * Que hace, en cada corrida:
 *   1. Levanta un servidor estatico local sobre la raiz del repo (CS/),
 *      porque el propio codigo de ORIGEN advierte que localStorage puede
 *      no persistir bien bajo file:// (ver comentario en assets/js/historia.js) --
 *      con un origen http:// real, localStorage funciona igual que en produccion.
 *   2. Descubre las materias reales leyendo origen/index.html (las tarjetas
 *      .mod-card), y para cada una lee su TOPICS real desde el JS de la
 *      pagina -- nunca hardcodea "historia"/"fisicoquimica", asi que si se
 *      agrega una tercera materia el script la toma sola.
 *   3. Entra como alumno real (mismo flujo de alias que un alumno), recorre
 *      cada guia en desktop (1280x800) y mobile (375x812), y corre las
 *      reglas fijas A-F descriptas por Daniela (28 reglas, ver REGLA_IDS).
 *   4. Lee el progreso real via getMateriaProgress() de storage.js, lo
 *      compara contra la ultima corrida (leida de Sheets, no de
 *      localStorage -- localStorage no persiste entre corridas de CI).
 *   5. Loguea la corrida completa a Google Sheets (webhook de Apps Script,
 *      variable de entorno ORIGEN_AUDIT_WEBHOOK_URL) y escribe un resumen
 *      en Markdown listo para el paso de email del workflow.
 *
 * Simplificaciones deliberadas respecto del viejo agente (auditor-origen.md),
 * documentadas para que quede claro que no es un descuido:
 *   - "Elementos sin funcion" (reglas 9 y 27): el viejo agente proponia una
 *     sesion CDP (DOMDebugger.getEventListeners) para detectar listeners
 *     reales ademas de onclick inline. En este codebase, revisado a mano,
 *     TODO elemento interactivo real usa onclick inline, salvo un puñado
 *     de casos ya conocidos que se enganchan por JS (ver SELECTORES_JS_WIRED
 *     mas abajo) -- se los excluye explicitamente en vez de introspeccionar
 *     via CDP, que es fragil y depende de APIs internas no publicas de
 *     Playwright. Si algun dia una materia nueva agrega un boton wireado
 *     solo por addEventListener, hay que sumarlo a esa lista a mano.
 *   - Overlaps fixed/contenido: se mide en el scroll inicial (y para el
 *     boton de Pedro, tambien en el estado colapsado tras togglear scroll),
 *     no en "todas las posiciones de scroll" de cada pagina -- eso es lo
 *     que pidieron las reglas 15 y 28 puntualmente.
 *
 * Uso:
 *   node scripts/audit-origen.js
 *   AUDIT_OUTPUT_DIR=/tmp/audit-output node scripts/audit-origen.js
 *
 * Variables de entorno:
 *   AUDIT_OUTPUT_DIR         -- default: <repo>/audit-output
 *   AUDIT_PORT               -- default: 4173
 *   ORIGEN_AUDIT_WEBHOOK_URL -- URL del Apps Script (ver scripts/apps-script-audit.gs.js).
 *                               Si falta, el audit corre igual: no lee/escribe Sheets,
 *                               y el email lo aclara explicitamente.
 */

const path = require('path');
const fs = require('fs');
const http = require('http');
const { chromium } = require('playwright');

const REPO_ROOT = path.resolve(__dirname, '..');
const ORIGEN_ROOT = path.join(REPO_ROOT, 'origen');
const PORT = Number(process.env.AUDIT_PORT || 4173);
const BASE_URL = `http://127.0.0.1:${PORT}`;
const OUTPUT_DIR = process.env.AUDIT_OUTPUT_DIR || path.join(REPO_ROOT, 'audit-output');
const WEBHOOK_URL = process.env.ORIGEN_AUDIT_WEBHOOK_URL || '';
const ALIAS_TEST = 'AuditorORIGEN';

const VIEWPORTS = [
  { name: 'desktop', width: 1280, height: 800 },
  { name: 'mobile', width: 375, height: 812 },
];

// Elementos interactivos que se enganchan SOLO por JS (addEventListener),
// no por onclick inline -- se excluyen del chequeo generico de "boton sin
// funcion" (reglas 9 y 27) porque ya se verifican con su propio chequeo
// especifico mas abajo (ver auditarPedro). Ver nota de "Simplificaciones
// deliberadas" en el encabezado de este archivo.
const SELECTORES_JS_WIRED = ['#btn-pedro', '.pedro-opcion', '.pedro-close'];

// ────────────────────────────────────────────────────────────────
// Hallazgos: un array plano, cada uno con la regla exacta del pedido
// de Daniela (A1..F28) para que el reporte se pueda cruzar 1 a 1.
// ────────────────────────────────────────────────────────────────
const hallazgos = [];
function ok(regla, pagina, viewport, detalle) {
  hallazgos.push({ regla, pagina, viewport, ok: true, detalle });
}
function fail(regla, pagina, viewport, detalle) {
  hallazgos.push({ regla, pagina, viewport, ok: false, detalle });
}
function skip(regla, pagina, viewport, motivo) {
  hallazgos.push({ regla, pagina, viewport, ok: null, detalle: `no aplica: ${motivo}` });
}

// ────────────────────────────────────────────────────────────────
// Servidor estatico minimo (sin dependencias nuevas) sobre CS/, para
// que todas las paginas compartan el mismo origen http:// y localStorage
// persista igual que en produccion (ver nota en el encabezado).
// ────────────────────────────────────────────────────────────────
const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml', '.gif': 'image/gif', '.webp': 'image/webp',
  '.ico': 'image/x-icon', '.woff': 'font/woff', '.woff2': 'font/woff2',
};

function startServer() {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      try {
        const urlPath = decodeURIComponent(req.url.split('?')[0]);
        const filePath = path.join(REPO_ROOT, urlPath);
        if (!filePath.startsWith(REPO_ROOT)) { res.writeHead(403); res.end(); return; }
        fs.readFile(filePath, (err, data) => {
          if (err) { res.writeHead(404); res.end('404'); return; }
          const ext = path.extname(filePath).toLowerCase();
          res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
          res.end(data);
        });
      } catch (e) { res.writeHead(500); res.end('500'); }
    });
    server.on('error', reject);
    server.listen(PORT, '127.0.0.1', () => resolve(server));
  });
}

// ────────────────────────────────────────────────────────────────
// Helpers de pagina
// ────────────────────────────────────────────────────────────────

function selectorLegible(el) {
  // Corre DENTRO de page.evaluate -- recibe un Element real.
  if (el.id) return `#${el.id}`;
  const cls = (el.className && typeof el.className === 'string')
    ? '.' + el.className.trim().split(/\s+/).slice(0, 2).join('.') : '';
  return `${el.tagName.toLowerCase()}${cls}`;
}

function attachConsoleCapture(page, sink) {
  // Resetea listeners previos: esta funcion se llama una vez por
  // navegacion dentro de loops que reusan la misma `page` (auditarIndices,
  // auditarGeneral, gotoAndWait) -- sin este reset, cada llamada apilaria
  // un listener mas sobre el mismo `page`, y errores de la pagina N
  // terminarian empujados tambien a los arrays `sink` ya leidos de
  // paginas anteriores (fugas de listeners, no un error de resultado,
  // pero desprolijo y evitable).
  page.removeAllListeners('pageerror');
  page.removeAllListeners('console');
  page.on('pageerror', (err) => sink.push({ tipo: 'pageerror', mensaje: String(err && err.message || err) }));
  page.on('console', (msg) => {
    if (msg.type() === 'error') sink.push({ tipo: 'console.error', mensaje: msg.text() });
  });
}

async function getBrokenImages(page) {
  return page.evaluate(() => {
    return [...document.querySelectorAll('img')]
      .filter(img => img.naturalWidth === 0)
      .map(img => img.getAttribute('src') || '(sin src)');
  });
}

async function getDeadButtons(page, excludeSelectors) {
  return page.evaluate((excludeSelectors) => {
    function selectorLegible(el) {
      if (el.id) return `#${el.id}`;
      const cls = (el.className && typeof el.className === 'string')
        ? '.' + el.className.trim().split(/\s+/).slice(0, 2).join('.') : '';
      return `${el.tagName.toLowerCase()}${cls}`;
    }
    const excluded = new Set();
    excludeSelectors.forEach(sel => document.querySelectorAll(sel).forEach(el => excluded.add(el)));

    const candidatos = [...document.querySelectorAll('a, button, [role="button"], .icon-btn')];
    const muertos = [];
    for (const el of candidatos) {
      if (excluded.has(el)) continue;
      const cs = getComputedStyle(el);
      if (cs.display === 'none' || cs.visibility === 'hidden') continue;
      if (el.disabled) continue; // deshabilitado a proposito (ej. antes de elegir alias) no es "muerto"

      const onclick = el.getAttribute('onclick');
      const href = el.getAttribute('href');
      const tieneOnclick = !!(onclick && onclick.trim());
      let hrefValido = false;
      if (href !== null) {
        const h = href.trim();
        hrefValido = h !== '' && h !== '#' && !/^javascript:void\(0\)/.test(h);
      }
      if (!tieneOnclick && !hrefValido) {
        muertos.push({ selector: selectorLegible(el), outerHTML: el.outerHTML.slice(0, 140) });
      }
    }
    return muertos;
  }, excludeSelectors);
}

// Regla 15/28: overlap real por LINEA de texto (Range.getClientRects()),
// no por bounding box de bloque completo -- un parrafo largo puede tener
// su ultima linea libre aunque el <p> entero "toque" el elemento fixed.
async function getFixedOverlaps(page) {
  return page.evaluate(() => {
    function selectorLegible(el) {
      if (el.id) return `#${el.id}`;
      const cls = (el.className && typeof el.className === 'string')
        ? '.' + el.className.trim().split(/\s+/).slice(0, 2).join('.') : '';
      return `${el.tagName.toLowerCase()}${cls}`;
    }
    function seSuperponen(a, b) {
      return !(b.left >= a.right || b.right <= a.left || b.top >= a.bottom || b.bottom <= a.top);
    }

    const fixedEls = [...document.querySelectorAll('*')].filter(el => {
      const cs = getComputedStyle(el);
      if (cs.position !== 'fixed') return false;
      if (cs.display === 'none' || cs.visibility === 'hidden' || Number(cs.opacity) === 0) return false;
      const r = el.getBoundingClientRect();
      return r.width > 0 && r.height > 0;
    });

    const resultados = [];
    for (const fixedEl of fixedEls) {
      const fixedRect = fixedEl.getBoundingClientRect();
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
        acceptNode(node) {
          if (!node.nodeValue || !node.nodeValue.trim()) return NodeFilter.FILTER_REJECT;
          if (fixedEl.contains(node)) return NodeFilter.FILTER_REJECT;
          const parent = node.parentElement;
          if (parent && getComputedStyle(parent).visibility === 'hidden') return NodeFilter.FILTER_REJECT;
          return NodeFilter.FILTER_ACCEPT;
        },
      });
      let node;
      let encontrado = null;
      while ((node = walker.nextNode())) {
        const range = document.createRange();
        range.selectNodeContents(node);
        const rects = [...range.getClientRects()];
        for (const r of rects) {
          if (r.width === 0 || r.height === 0) continue;
          if (seSuperponen(fixedRect, r)) {
            encontrado = {
              fixedSelector: selectorLegible(fixedEl),
              texto: node.nodeValue.trim().slice(0, 80),
              lineRect: { top: Math.round(r.top), left: Math.round(r.left), right: Math.round(r.right), bottom: Math.round(r.bottom) },
            };
            break;
          }
        }
        if (encontrado) break;
      }
      if (encontrado) resultados.push(encontrado);
    }
    return resultados;
  });
}

async function gotoAndWait(page, urlPath) {
  const errores = [];
  attachConsoleCapture(page, errores);
  await page.goto(`${BASE_URL}${urlPath}`, { waitUntil: 'load' });
  await page.waitForTimeout(150); // deja correr los renders sincronicos de INIT
  return errores;
}

// ────────────────────────────────────────────────────────────────
// Descubrimiento dinamico de materias y temas (nunca hardcodeado)
// ────────────────────────────────────────────────────────────────

async function descubrirMaterias(page) {
  await gotoAndWait(page, '/origen/index.html');
  // Las tarjetas de materia usan onclick="window.location.href='xxx/yyy.html'"
  const links = await page.evaluate(() => {
    return [...document.querySelectorAll('.mod-card[onclick]')].map(el => {
      const m = /window\.location\.href\s*=\s*'([^']+)'/.exec(el.getAttribute('onclick') || '');
      const nombre = el.querySelector('.mod-materia');
      return { href: m ? m[1] : null, nombre: nombre ? nombre.textContent.trim() : null };
    }).filter(x => x.href);
  });
  return links; // [{href:'historia/historia-index.html', nombre:'Historia'}, ...]
}

async function leerTopics(page, indexHref) {
  await gotoAndWait(page, `/origen/${indexHref}`);
  const topics = await page.evaluate(() => {
    if (typeof TOPICS === 'undefined') return null;
    const arr = Array.isArray(TOPICS) ? TOPICS : Object.values(TOPICS);
    return arr.map(t => ({ slug: t.slug, available: t.available !== false }));
  });
  const cardCount = await page.locator('.topic-card').count();
  const eraLabelSpans = await page.locator('.era-labels span').count().catch(() => 0);
  return { topics: topics || [], cardCount, eraLabelSpans, indexHref };
}

// ────────────────────────────────────────────────────────────────
// A. Login / identidad (reglas A1-A4)
// ────────────────────────────────────────────────────────────────
async function auditarIdentidad(browser, materias) {
  const historiaEntry = materias.find(m => /historia-index\.html$/.test(m.href));
  if (!historiaEntry) { skip('A1-A4', 'origen/index.html', '-', 'no se encontro la materia Historia para probar la identidad compartida'); return; }

  // --- A1/A2: primera visita, sin alias, en historia-index ---
  {
    const ctx = await browser.newContext({ viewport: VIEWPORTS[0] });
    const page = await ctx.newPage();
    const errores = [];
    attachConsoleCapture(page, errores);
    await page.goto(`${BASE_URL}/origen/${historiaEntry.href}`, { waitUntil: 'load' });
    await page.waitForTimeout(150);

    const apareceSetup = await page.locator('#setup-alias').count() > 0;
    if (apareceSetup && errores.length === 0) ok('A1', historiaEntry.href, 'desktop', 'tarjeta de alias visible sin errores de consola');
    else fail('A1', historiaEntry.href, 'desktop', `setup visible=${apareceSetup}, errores consola=${JSON.stringify(errores)}`);

    if (apareceSetup) {
      await page.fill('#setup-alias', ALIAS_TEST);
      await page.click('.btn-setup-save');
      await page.waitForTimeout(100);
      const alias = await page.evaluate(() => localStorage.getItem('origenAlias'));
      if (alias === ALIAS_TEST) ok('A2', historiaEntry.href, 'desktop', `origenAlias='${alias}'`);
      else fail('A2', historiaEntry.href, 'desktop', `origenAlias='${alias}', esperado '${ALIAS_TEST}'`);
    } else {
      skip('A2', historiaEntry.href, 'desktop', 'no habia tarjeta de alias para completar (¿ya habia alias guardado?)');
    }
    await ctx.close();
  }

  // --- A3: welcome-overlay en mezclas-sistemas-guia, contexto SIN alias ---
  const fqEntry = materias.find(m => /fisicoquimica-index\.html$/.test(m.href));
  if (fqEntry) {
    const ctx = await browser.newContext({ viewport: VIEWPORTS[0] });
    const page = await ctx.newPage();
    await page.goto(`${BASE_URL}/origen/fisicoquimica/mezclas-sistemas-guia.html`, { waitUntil: 'load' });
    await page.waitForTimeout(150);
    const overlayVisibleAntes = await page.evaluate(() => {
      const el = document.getElementById('welcome-overlay');
      return el ? getComputedStyle(el).display !== 'none' : null;
    });
    if (overlayVisibleAntes === true) ok('A3', 'fisicoquimica/mezclas-sistemas-guia.html', 'desktop', 'welcome-overlay visible sin alias, como se espera');
    else fail('A3', 'fisicoquimica/mezclas-sistemas-guia.html', 'desktop', `welcome-overlay visible=${overlayVisibleAntes} (se esperaba true, sin alias previo)`);

    if (overlayVisibleAntes) {
      await page.fill('#login-alias', ALIAS_TEST);
      await page.click('#btn-enter-app');
      await page.waitForTimeout(900); // el fade-out de mezclas/edad-media puede tardar hasta 800ms
      const overlayVisibleDespues = await page.evaluate(() => {
        const el = document.getElementById('welcome-overlay');
        return el ? getComputedStyle(el).display !== 'none' : null;
      });
      if (overlayVisibleDespues === false) ok('A3', 'fisicoquimica/mezclas-sistemas-guia.html', 'desktop', 'welcome-overlay oculto tras enterApp()');
      else fail('A3', 'fisicoquimica/mezclas-sistemas-guia.html', 'desktop', `welcome-overlay sigue visible=${overlayVisibleDespues} tras enterApp()`);
    }
    await ctx.close();
  } else {
    skip('A3', 'fisicoquimica/mezclas-sistemas-guia.html', '-', 'no se encontro la materia Fisicoquimica');
  }

  // --- A4: identidad compartida entre materias (un solo contexto) ---
  if (fqEntry) {
    const ctx = await browser.newContext({ viewport: VIEWPORTS[0] });
    const page = await ctx.newPage();
    await page.goto(`${BASE_URL}/origen/${historiaEntry.href}`, { waitUntil: 'load' });
    await page.waitForTimeout(150);
    if (await page.locator('#setup-alias').count() > 0) {
      await page.fill('#setup-alias', ALIAS_TEST);
      await page.click('.btn-setup-save');
      await page.waitForTimeout(100);
    }
    await page.goto(`${BASE_URL}/origen/${fqEntry.href}`, { waitUntil: 'load' });
    await page.waitForTimeout(150);
    const pideSetupDeNuevo = await page.locator('#setup-alias').count() > 0;
    const aliasEnFQ = await page.evaluate(() => (window.getIdentity ? getIdentity().alias : null));
    if (!pideSetupDeNuevo && aliasEnFQ === ALIAS_TEST) {
      ok('A4', fqEntry.href, 'desktop', `alias compartido correctamente ('${aliasEnFQ}'), sin volver a pedir setup`);
    } else {
      fail('A4', fqEntry.href, 'desktop', `pideSetupDeNuevo=${pideSetupDeNuevo}, alias leido='${aliasEnFQ}'`);
    }
    await ctx.close();
  }
}

// ────────────────────────────────────────────────────────────────
// B. Indice de Historia (y generico era-labels/TOPICS para cualquier
//    indice que tenga ese banner) -- reglas B5-B10
// ────────────────────────────────────────────────────────────────
async function auditarIndices(browser, materiasConTopics) {
  for (const viewport of VIEWPORTS) {
    const ctx = await browser.newContext({ viewport });
    const page = await ctx.newPage();

    for (const m of materiasConTopics) {
      const errores = [];
      attachConsoleCapture(page, errores);
      await page.goto(`${BASE_URL}/origen/${m.indexHref}`, { waitUntil: 'load' });
      await page.waitForTimeout(150);

      // B10 (generico, cualquier indice): cero errores de consola al cargar
      if (errores.length === 0) ok('B10', m.indexHref, viewport.name, 'sin errores de consola');
      else fail('B10', m.indexHref, viewport.name, JSON.stringify(errores));

      // B5: cantidad de .topic-card === TOPICS.length
      const cardCount = await page.locator('.topic-card').count();
      if (cardCount === m.topics.length) ok('B5', m.indexHref, viewport.name, `${cardCount} tarjetas == ${m.topics.length} TOPICS`);
      else fail('B5', m.indexHref, viewport.name, `${cardCount} tarjetas != ${m.topics.length} TOPICS`);

      // B6 (generico): si existe .era-labels, su cantidad de <span> == TOPICS.length
      const eraSpans = await page.locator('.era-labels span').count();
      if (eraSpans === 0) {
        skip('B6', m.indexHref, viewport.name, 'esta pagina no tiene banner .era-labels');
      } else if (eraSpans === m.topics.length) {
        ok('B6', m.indexHref, viewport.name, `${eraSpans} <span> == ${m.topics.length} TOPICS`);
      } else {
        fail('B6', m.indexHref, viewport.name, `${eraSpans} <span> en .era-labels != ${m.topics.length} TOPICS`);
      }

      // B9 (generico): .icon-btn sin onclick
      const soloIconBtn = (await page.evaluate(() => {
        return [...document.querySelectorAll('.icon-btn')].filter(el => !el.getAttribute('onclick')).map(el => el.outerHTML.slice(0, 120));
      }));
      if (soloIconBtn.length === 0) ok('B9', m.indexHref, viewport.name, 'sin .icon-btn sin onclick');
      else fail('B9', m.indexHref, viewport.name, `icon-btn sin onclick: ${JSON.stringify(soloIconBtn)}`);

      // Buscador -- solo si esta pagina tiene el input con oninput real (hoy: historia)
      const tieneBuscador = await page.evaluate(() => !!document.querySelector('.search-box input[oninput]'));
      if (tieneBuscador) {
        const inputSel = '.search-box input';
        // B7: termino que no matchea nada
        await page.fill(inputSel, 'zzz-no-deberia-existir-zzz');
        await page.waitForTimeout(80);
        const sinResultadosMsg = await page.evaluate(() => {
          const grid = document.getElementById('topics-grid');
          return grid ? grid.textContent.toLowerCase().includes('no encontramos') : false;
        });
        const gridVacio = await page.locator('#topics-grid .topic-card').count() === 0;
        if (sinResultadosMsg && gridVacio) ok('B7', m.indexHref, viewport.name, 'mensaje de sin resultados visible');
        else fail('B7', m.indexHref, viewport.name, `sinResultadosMsg=${sinResultadosMsg}, tarjetasVisibles=${!gridVacio}`);

        // B8: termino que si matchea (titulo exacto del primer topic disponible)
        const primerTitulo = await page.evaluate(() => {
          const arr = Array.isArray(TOPICS) ? TOPICS : Object.values(TOPICS);
          return arr[0] ? arr[0].title : null;
        });
        if (primerTitulo) {
          await page.fill(inputSel, primerTitulo);
          await page.waitForTimeout(80);
          const sigueLaCard = await page.locator('#topics-grid .topic-card').count() >= 1;
          if (sigueLaCard) ok('B8', m.indexHref, viewport.name, `'${primerTitulo}' sigue mostrando su tarjeta`);
          else fail('B8', m.indexHref, viewport.name, `'${primerTitulo}' no matcheo ninguna tarjeta`);
        } else {
          skip('B8', m.indexHref, viewport.name, 'no se pudo leer el titulo del primer topic');
        }
        await page.fill(inputSel, ''); // reset para no afectar chequeos siguientes
      } else {
        skip('B7', m.indexHref, viewport.name, 'esta pagina no tiene buscador con oninput');
        skip('B8', m.indexHref, viewport.name, 'esta pagina no tiene buscador con oninput');
      }

      // F26/F27 genericos en esta pagina (se acumulan tambien en el barrido final)
      const rotas = await getBrokenImages(page);
      if (rotas.length === 0) ok('F26', m.indexHref, viewport.name, 'sin imagenes rotas');
      else fail('F26', m.indexHref, viewport.name, JSON.stringify(rotas));

      const muertos = await getDeadButtons(page, SELECTORES_JS_WIRED);
      if (muertos.length === 0) ok('F27', m.indexHref, viewport.name, 'sin links/botones muertos');
      else fail('F27', m.indexHref, viewport.name, JSON.stringify(muertos));

      const overlaps = await getFixedOverlaps(page);
      if (overlaps.length === 0) ok('F28', m.indexHref, viewport.name, 'sin overlaps fixed/contenido');
      else fail('F28', m.indexHref, viewport.name, JSON.stringify(overlaps));
    }
    await ctx.close();
  }
}

// ────────────────────────────────────────────────────────────────
// C. Navegacion a la guia real -- reglas C11-C13 (se corre para
//    CADA topic de CADA materia descubierta, no solo Edad Media)
// ────────────────────────────────────────────────────────────────
async function auditarNavegacion(browser, materiasConTopics) {
  const ctx = await browser.newContext({ viewport: VIEWPORTS[0] });
  const page = await ctx.newPage();

  for (const m of materiasConTopics) {
    for (const topic of m.topics) {
      const errores = [];
      attachConsoleCapture(page, errores);

      // C11: goToTopic(slug) navega a tema.html?tema=slug
      await page.goto(`${BASE_URL}/origen/${m.indexHref}`, { waitUntil: 'load' });
      await page.waitForTimeout(100);
      await page.evaluate((slug) => goToTopic(slug), topic.slug);
      await page.waitForTimeout(150);
      const urlOk = page.url().includes(`tema.html?tema=${topic.slug}`);
      if (urlOk) ok('C11', `${m.indexHref} -> ${topic.slug}`, 'desktop', `goToTopic('${topic.slug}') navego a ${page.url()}`);
      else fail('C11', `${m.indexHref} -> ${topic.slug}`, 'desktop', `URL final inesperada: ${page.url()}`);

      // C12: la caratula muestra el tema disponible, sin bloqueo falso
      const caratula = await page.evaluate(() => {
        const box = document.getElementById('cover-box');
        return box ? box.textContent : '';
      });
      const diceNoDisponible = /no encontramos|en construccion|en construcción/i.test(caratula);
      if (topic.available && !diceNoDisponible) {
        ok('C12', `tema.html?tema=${topic.slug}`, 'desktop', 'caratula muestra el tema como disponible');
      } else if (!topic.available) {
        skip('C12', `tema.html?tema=${topic.slug}`, 'desktop', 'topic marcado available:false, no se espera CTA real');
      } else {
        fail('C12', `tema.html?tema=${topic.slug}`, 'desktop', `topic.available=true pero la caratula dice bloqueo: "${caratula.slice(0, 200)}"`);
      }

      // C13: boton para entrar a la guia real funciona y carga sin error
      if (topic.available) {
        const ctaHref = await page.evaluate(() => {
          const a = document.querySelector('.cover a[href], #cover-box a[href]');
          return a ? a.getAttribute('href') : null;
        });
        if (ctaHref) {
          const erroresAntes = errores.length; // mismo listener de C11, solo miramos lo nuevo
          await page.click('.cover a[href], #cover-box a[href]');
          await page.waitForTimeout(200);
          const erroresGuia = errores.slice(erroresAntes);
          if (erroresGuia.length === 0) ok('C13', ctaHref, 'desktop', 'la guia real cargo sin errores de consola');
          else fail('C13', ctaHref, 'desktop', JSON.stringify(erroresGuia));
        } else {
          fail('C13', `tema.html?tema=${topic.slug}`, 'desktop', 'no se encontro el link de "Comenzar la guia"');
        }
      } else {
        skip('C13', `tema.html?tema=${topic.slug}`, 'desktop', 'topic marcado available:false');
      }
    }
  }
  await ctx.close();
}

// ────────────────────────────────────────────────────────────────
// D. Boton de Pedro -- reglas D14-D20 (feature-detected: corre en
//    CUALQUIER guia que tenga #btn-pedro, no solo Mezclas y Sistemas)
// ────────────────────────────────────────────────────────────────
async function auditarPedro(browser, guiasConPedro) {
  for (const guiaHref of guiasConPedro) {
    // ---- Mobile: toda la secuencia de colapso/expansion ----
    {
      const ctx = await browser.newContext({ viewport: VIEWPORTS[1] });
      const page = await ctx.newPage();
      await loguearComoAlumno(page, guiaHref);
      await page.waitForTimeout(200); // < 500ms: antes del auto-expand inicial

      // D14: estado inicial colapsado
      const expandidoInicial = await page.evaluate(() => document.getElementById('btn-pedro').classList.contains('expanded'));
      if (!expandidoInicial) ok('D14', guiaHref, 'mobile', 'estado inicial colapsado');
      else fail('D14', guiaHref, 'mobile', 'el boton aparecio expandido antes de los 500ms iniciales');

      // D15: sin overlap real (por linea) con el primer parrafo visible, en colapsado
      const overlaps = await getFixedOverlaps(page);
      const overlapPedro = overlaps.filter(o => o.fixedSelector.includes('btn-pedro'));
      if (overlapPedro.length === 0) ok('D15', guiaHref, 'mobile', 'sin overlap real de #btn-pedro colapsado con texto');
      else fail('D15', guiaHref, 'mobile', JSON.stringify(overlapPedro));

      // D16: scroll <8px no colapsa mas de lo que ya esta (sigue igual)
      await page.evaluate(() => window.scrollTo(0, 5));
      await page.waitForTimeout(80);
      const sigueIgualTrasScrollChico = await page.evaluate(() => !document.getElementById('btn-pedro').classList.contains('expanded'));
      if (sigueIgualTrasScrollChico) ok('D16', guiaHref, 'mobile', 'scroll <8px no cambio el estado colapsado');
      else fail('D16', guiaHref, 'mobile', 'el boton se expandio con un scroll menor a 8px');

      // D17: scroll >8px colapsa inmediatamente (forzamos primero a expandido simulando inactividad)
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.waitForTimeout(550); // deja que se re-expanda por inactividad
      await page.evaluate(() => window.scrollTo(0, 60)); // salto > 8px
      await page.waitForTimeout(80);
      const colapsoTrasScrollGrande = await page.evaluate(() => !document.getElementById('btn-pedro').classList.contains('expanded'));
      if (colapsoTrasScrollGrande) ok('D17', guiaHref, 'mobile', 'scroll >8px colapso inmediatamente');
      else fail('D17', guiaHref, 'mobile', 'el boton no colapso tras un scroll mayor a 8px');

      // D18: tras 500ms de inactividad (en cualquier scrollY) se reexpande
      await page.waitForTimeout(550);
      const reexpandido = await page.evaluate(() => document.getElementById('btn-pedro').classList.contains('expanded'));
      if (reexpandido) ok('D18', guiaHref, 'mobile', 'se reexpandio tras 500ms de inactividad');
      else fail('D18', guiaHref, 'mobile', 'no se reexpandio tras 500ms de inactividad');

      // D19: tap sobre el icono colapsado abre #pedro-panel
      await page.evaluate(() => window.scrollTo(0, 60)); // volvemos a colapsar
      await page.waitForTimeout(80);
      await page.click('#btn-pedro');
      await page.waitForTimeout(100);
      const panelAbierto = await page.evaluate(() => document.getElementById('pedro-panel').style.display === 'block');
      if (panelAbierto) ok('D19', guiaHref, 'mobile', '#pedro-panel abierto tras tap');
      else fail('D19', guiaHref, 'mobile', '#pedro-panel no quedo con display:block tras el tap');

      await ctx.close();
    }

    // ---- Desktop: matchMedia debe dar false, sin clase .expanded activa por JS ----
    {
      const ctx = await browser.newContext({ viewport: VIEWPORTS[0] });
      const page = await ctx.newPage();
      await loguearComoAlumno(page, guiaHref);
      await page.waitForTimeout(700); // suficiente para que, SI hubiera listeners, ya hubiesen actuado

      const matchMediaFalse = await page.evaluate(() => !window.matchMedia('(max-width:600px)').matches);
      const sinRepliegueWired = await page.evaluate(() => {
        const btn = document.getElementById('btn-pedro');
        return !btn.dataset.replieguePronto; // initPedroBtnRepliegue() vuelve antes de setear esta bandera en desktop
      });
      if (matchMediaFalse && sinRepliegueWired) ok('D20', guiaHref, 'desktop', 'matchMedia=false y sin listeners de repliegue activos');
      else fail('D20', guiaHref, 'desktop', `matchMediaFalse=${matchMediaFalse}, sinRepliegueWired=${sinRepliegueWired}`);

      await ctx.close();
    }
  }
  if (guiasConPedro.length === 0) {
    skip('D14-D20', '-', '-', 'no se encontro ninguna guia con #btn-pedro');
  }
}

// Entra a una guia como alumno ya identificado (usa el alias global de
// la corrida, seteandolo directo en localStorage antes de cargar --
// mas rapido y estable que repetir el flujo de UI en cada sub-chequeo).
async function loguearComoAlumno(page, guiaHref) {
  await page.goto(`${BASE_URL}/origen/${guiaHref}`, { waitUntil: 'load' });
  await page.evaluate((alias) => {
    localStorage.setItem('origenAlias', alias);
    localStorage.setItem('origenHistoriaAlias', alias);
    localStorage.setItem('origenGuide', 'pedro');
  }, ALIAS_TEST);
  await page.reload({ waitUntil: 'load' });
  await page.waitForTimeout(150);
}

// ────────────────────────────────────────────────────────────────
// E. Progreso -- reglas E21-E24 (E21 especifico de Mezclas, E22-24
//    genericos por materia con getMateriaProgress)
// ────────────────────────────────────────────────────────────────
async function auditarProgreso(browser, corridaAnterior) {
  const progresoActual = {};

  // E21: completar un quiz en Mezclas y Sistemas, confirmar alias correcto
  {
    const ctx = await browser.newContext({ viewport: VIEWPORTS[0] });
    const page = await ctx.newPage();
    const guiaHref = 'fisicoquimica/mezclas-sistemas-guia.html';
    const tieneGuia = fs.existsSync(path.join(ORIGEN_ROOT, guiaHref));
    if (tieneGuia) {
      await loguearComoAlumno(page, guiaHref);
      const hayQuiz = await page.locator('#btn-submit-0').count() > 0;
      if (hayQuiz) {
        // Responde lo que haya (MC: primera opcion; desarrollo: texto generico) --
        // no importa si acierta, solo que se complete el envio.
        const mcButtons = await page.locator('#quiz-body-0 .q-opts').all();
        for (const grupo of mcButtons) {
          const primerBoton = grupo.locator('.q-opt').first();
          if (await primerBoton.count()) await primerBoton.click();
        }
        const textareas = await page.locator('#quiz-body-0 .q-written').all();
        for (const ta of textareas) {
          await ta.fill('Respuesta generada por la auditoria automatica de ORIGEN.');
        }
        await page.click('#btn-submit-0');
        await page.waitForTimeout(150);

        const mensajeResultado = await page.evaluate(() => {
          const el = document.getElementById('quiz-result-0');
          return el ? el.textContent : '';
        });
        const contieneAlias = mensajeResultado.includes(ALIAS_TEST);
        const contieneGenerico = /\bestudiante\b/i.test(mensajeResultado) && !contieneAlias;
        if (contieneAlias) ok('E21', guiaHref, 'desktop', `Resultados.mostrarEn uso el alias real ('${ALIAS_TEST}')`);
        else fail('E21', guiaHref, 'desktop', `no se encontro el alias '${ALIAS_TEST}' en la devolucion${contieneGenerico ? " (aparecio 'estudiante' generico)" : ''}: "${mensajeResultado.slice(0, 200)}"`);
      } else {
        skip('E21', guiaHref, 'desktop', 'no se encontro el quiz del capitulo 0 (#btn-submit-0)');
      }
    } else {
      skip('E21', guiaHref, 'desktop', 'no existe mezclas-sistemas-guia.html en este checkout');
    }
    await ctx.close();
  }

  // E22-24: progreso real por materia, comparado contra la corrida anterior
  {
    const ctx = await browser.newContext({ viewport: VIEWPORTS[0] });
    const page = await ctx.newPage();
    for (const materia of ['historia', 'fisicoquimica']) {
      const indexHref = materia === 'historia' ? 'historia/historia-index.html' : 'fisicoquimica/fisicoquimica-index.html';
      if (!fs.existsSync(path.join(ORIGEN_ROOT, indexHref))) { continue; }
      await loguearComoAlumno(page, indexHref);
      const progreso = await page.evaluate((m) => (typeof getMateriaProgress === 'function' ? getMateriaProgress(m) : null), materia);
      const valorAgregado = progreso ? Object.values(progreso).reduce((a, b) => a + (Number(b) || 0), 0) / Math.max(1, Object.keys(progreso).length) : 0;
      progresoActual[materia] = Math.round(valorAgregado);

      ok('E22', indexHref, 'desktop', `progreso crudo leido: ${JSON.stringify(progreso)}`);

      const anterior = corridaAnterior ? corridaAnterior[materia] : undefined;
      if (anterior === undefined || anterior === null) {
        skip('E23', indexHref, 'desktop', 'no hay corrida anterior en Sheets para comparar (primera corrida)');
      } else {
        const delta = progresoActual[materia] - Number(anterior);
        const direccion = delta > 0 ? 'aumento' : delta < 0 ? 'bajo' : 'igual';
        ok('E23', indexHref, 'desktop', `anterior=${anterior}, actual=${progresoActual[materia]} (${direccion}, delta=${delta})`);

        if (delta < 0) {
          fail('E24', indexHref, 'desktop', `el progreso bajo de ${anterior} a ${progresoActual[materia]} sin cambio de codigo esperado -- posible bug de persistencia`);
        } else {
          ok('E24', indexHref, 'desktop', 'el progreso no bajo respecto de la corrida anterior');
        }
      }
    }
    await ctx.close();
  }

  return progresoActual;
}

// ────────────────────────────────────────────────────────────────
// F. Barrido general (F25-F28) sobre TODAS las paginas descubiertas,
//    ambos viewports -- complementa lo ya chequeado puntualmente en
//    auditarIndices() para las paginas de indice.
// ────────────────────────────────────────────────────────────────
async function auditarGeneral(browser, paginas) {
  for (const viewport of VIEWPORTS) {
    const ctx = await browser.newContext({ viewport });
    const page = await ctx.newPage();
    for (const pagina of paginas) {
      const errores = await gotoAndWait(page, `/origen/${pagina}`);

      if (errores.length === 0) ok('F25', pagina, viewport.name, 'sin errores de consola en la navegacion');
      else fail('F25', pagina, viewport.name, JSON.stringify(errores));

      const rotas = await getBrokenImages(page);
      if (rotas.length === 0) ok('F26', pagina, viewport.name, 'sin imagenes rotas');
      else fail('F26', pagina, viewport.name, JSON.stringify(rotas));

      const muertos = await getDeadButtons(page, SELECTORES_JS_WIRED);
      if (muertos.length === 0) ok('F27', pagina, viewport.name, 'sin links/botones muertos');
      else fail('F27', pagina, viewport.name, JSON.stringify(muertos));

      const overlaps = await getFixedOverlaps(page);
      if (overlaps.length === 0) ok('F28', pagina, viewport.name, 'sin overlaps fixed/contenido');
      else fail('F28', pagina, viewport.name, JSON.stringify(overlaps));
    }
    await ctx.close();
  }
}

// ────────────────────────────────────────────────────────────────
// Google Sheets (Apps Script) -- lectura de la corrida anterior y
// registro de la corrida actual. Best-effort: si falla, no rompe
// el audit, solo lo deja anotado.
// ────────────────────────────────────────────────────────────────
async function leerCorridaAnterior() {
  if (!WEBHOOK_URL) return { progreso: null, motivo: 'ORIGEN_AUDIT_WEBHOOK_URL no configurada' };
  try {
    const res = await fetch(`${WEBHOOK_URL}?accion=ultima`, { method: 'GET' });
    if (!res.ok) return { progreso: null, motivo: `GET devolvio HTTP ${res.status}` };
    const data = await res.json();
    return { progreso: data && data.progreso ? data.progreso : null, motivo: null };
  } catch (e) {
    return { progreso: null, motivo: `error de red: ${e.message}` };
  }
}

async function loguearCorrida(payload) {
  if (!WEBHOOK_URL) return { ok: false, motivo: 'ORIGEN_AUDIT_WEBHOOK_URL no configurada' };
  try {
    const res = await fetch(WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) return { ok: false, motivo: `POST devolvio HTTP ${res.status}` };
    return { ok: true, motivo: null };
  } catch (e) {
    return { ok: false, motivo: `error de red: ${e.message}` };
  }
}

// ────────────────────────────────────────────────────────────────
// Reporte final (Markdown, para el paso de email del workflow)
// ────────────────────────────────────────────────────────────────
function armarReporteMarkdown(progresoActual, corridaAnterior, sheetsEstado) {
  const total = hallazgos.length;
  const fallidos = hallazgos.filter(h => h.ok === false);
  const exitosos = hallazgos.filter(h => h.ok === true);
  const noAplica = hallazgos.filter(h => h.ok === null);

  let md = `# Auditoria ORIGEN\n\n`;
  md += `**Resultado general:** ${fallidos.length === 0 ? 'OK -- sin hallazgos' : `${fallidos.length} hallazgo(s)`}\n\n`;
  md += `Reglas evaluadas: ${total} (${exitosos.length} OK, ${fallidos.length} con hallazgo, ${noAplica.length} no aplicables en esta corrida)\n\n`;

  md += `## Progreso del alumno de prueba\n\n`;
  for (const materia of Object.keys(progresoActual)) {
    const anterior = corridaAnterior && corridaAnterior[materia] !== undefined ? corridaAnterior[materia] : 'sin dato previo';
    md += `- **${materia}**: anterior=${anterior} -> actual=${progresoActual[materia]}\n`;
  }
  md += `\n`;

  if (fallidos.length > 0) {
    md += `## Hallazgos\n\n`;
    for (const h of fallidos) {
      md += `- **[${h.regla}]** ${h.pagina} (${h.viewport}): ${h.detalle}\n`;
    }
    md += `\n`;
  } else {
    md += `## Hallazgos\n\nSin hallazgos en esta corrida.\n\n`;
  }

  md += `## Detalle completo (todas las reglas)\n\n`;
  md += `| Regla | Pagina | Viewport | Estado | Detalle |\n|---|---|---|---|---|\n`;
  for (const h of hallazgos) {
    const estado = h.ok === true ? 'OK' : h.ok === false ? 'HALLAZGO' : 'N/A';
    md += `| ${h.regla} | ${h.pagina} | ${h.viewport} | ${estado} | ${String(h.detalle).slice(0, 300).replace(/\|/g, '\\|')} |\n`;
  }

  md += `\n## Registro en Sheets\n\n${sheetsEstado}\n`;
  return md;
}

// ────────────────────────────────────────────────────────────────
// MAIN
// ────────────────────────────────────────────────────────────────
(async () => {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  const server = await startServer();
  console.log(`[audit-origen] servidor estatico en ${BASE_URL} (raiz: ${REPO_ROOT})`);

  const browser = await chromium.launch();
  try {
    const discoveryPage = await (await browser.newContext({ viewport: VIEWPORTS[0] })).newPage();
    const materias = await descubrirMaterias(discoveryPage);
    console.log('[audit-origen] materias descubiertas:', materias.map(m => m.nombre).join(', '));

    const materiasConTopics = [];
    for (const m of materias) {
      const info = await leerTopics(discoveryPage, m.href);
      materiasConTopics.push({ ...m, ...info });
    }
    await discoveryPage.context().close();

    // Todas las paginas HTML reales bajo origen/, para el barrido general F25-F28
    const todasLasPaginas = [];
    (function walk(dir, rel) {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const relPath = rel ? `${rel}/${entry.name}` : entry.name;
        if (entry.isDirectory()) walk(path.join(dir, entry.name), relPath);
        else if (entry.name.endsWith('.html') && !entry.name.includes('tema.html')) todasLasPaginas.push(relPath);
      }
    })(ORIGEN_ROOT, '');

    // Guias con boton de Pedro (feature-detection, no hardcodeado)
    const guiasConPedro = [];
    for (const pagina of todasLasPaginas) {
      const contenido = fs.readFileSync(path.join(ORIGEN_ROOT, pagina), 'utf-8');
      if (contenido.includes('id="btn-pedro"')) guiasConPedro.push(pagina);
    }

    console.log('[audit-origen] corriendo A. identidad...');
    await auditarIdentidad(browser, materias);

    console.log('[audit-origen] corriendo B. indices...');
    await auditarIndices(browser, materiasConTopics);

    console.log('[audit-origen] corriendo C. navegacion...');
    await auditarNavegacion(browser, materiasConTopics);

    console.log('[audit-origen] corriendo D. boton de Pedro...');
    await auditarPedro(browser, guiasConPedro);

    console.log('[audit-origen] leyendo corrida anterior de Sheets...');
    const previa = await leerCorridaAnterior();

    console.log('[audit-origen] corriendo E. progreso...');
    const progresoActual = await auditarProgreso(browser, previa.progreso);

    console.log('[audit-origen] corriendo F. barrido general...');
    await auditarGeneral(browser, todasLasPaginas);

    // ── log a Sheets ──
    const ahoraArg = new Date(Date.now() - 3 * 60 * 60 * 1000); // UTC-3, sin horario de verano
    const fecha = ahoraArg.toISOString().slice(0, 10);
    const hora = ahoraArg.toISOString().slice(11, 19);
    const fallidos = hallazgos.filter(h => h.ok === false);
    const payload = {
      fecha, hora,
      run_id: process.env.GITHUB_RUN_ID || 'local',
      resultado_general: fallidos.length === 0 ? 'OK' : 'CON_HALLAZGOS',
      total_hallazgos: fallidos.length,
      hallazgos_desktop: fallidos.filter(h => h.viewport === 'desktop').length,
      hallazgos_mobile: fallidos.filter(h => h.viewport === 'mobile').length,
      detalle_hallazgos: fallidos.map(h => h.regla).join(';'),
      progreso: progresoActual,
    };
    const resultadoLog = await loguearCorrida(payload);
    const sheetsEstado = resultadoLog.ok
      ? 'Corrida registrada correctamente en Sheets.'
      : `No se pudo registrar en Sheets (${resultadoLog.motivo}). El resto de la auditoria SI corrio -- ver detalle arriba.`;
    console.log(`[audit-origen] ${sheetsEstado}`);

    const reporte = armarReporteMarkdown(progresoActual, previa.progreso, sheetsEstado);
    fs.writeFileSync(path.join(OUTPUT_DIR, 'report.md'), reporte, 'utf-8');
    fs.writeFileSync(path.join(OUTPUT_DIR, 'hallazgos.json'), JSON.stringify(hallazgos, null, 2), 'utf-8');
    console.log(`[audit-origen] reporte escrito en ${path.join(OUTPUT_DIR, 'report.md')}`);

    const huboFallos = hallazgos.some(h => h.ok === false);
    process.exitCode = huboFallos ? 1 : 0;
  } finally {
    await browser.close();
    server.close();
  }
})().catch((err) => {
  console.error('[audit-origen] ERROR FATAL:', err);
  try {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    fs.writeFileSync(
      path.join(OUTPUT_DIR, 'report.md'),
      `# Auditoria ORIGEN\n\n**ATENCION: la corrida fallo antes de terminar.**\n\nError: ${err && err.stack || err}\n`,
      'utf-8'
    );
  } catch (e) { /* nada mas que hacer */ }
  process.exitCode = 1;
});
