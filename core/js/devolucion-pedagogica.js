// ══════════════════════════════════════════════════════════
//  ORIGEN · Core · devolucion-pedagogica.js
//
//  A partir del "detalle" que ya arma EvaluacionMotor.corregir*
//  (con concept/modulo/tema/dificultad, gracias al etiquetado del
//  banco — ver punto 10 de la revisión funcional), genera:
//
//   - una frase de orientación pedagógica por pregunta (punto 5),
//     nunca revelando la respuesta correcta en las de desarrollo;
//   - una clasificación Bien / A revisar / Necesita refuerzo por
//     tema, más fortalezas/conceptos a repasar/recomendaciones
//     (punto 9).
//
//  100% agnóstico de materia: no importa si el "tema" es un módulo
//  de Fisicoquímica o un capítulo de Historia — solo lee los campos
//  que ya vienen en el detalle.
// ══════════════════════════════════════════════════════════

const DevolucionPedagogica = (function(){

  // Frase de orientación para UNA pregunta ya corregida.
  // - Objetivas: si está mal, nombra el concepto a revisar (la opción
  //   correcta ya se resalta visualmente aparte — eso no es "dar la
  //   respuesta de desarrollo", es la devolución estándar de opción
  //   múltiple).
  // - Desarrollo: NUNCA se revela una respuesta modelo. Se orienta
  //   según el patrón de la respuesta (vacía/corta, tangencial, o
  //   simplemente incompleta) — igual que los ejemplos del punto 5.
  function orientacionItem(d){
    const concepto = d.concept || 'este concepto';
    if(d.type === 'mc'){
      return d.correcto
        ? '✅ Correcto.'
        : `Conviene revisar el concepto de "${concepto}".`;
    }
    // desarrollo
    if(d.puntos >= 1){
      return `✅ Buen desarrollo del concepto de "${concepto}".`;
    }
    if(d.puntos >= 0.5){
      return `La respuesta menciona conceptos relacionados, pero no responde exactamente lo que preguntaba la consigna. Conviene repasar "${concepto}".`;
    }
    if((d.wordCount||0) < 4){
      return `Faltó explicar cómo se desarrolló el proceso. Conviene repasar "${concepto}" antes de reintentar.`;
    }
    return `La respuesta no llega a cubrir los conceptos centrales de la consigna. Conviene revisar "${concepto}".`;
  }

  // Agrupa el detalle por tema (o módulo si no hay tema) y clasifica
  // cada grupo según el % de puntos obtenidos ahí.
  //   >=80% → 'bien'   |   >=50% → 'a-revisar'   |   resto → 'refuerzo'
  function clasificarPorTema(detalle){
    const grupos = {};
    (detalle||[]).forEach(d=>{
      const key = d.tema || d.modulo || 'General';
      if(!grupos[key]) grupos[key] = {puntos:0, max:0};
      grupos[key].puntos += (d.puntos!==undefined ? d.puntos : (d.correcto?0.5:0));
      grupos[key].max += (d.type==='mc' ? 0.5 : 1);
    });
    const clasificacion = {};
    Object.keys(grupos).forEach(tema=>{
      const g = grupos[tema];
      const ratio = g.max>0 ? g.puntos/g.max : 0;
      clasificacion[tema] = ratio>=0.8 ? 'bien' : (ratio>=0.5 ? 'a-revisar' : 'refuerzo');
    });
    return clasificacion;
  }

  // Arma el desglose completo (punto 9): temas por categoría,
  // conceptos a repasar (deduplicados) y recomendaciones de estudio.
  function desglosarResultado(detalle){
    detalle = detalle || [];
    const porTema = clasificarPorTema(detalle);
    const temasBien = [], temasARevisar = [], temasRefuerzo = [];
    Object.keys(porTema).forEach(t=>{
      if(porTema[t]==='bien') temasBien.push(t);
      else if(porTema[t]==='a-revisar') temasARevisar.push(t);
      else temasRefuerzo.push(t);
    });

    const conceptosARepasar = [...new Set(
      detalle
        .filter(d => (d.puntos!==undefined ? d.puntos<1 : !d.correcto))
        .map(d => d.concept)
        .filter(Boolean)
    )];

    const recomendaciones = [];
    temasRefuerzo.forEach(t=> recomendaciones.push(`Te recomendamos releer el contenido de "${t}" antes de volver a intentar.`));
    temasARevisar.forEach(t=> recomendaciones.push(`Vas bien encaminado en "${t}" — repasá los conceptos marcados para afianzarlo.`));
    if(!temasRefuerzo.length && !temasARevisar.length && temasBien.length){
      recomendaciones.push('¡Buen dominio general de los temas evaluados! Podés seguir practicando con nuevos intentos si querés.');
    }

    return {
      temasBien, temasARevisar, temasRefuerzo,
      conceptosARepasar,
      recomendaciones,
      itemsConOrientacion: detalle.map(d => Object.assign({}, d, {orientacion: orientacionItem(d)})),
    };
  }

  return { orientacionItem, clasificarPorTema, desglosarResultado };
})();
