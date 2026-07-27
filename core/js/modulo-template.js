// ══════════════════════════════════════════════════════════
//  ORIGEN · Core · modulo-template.js
//
//  Plantilla única y reutilizable para el contenido de un módulo,
//  de cualquier materia. No conoce nombres de materias ni temas —
//  solo recibe un objeto "modulo" con esta forma (todos los campos
//  son opcionales salvo titulo: la sección solo se renderiza si el
//  campo viene con contenido):
//
//  {
//    titulo: 'Feudalismo',
//    definicion: '...',
//    desarrollo: '...',            // explicación desarrollada
//    ejemplos: ['...', '...'],
//    aplicaciones: '...',
//    conexiones: [                 // temas relacionados
//      {titulo:'Iglesia en la Edad Media', url:'...'}, ...
//    ],
//    curiosidad: '...',            // "¿Sabías que...?"
//    errorFrecuente: '...',
//    conceptosImportantes: ['...', '...'],
//    resumen: '...',
//  }
//
//  Las "Conexiones" usan NavegacionEstado.irAConexion (Core) para
//  no perder la posición de lectura al saltar a un tema relacionado.
//  Si NavegacionEstado no está cargado, degrada a un link normal.
// ══════════════════════════════════════════════════════════

const ModuloTemplate = (function(){

  function seccion(clase, tituloSeccion, contenidoHTML){
    if (!contenidoHTML) return '';
    return `<section class="origen-modulo-seccion ${clase}">` +
      (tituloSeccion ? `<h3 class="origen-modulo-seccion-titulo">${tituloSeccion}</h3>` : '') +
      contenidoHTML +
      `</section>`;
  }

  function listaHTML(items){
    if (!items || !items.length) return '';
    return `<ul>` + items.map(i => `<li>${i}</li>`).join('') + `</ul>`;
  }

  function conexionesHTML(conexiones){
    if (!conexiones || !conexiones.length) return '';
    const items = conexiones.map((c, i) => {
      const onclick = `ModuloTemplate._irAConexion(${JSON.stringify(c.url)})`;
      return `<li><a href="javascript:void(0)" onclick='${onclick}' class="origen-modulo-conexion">${c.titulo}</a></li>`;
    }).join('');
    return `<p>Este tema también se relaciona con:</p><ul class="origen-modulo-conexiones">${items}</ul>`;
  }

  // Se llama desde el onclick de cada link de Conexiones.
  function _irAConexion(url){
    if (typeof NavegacionEstado !== 'undefined'){
      NavegacionEstado.irAConexion({ url });
    } else if (typeof window !== 'undefined'){
      window.location.href = url; // degradación sin Core: link normal
    }
  }

  // ── Arma el HTML completo del módulo ──
  function renderHTML(modulo){
    let html = `<article class="origen-modulo">`;
    html += `<h2 class="origen-modulo-titulo">${modulo.titulo}</h2>`;
    html += seccion('origen-modulo-definicion', null, modulo.definicion ? `<p>${modulo.definicion}</p>` : '');
    html += seccion('origen-modulo-desarrollo', null, modulo.desarrollo ? `<p>${modulo.desarrollo}</p>` : '');
    html += seccion('origen-modulo-ejemplos', 'Ejemplos', listaHTML(modulo.ejemplos));
    html += seccion('origen-modulo-aplicaciones', 'Aplicaciones', modulo.aplicaciones ? `<p>${modulo.aplicaciones}</p>` : '');
    html += seccion('origen-modulo-conexiones', 'Conexiones', conexionesHTML(modulo.conexiones));
    html += seccion('origen-modulo-curiosidad', '¿Sabías que...?', modulo.curiosidad ? `<p>${modulo.curiosidad}</p>` : '');
    html += seccion('origen-modulo-error-frecuente', 'Error frecuente', modulo.errorFrecuente ? `<p>${modulo.errorFrecuente}</p>` : '');
    html += seccion('origen-modulo-conceptos', 'Conceptos importantes', listaHTML(modulo.conceptosImportantes));
    html += seccion('origen-modulo-resumen', 'Resumen', modulo.resumen ? `<p>${modulo.resumen}</p>` : '');
    html += `</article>`;
    return html;
  }

  function montarEn(elemento, modulo){
    if (elemento) elemento.innerHTML = renderHTML(modulo);
  }

  return { renderHTML, montarEn, _irAConexion };
})();
