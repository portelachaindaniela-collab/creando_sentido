// ══════════════════════════════════════════════════════════
//  ORIGEN · Core · corrector-heuristico.js
//  Corrección heurística de preguntas de desarrollo, sin IA
//  (descartada por costo, decisión ya tomada para Edad Media).
//
//  Esta es la MISMA función gradeWritten() que ya vive en
//  edad-media-guia.html, extraída sin cambiar su comportamiento.
//  Cualquier materia nueva la reutiliza igual, pasando su propio
//  array de keywords por pregunta.
//
//  Criterios (idénticos a los originales):
//  - Menos de 4 palabras o 0 keywords encontradas → 0 puntos.
//  - >=55% de las keywords presentes Y desarrollo real (>=15
//    palabras) → 1 punto.
//  - Al menos 1 keyword presente (pero sin llegar al umbral de
//    arriba) → 0.5 puntos.
//  - Resto → 0 puntos.
// ══════════════════════════════════════════════════════════

function normalizeTexto(str) {
  return (str || '').toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, ''); // saca acentos
}

function gradeWritten(answerRaw, keywords) {
  const answer = normalizeTexto(answerRaw);
  const words = answer.trim().split(/\s+/).filter(Boolean);
  const hits = keywords.filter(kw => answer.includes(normalizeTexto(kw)));
  const hitRatio = hits.length / keywords.length;
  const developed = words.length >= 15; // desarrollo mínimo, no una frase suelta

  let points;
  if (words.length < 4 || hits.length === 0) {
    points = 0;
  } else if (hitRatio >= 0.55 && developed) {
    points = 1;
  } else if (hits.length >= 1) {
    points = 0.5;
  } else {
    points = 0;
  }
  return { points, hitCount: hits.length, total: keywords.length, wordCount: words.length };
}
