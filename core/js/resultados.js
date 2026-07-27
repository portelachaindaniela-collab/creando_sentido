// ══════════════════════════════════════════════════════════
//  ORIGEN · Core · resultados.js
//
//  Pantalla de devolución estándar para cualquier evaluación
//  (de módulo o examen final), a partir del objeto "resultado"
//  que ya entrega evaluacion-motor.js:
//    {puntos, maxPuntos, pct, nota10, aprobado, fortalezas,
//     aRepasar, sugerencia, detalle}
//
//  No conoce materias ni nombres de temas — solo recibe el
//  resultado del motor y, opcionalmente, un alias para
//  personalizar el mensaje.
//
//  Regla dura: NUNCA arma ni muestra la respuesta correcta de
//  una pregunta de desarrollo (el motor ya no la incluye en
//  "detalle" para ese tipo, así que acá no hay forma de filtrar
//  mal y filtrarla sin querer).
// ══════════════════════════════════════════════════════════

const Resultados = (function(){

  // ── Arma la devolución estructurada (sin tocar el DOM) ──
  // contexto opcional: {alias, umbralAprobacion} — todo lo demás
  // se calcula solo a partir del "resultado" del motor.
  function armarDevolucion(resultado, contexto){
    contexto = Object.assign({alias: 'estudiante'}, contexto);
    const {pct, nota10, aprobado, fortalezas, aRepasar, sugerencia} = resultado;

    const mensajePrincipal = aprobado
      ? `¡Bien, ${contexto.alias}! Obtuviste ${nota10}/10 (${pct}%).`
      : `Obtuviste ${nota10}/10 (${pct}%). Todavía no llegás al mínimo para aprobar.`;

    // Recomendaciones: derivadas del resultado, sin hardcodear nada de
    // ninguna materia. Se suman a la sugerencia general del motor.
    const recomendaciones = [];
    if (!aprobado && aRepasar.length){
      recomendaciones.push(`Repasá especialmente: ${aRepasar.slice(0,3).join(', ')}${aRepasar.length>3?'…':''}.`);
    }
    if (aprobado && fortalezas.length){
      recomendaciones.push('Ya podés avanzar al siguiente módulo cuando quieras.');
    }
    if (!aprobado){
      recomendaciones.push('Cada intento trae preguntas distintas — no vas a repetir exactamente lo mismo.');
    }
    recomendaciones.push(sugerencia);

    return {
      nota10, pct, aprobado,
      mensajePrincipal,
      fortalezas: fortalezas.slice(),
      aRepasar: aRepasar.slice(),
      recomendaciones,
    };
  }

  // ── Render genérico a HTML (string) ──
  // Clases neutras (origen-resultado-*), sin nada específico de
  // ninguna materia. Cada materia le pone su propio CSS encima.
  function renderHTML(devolucion){
    const { mensajePrincipal, aprobado, fortalezas, aRepasar, recomendaciones } = devolucion;
    let html = `<div class="origen-resultado ${aprobado?'origen-resultado-ok':'origen-resultado-pendiente'}">`;
    html += `<p class="origen-resultado-mensaje">${mensajePrincipal}</p>`;
    if (fortalezas.length){
      html += `<p class="origen-resultado-fortalezas"><strong>💪 Fortalezas:</strong> ${fortalezas.join(', ')}</p>`;
    }
    if (aRepasar.length){
      html += `<p class="origen-resultado-repasar"><strong>📖 Para repasar:</strong> ${aRepasar.join(', ')}</p>`;
    }
    if (recomendaciones.length){
      html += `<ul class="origen-resultado-recomendaciones">`;
      recomendaciones.forEach(r => { html += `<li>${r}</li>`; });
      html += `</ul>`;
    }
    html += `</div>`;
    return html;
  }

  // ── Conveniencia: arma Y pinta en un elemento del DOM ──
  function mostrarEn(elemento, resultado, contexto){
    const devolucion = armarDevolucion(resultado, contexto);
    if (elemento) elemento.innerHTML = renderHTML(devolucion);
    return devolucion;
  }

  return { armarDevolucion, renderHTML, mostrarEn };
})();
