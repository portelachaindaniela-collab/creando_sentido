// ══════════════════════════════════════════════════════════
//  ORIGEN · Core · progreso-ring.js
//
//  Dibuja el anillo de progreso del sidebar (círculo + % + texto
//  "X de Y ___ completados"). Antes esto vivía duplicado solo en
//  historia.js — Fisicoquímica nunca tuvo su propia versión, por
//  eso su anillo quedaba siempre en 0%.
//
//  100% agnóstico de materia: no sabe qué es un "tema" ni un
//  "módulo" — solo recibe una lista de porcentajes (0-100) y la
//  etiqueta a mostrar ("temas", "módulos"). Quien llama decide
//  qué slugs de localStorage corresponden a esa lista.
// ══════════════════════════════════════════════════════════

// config: {
//   slugs:       array de claves de progreso a promediar,
//   progreso:    objeto {slug: pct} (ya leído por quien llama),
//   unidadLabel: string libre para el texto (ej. 'temas', 'módulos'),
// }
function renderProgressRing(config){
  const slugs = config.slugs || [];
  const progreso = config.progreso || {};
  const values = slugs.map(slug => progreso[slug] || 0);
  const avgPct = values.length ? Math.round(values.reduce((a,b)=>a+b,0) / values.length) : 0;
  const doneCount = values.filter(v=>v>=100).length;

  const circumference = 264; // 2 * PI * 42, redondeado (mismo valor que ya usaba Historia)
  const offset = circumference - (circumference * avgPct/100);
  document.getElementById('progress-circle').style.strokeDashoffset = offset;
  document.getElementById('progress-pct').textContent = avgPct + '%';
  document.getElementById('progress-sub').textContent = `${doneCount} de ${values.length} ${config.unidadLabel} completados`;
}
