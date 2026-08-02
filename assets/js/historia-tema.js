// ══════════════════════════════════════════
//  CARÁTULA DINÁMICA POR TEMA — Historia / ORIGEN
//  Lee ?tema=<slug> de la URL y arma la carátula
//  correspondiente. Misma data que historia.js
//  (se duplica acá porque tema.html no carga
//  historia.js, solo este archivo).
// ══════════════════════════════════════════

const TOPICS = [
  {slug:'edad-media', title:'Edad Media', desc:'Feudalismo, Iglesia y el poder fragmentado de Europa.', icon:'🏰', img:'../../assets/img/historia/edad-media.jpg', time:'40 min', available:true},
];

// Con un solo tema fijo el acento de color ya no varía por época:
// ERA_ACCENT (antes un mapa de 5 entradas, una por era) se simplificó
// a esta constante — es el mismo valor que ya resolvía para Edad Media.
const ACCENT = '#C9960C';

function getParam(name){
  return new URLSearchParams(window.location.search).get(name);
}

function renderCover(){
  const slug = getParam('tema');
  const topic = TOPICS.find(t => t.slug === slug);
  const box = document.getElementById('cover-box');

  if(!topic){
    box.innerHTML = `
      <div style="text-align:center;padding:3rem 1.5rem;">
        <p style="color:#EDEAE2;font-family:'Poppins',sans-serif;font-size:1rem;">
          No encontramos ese tema. <a href="index.html" style="color:#F0C840;">Volver a Historia →</a>
        </p>
      </div>`;
    return;
  }

  const hasImg = !!topic.img;

  const bgStyle = hasImg
    ? `background:linear-gradient(180deg, rgba(10,12,10,.35) 0%, rgba(10,12,10,.55) 45%, rgba(10,12,10,.88) 100%), url('${topic.img}') center/cover no-repeat;`
    : `background:radial-gradient(ellipse at center, #2a3b30 0%, #16201a 100%);`;
  box.style.cssText = `${bgStyle}border-radius:22px;padding:3.5rem 1.5rem;min-height:480px;display:flex;flex-direction:column;justify-content:flex-end;`;

  const iconFallback = hasImg ? '' : `<div style="font-size:4rem;text-align:center;margin-bottom:1.5rem;filter:drop-shadow(0 4px 12px rgba(0,0,0,.4));">${topic.icon}</div>`;

  const statusLabel = topic.available
    ? `<span style="color:#8FD9BE;">📖 Guía interactiva disponible</span>`
    : `<span style="color:#B9B4A6;">🔜 Próximamente</span>`;

  const ctaHtml = topic.available
    ? `<a href="${topic.slug}-guia.html" style="display:inline-block;background:linear-gradient(135deg,${ACCENT},#E8A800);color:#1C1008;font-family:'Poppins',sans-serif;font-weight:700;font-size:0.95rem;padding:0.85rem 2.2rem;border-radius:10px;text-decoration:none;box-shadow:0 6px 20px rgba(0,0,0,.35);">Comenzar la guía →</a>`
    : `<span style="display:inline-block;background:rgba(255,255,255,.08);color:#8A8577;font-family:'Poppins',sans-serif;font-weight:700;font-size:0.95rem;padding:0.85rem 2.2rem;border-radius:10px;">Guía en camino</span>`;

  box.innerHTML = `
    ${iconFallback}
    <div style="text-align:center;font-family:'Poppins',sans-serif;font-size:0.75rem;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:${ACCENT};margin-bottom:0.6rem;text-shadow:0 1px 6px rgba(0,0,0,.6);">
      Historia · Carátula temática
    </div>
    <h1 style="text-align:center;font-family:'Poppins',sans-serif;font-weight:800;font-size:clamp(2rem,6vw,3rem);color:#FAF7F0;margin-bottom:0.9rem;text-transform:uppercase;text-shadow:0 2px 10px rgba(0,0,0,.65);">
      ${topic.title}
    </h1>
    <p style="text-align:center;font-family:'Poppins',sans-serif;font-size:1rem;color:#E4E0D6;max-width:480px;margin:0 auto 1.3rem;line-height:1.5;text-shadow:0 1px 6px rgba(0,0,0,.6);">
      ${topic.desc}
    </p>
    <div style="text-align:center;font-family:'Poppins',sans-serif;font-size:0.85rem;color:#D8D4C8;margin-bottom:2rem;display:flex;gap:1.2rem;justify-content:center;align-items:center;flex-wrap:wrap;text-shadow:0 1px 6px rgba(0,0,0,.6);">
      <span>⏱ ${topic.time}</span>
      ${statusLabel}
    </div>
    <div style="text-align:center;">
      ${ctaHtml}
    </div>
  `;
}

renderCover();
