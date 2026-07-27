// ══════════════════════════════════════════════════════════
//  ORIGEN · Core · storage.js
//  Única puerta de entrada a localStorage para toda la plataforma.
//
//  Por qué existe: hoy historia.js y edad-media-guia.html tienen,
//  cada uno, su propia copia de safeGet/safeSet. Esta es la misma
//  lógica exacta (sin cambios de comportamiento), movida a un solo
//  lugar para que ninguna materia futura la vuelva a duplicar.
//
//  Retrocompatibilidad: expone además las claves "compat" que ya
//  usan Historia y Edad Media (origenHistoriaAlias/Guide), para no
//  romper a nadie que ya las lea.
// ══════════════════════════════════════════════════════════

const ORIGEN_KEYS = {
  alias: 'origenAlias',
  guide: 'origenGuide',
  // claves de compatibilidad heredadas de Historia — se siguen
  // escribiendo en espejo, no se eliminan.
  aliasCompatHistoria: 'origenHistoriaAlias',
  guideCompatHistoria: 'origenHistoriaGuide',
};

function safeGet(key) {
  try { return localStorage.getItem(key); }
  catch (e) { return null; }
}

function safeSet(key, val) {
  try { localStorage.setItem(key, val); return true; }
  catch (e) { return false; }
}

function safeGetJSON(key, fallback) {
  try { return JSON.parse(safeGet(key) || 'null') ?? fallback; }
  catch (e) { return fallback; }
}

function safeSetJSON(key, obj) {
  try { return safeSet(key, JSON.stringify(obj)); }
  catch (e) { return false; }
}

// ── Identidad compartida (alias + guía elegido) ──
// Lee con fallback a las claves compat, igual que hacían
// historia.js y edad-media-guia.html por separado.
function getIdentity() {
  const alias = safeGet(ORIGEN_KEYS.alias) || safeGet(ORIGEN_KEYS.aliasCompatHistoria) || '';
  const guide = safeGet(ORIGEN_KEYS.guide) || safeGet(ORIGEN_KEYS.guideCompatHistoria) || '';
  return { alias, guide };
}

function setIdentity(alias, guide) {
  safeSet(ORIGEN_KEYS.alias, alias);
  safeSet(ORIGEN_KEYS.guide, guide);
  // espejo en claves compat, tal como lo hacía cada materia antes
  safeSet(ORIGEN_KEYS.aliasCompatHistoria, alias);
  safeSet(ORIGEN_KEYS.guideCompatHistoria, guide);
}

// Para materias que NO tienen personaje-guía (hoy: Historia). Guarda
// solo el alias y no toca 'origenGuide' — así no pisa la elección de
// guía hecha en una materia de Exactas (ej. Pedro), que es global.
function setAlias(alias) {
  safeSet(ORIGEN_KEYS.alias, alias);
  safeSet(ORIGEN_KEYS.aliasCompatHistoria, alias);
}

// Getter de conveniencia — equivalente a getIdentity().alias, pero
// más cómodo de usar desde cualquier página que solo necesite el
// nombre/alias actual (ej. notas.html).
function getAlias() {
  return getIdentity().alias || '';
}

// Borra la identidad compartida (alias + guía). Se usa cuando una
// materia termina por completo su recorrido y necesita garantizar
// que el próximo alumno en este dispositivo tenga que identificarse
// de nuevo — sin esto, cualquier materia mostraría directo el alias
// del alumno anterior. Efecto secundario esperado y deseado: como el
// alias es compartido por toda la plataforma, otra materia (ej.
// Historia) también va a volver a pedir el nombre la próxima vez que
// se abra. Es intencional: preferimos volver a preguntar el nombre
// una vez de más, a arrastrar la identidad de un alumno anterior.
function resetIdentity() {
  safeSet(ORIGEN_KEYS.alias, '');
  safeSet(ORIGEN_KEYS.guide, '');
  safeSet(ORIGEN_KEYS.aliasCompatHistoria, '');
  safeSet(ORIGEN_KEYS.guideCompatHistoria, '');
}

// Progreso por materia: se guarda como { [materia]: { [slug]: pct } }
// Reemplaza el esquema plano 'origenHistoriaProgress' de forma
// retrocompatible: si existe el formato viejo, se migra una sola vez.
function getMateriaProgress(materia) {
  const all = safeGetJSON('origenProgreso', null);
  if (all && all[materia]) return all[materia];

  // migración desde el formato viejo de Historia (una sola vez)
  if (materia === 'historia') {
    const legacy = safeGetJSON('origenHistoriaProgress', null);
    if (legacy) return legacy;
  }
  return {};
}

function setMateriaProgress(materia, progresoObj) {
  const all = safeGetJSON('origenProgreso', {});
  all[materia] = progresoObj;
  safeSetJSON('origenProgreso', all);
  // se mantiene también la clave vieja de Historia, por compatibilidad
  if (materia === 'historia') safeSetJSON('origenHistoriaProgress', progresoObj);
}

// ── Historial académico (notas) por materia ──
// Guarda { [materia]: [ {id, tema, alias, fecha, ...} , ... ] }.
// A propósito NO vive en 'origenProgreso' ni se toca al reiniciar una
// sesión de materia: el progreso activo (qué capítulo va, si el examen
// ya se rindió) se puede reiniciar para el próximo alumno sin borrar
// el registro académico ya generado. Esta es la única fuente de datos
// para la futura sección "Notas" — cualquier materia puede escribir acá
// con el mismo formato libre (cada materia decide qué campos manda
// dentro de "registro", esta función no impone estructura interna).
function addGradeRecord(materia, registro) {
  const all = safeGetJSON('origenNotas', {});
  if (!all[materia]) all[materia] = [];
  const conId = Object.assign({
    id: (Date.now().toString(36) + Math.random().toString(36).slice(2, 8)),
    fecha: new Date().toISOString(),
  }, registro);
  all[materia].push(conId);
  safeSetJSON('origenNotas', all);
  return conId;
}

function getGradeHistory(materia) {
  const all = safeGetJSON('origenNotas', {});
  if (materia) return all[materia] || [];
  return all;
}
