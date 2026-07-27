// ══════════════════════════════════════════════════════════
//  ORIGEN · Core · evaluacion-motor.js
//
//  Motor de evaluación genérico. No conoce materias, temas ni
//  slugs — solo trabaja con la estructura de datos "banco" que
//  le pasa quien lo llama (hoy: Historia/Edad Media; mañana:
//  Fisicoquímica, Biología, Matemática, etc.).
//
//  Requiere que ../../core/js/corrector-heuristico.js ya esté
//  cargado (usa su función gradeWritten para las de desarrollo).
//
//  ── CONTRATO DE DATOS DE ENTRADA ("banco") ──
//  Un array de secciones/módulos, cada una:
//    {
//      nombre: 'Feudalismo',              // string libre, solo para mostrar
//      mc: [                              // banco de objetivas
//        { q:'...', opts:['a','b','c','d'], ans:1, hint?:'...' }, ...
//      ],
//      desarrollo: [                      // banco de desarrollo
//        { q:'...', keywords:['...','...'], concept:'...', hint?:'...' }, ...
//      ]
//    }
//
//  No importa si esa sección se llama "capítulo", "unidad" o
//  "tema": el motor solo lee mc[], desarrollo[] y nombre.
// ══════════════════════════════════════════════════════════

const EvaluacionMotor = (function(){

  // ── Aleatoriedad (igual que el original, sin cambios de comportamiento) ──
  function shuffleArray(arr){
    const a = arr.slice();
    for(let i=a.length-1;i>0;i--){
      const j = Math.floor(Math.random()*(i+1));
      [a[i],a[j]]=[a[j],a[i]];
    }
    return a;
  }

  function pickRandom(arr, n){
    return shuffleArray(arr).slice(0, Math.min(n, arr.length));
  }

  // Elige índices únicos de un banco, evitando repetir los ya usados
  // (usedSet). Se usa para armar el examen final sin duplicar preguntas.
  function pickIndices(total, n, usedSet){
    const avail = [];
    for(let i=0;i<total;i++) if(!usedSet.has(i)) avail.push(i);
    const chosen = pickRandom(avail, n);
    chosen.forEach(i=>usedSet.add(i));
    return chosen;
  }

  // Baraja las opciones de una objetiva y recalcula el índice correcto.
  // Preserva cualquier campo extra que traiga la pregunta (concept,
  // dificultad, modulo, tema — punto 10 de la revisión funcional de
  // Fisicoquímica) en vez de reconstruir el objeto desde cero: así
  // ninguna materia pierde datos de etiquetado por el solo hecho de
  // pasar por el barajado.
  function shuffleMC(q){
    const order = shuffleArray(q.opts.map((_,i)=>i));
    return {
      ...q,
      type:'mc', q:q.q,
      opts: order.map(i=>q.opts[i]),
      ans: order.indexOf(q.ans),
      hint: q.hint
    };
  }

  // ── Armado de la evaluación de una sección ──
  // Config por defecto: 5 preguntas por módulo → 3 objetivas + 2 de
  // desarrollo (lo pedido). Se puede ajustar por si otra materia
  // necesita otra distribución, sin tocar el motor.
  function armarQuizSeccion(banco, seccionIdx, config){
    config = Object.assign({mc:3, desarrollo:2}, config);
    const seccion = banco[seccionIdx];
    const mcPicked = pickRandom(seccion.mc, config.mc).map(shuffleMC);
    const wPicked  = pickRandom(seccion.desarrollo, config.desarrollo)
      .map(q => ({...q, type:'desarrollo'}));
    return {
      seccionIdx,
      nombreSeccion: seccion.nombre,
      items: [...mcPicked, ...wPicked],
    };
  }

  // ── Corrección de la evaluación de una sección ──
  // respuestas: { mc: {itemIdx: optIdx}, desarrollo: {itemIdx: texto} }
  // (itemIdx es la posición dentro de items[], no del banco original)
  function corregirQuizSeccion(items, respuestas, config){
    config = Object.assign({umbralAprobacion:70}, config);
    let puntos = 0;
    const maxPuntos = items.reduce((m,q)=>m+(q.type==='mc'?0.5:1), 0);
    const fortalezas = [];
    const aRepasar = [];
    const detalle = [];

    items.forEach((q,i)=>{
      // Etiquetado (punto 10): si la pregunta trae estos campos, viajan
      // al detalle de corrección — hoy los usa Fisicoquímica, cualquier
      // otra materia que no los tenga simplemente no los completa.
      const etiquetas = {modulo:q.modulo, tema:q.tema, dificultad:q.dificultad};
      if(q.type==='mc'){
        const elegido = respuestas.mc ? respuestas.mc[i] : undefined;
        const correcto = elegido===q.ans;
        if(correcto){ puntos+=0.5; fortalezas.push(q.opts[q.ans]); }
        else { aRepasar.push(q.opts[q.ans]); }
        detalle.push({idx:i, type:'mc', correcto, elegido, correctIdx:q.ans, puntos: correcto?0.5:0, concept:q.concept, ...etiquetas});
      } else {
        const texto = respuestas.desarrollo ? (respuestas.desarrollo[i]||'') : '';
        const g = gradeWritten(texto, q.keywords); // Core: corrector-heuristico.js
        puntos += g.points;
        if(g.points>=1) fortalezas.push(q.concept);
        else aRepasar.push(q.concept);
        detalle.push({idx:i, type:'desarrollo', puntos:g.points, concept:q.concept, hitCount:g.hitCount, total:g.total, wordCount:g.wordCount, ...etiquetas});
      }
    });

    const pct = Math.round((puntos/maxPuntos)*100);
    const nota10 = Math.round((puntos/maxPuntos)*10*2)/2; // redondeo a 0.5
    const aprobado = pct >= config.umbralAprobacion;

    return {
      puntos, maxPuntos, pct, nota10, aprobado,
      fortalezas: [...new Set(fortalezas)],
      aRepasar: [...new Set(aRepasar)],
      sugerencia: aprobado
        ? '¡Bien! Cada intento trae preguntas distintas, podés seguir practicando si querés.'
        : 'Releé los conceptos marcados para repasar antes de reintentar — cada intento trae preguntas distintas.',
      detalle,
    };
  }

  // ── Armado del examen final ──
  // Config por defecto: 10 objetivas + 5 desarrollo, nota máxima 10
  // (2 obj + 1 desarrollo por sección, más 2 obj y 1 desarrollo extra
  // al azar entre todas las secciones — igual que el original).
  function armarExamenFinal(banco, config){
    config = Object.assign({
      mcPorSeccion: 2, desarrolloPorSeccion: 1,
      mcExtra: 2, desarrolloExtra: 1
    }, config);

    const n = banco.length;
    const usedMc = banco.map(()=> new Set());
    const usedW  = banco.map(()=> new Set());
    let objPool = [], writtenPool = [];

    for(let s=0; s<n; s++){
      pickIndices(banco[s].mc.length, config.mcPorSeccion, usedMc[s]).forEach(i=>{
        objPool.push({...shuffleMC(banco[s].mc[i]), nombreSeccion: banco[s].nombre});
      });
      pickIndices(banco[s].desarrollo.length, config.desarrolloPorSeccion, usedW[s]).forEach(i=>{
        writtenPool.push({...banco[s].desarrollo[i], type:'desarrollo', nombreSeccion: banco[s].nombre});
      });
    }
    for(let k=0;k<config.mcExtra;k++){
      const s = Math.floor(Math.random()*n);
      pickIndices(banco[s].mc.length, 1, usedMc[s]).forEach(i=>{
        objPool.push({...shuffleMC(banco[s].mc[i]), nombreSeccion: banco[s].nombre});
      });
    }
    for(let k=0;k<config.desarrolloExtra;k++){
      const s = Math.floor(Math.random()*n);
      pickIndices(banco[s].desarrollo.length, 1, usedW[s]).forEach(i=>{
        writtenPool.push({...banco[s].desarrollo[i], type:'desarrollo', nombreSeccion: banco[s].nombre});
      });
    }

    return shuffleArray([...objPool, ...writtenPool]);
  }

  // ── Corrección del examen final ──
  // Misma firma que corregirQuizSeccion, sobre el array del examen.
  function corregirExamenFinal(examen, respuestas, config){
    config = Object.assign({umbralAprobacion:70}, config);
    const resultado = corregirQuizSeccion(examen, respuestas, config);
    return resultado; // misma forma: {puntos, maxPuntos, pct, nota10, aprobado, fortalezas, aRepasar, sugerencia, detalle}
  }

  // ── Persistencia del intento (Core: storage.js) ──
  // "clave" la arma quien llama (ej: `${materia}:${temaSlug}:${seccionIdx}`
  // o `${materia}:${temaSlug}:final`). El motor no impone ningún formato
  // de slug ni nombre de materia — es un string opaco para él.
  function guardarIntento(clave, estado){
    return setEvaluacionJSON('origenIntento:' + clave, estado); // helper local, ver abajo
  }
  function restaurarIntento(clave){
    return getEvaluacionJSON('origenIntento:' + clave, null);
  }
  function borrarIntento(clave){
    try { localStorage.removeItem('origenIntento:' + clave); return true; }
    catch(e){ return false; }
  }

  // Estas dos usan safeGet/safeSet del Core (storage.js) si están
  // disponibles; si no, degradan a no-op sin romper nada.
  function setEvaluacionJSON(key, obj){
    if(typeof safeSetJSON === 'function') return safeSetJSON(key, obj);
    try { localStorage.setItem(key, JSON.stringify(obj)); return true; } catch(e){ return false; }
  }
  function getEvaluacionJSON(key, fallback){
    if(typeof safeGetJSON === 'function') return safeGetJSON(key, fallback);
    try { return JSON.parse(localStorage.getItem(key) || 'null') ?? fallback; } catch(e){ return fallback; }
  }

  return {
    armarQuizSeccion, corregirQuizSeccion,
    armarExamenFinal, corregirExamenFinal,
    guardarIntento, restaurarIntento, borrarIntento,
    // expuestos por si una materia necesita construir variantes propias
    shuffleArray, pickRandom, pickIndices, shuffleMC,
  };
})();
