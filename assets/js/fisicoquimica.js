// ══════════════════════════════════════════
//  IDENTIDAD COMPARTIDA DE ORIGEN (alias + guía)
//  Exactas SÍ tiene guía (Pedro) — a diferencia de Historia hoy.
//  Usa storage.js del Core para no duplicar acceso a localStorage.
// ══════════════════════════════════════════
function renderGuideSlot(){
  const slot = document.getElementById('guide-slot');
  const topAvatar = document.getElementById('topbar-avatar');
  const { alias, guide } = getIdentity(); // Core: storage.js

  if(!alias){
    slot.innerHTML = `
      <div class="setup-card">
        <h4>¿Cómo te llamamos?</h4>
        <p>Elegí tu alias. Pedro te va a acompañar en Exactas.</p>
        <input type="text" id="setup-alias" placeholder="Tu alias" value="">
        <button class="btn-setup-save" onclick="saveSetup()">Guardar</button>
      </div>`;
    if (topAvatar) topAvatar.src = 'https://api.dicebear.com/9.x/avataaars/svg?seed=Origen-guest&backgroundColor=c49a3a,7a5d3a&radius=50';
    return;
  }

  if (topAvatar) topAvatar.src = 'https://api.dicebear.com/9.x/avataaars/svg?seed=Pedro-Origen&backgroundColor=c49a3a,7a5d3a&radius=50';
  slot.innerHTML = `
    <div class="guide-card">
      <h4>Pedro te acompaña</h4>
      <div class="guide-card-body"><div><div class="guide-card-name">Hola, ${alias}</div><div class="guide-card-msg">¿Vemos un módulo hoy?</div></div></div>
      <button class="btn-guide" onclick="document.getElementById('topics-grid').scrollIntoView({behavior:'smooth'})">Elegir un módulo</button>
    </div>`;
}

function saveSetup(){
  const val = document.getElementById('setup-alias').value.trim();
  if(!val){ document.getElementById('setup-alias').focus(); return; }
  setIdentity(val, 'pedro'); // Core: storage.js — Exactas siempre usa a Pedro como guía
  renderGuideSlot();
}

// ══════════════════════════════════════════
//  MÓDULOS DE FISICOQUÍMICA (contenido real de Valentina,
//  reorganizado al formato TOPICS[] + tema.html?tema=slug)
// ══════════════════════════════════════════
const TOPICS = [
  {slug:'mezclas-y-sistemas', title:'Mezclas y Sistemas', icon:'🧪', desc:'4 módulos: Homogéneos, Heterogéneos, Fases y Métodos de Separación.', time:'~2.5 hs', available:true, href:'mezclas-sistemas-guia.html', modulos:4},
];

function renderTopics(){
  const grid = document.getElementById('topics-grid');
  const progress = getMateriaProgress('fisicoquimica'); // Core: storage.js
  grid.innerHTML = TOPICS.map((t,i)=>{
    const pct = progress[t.slug] || 0;
    const statusLabel = t.available ? '📖 Disponible' : '🔜 Próximamente';
    const statusClass = t.available ? 'available' : 'soon';
    const btnLabel = t.available ? 'Comenzar' : 'Ver carátula';
    return `
    <div class="topic-card" onclick="goToTopic('${t.slug}')">
      <div class="topic-visual" style="background:linear-gradient(135deg, var(--verde), var(--verde2));position:relative;">
        <span class="topic-num">TEMA ${String(i+1).padStart(2,'0')}</span>
        ${t.icon}
      </div>
      <div class="topic-body">
        <div class="topic-title" style="text-transform:uppercase;">${t.title}</div>
        <div class="topic-desc">${t.desc}</div>
        <div class="topic-meta"><span>⏱ ${t.time}</span><span class="topic-status ${statusClass}">${statusLabel}</span></div>
        <div class="topic-bar-wrap"><div class="topic-bar" style="width:${pct}%;"></div></div>
        <button class="topic-btn ${t.available?'':'soon'}" onclick="event.stopPropagation(); goToTopic('${t.slug}')">${btnLabel} →</button>
      </div>
    </div>`;
  }).join('');
  document.getElementById('topics-count').textContent = TOPICS.length + ' tema';
}

function goToTopic(slug){
  window.location.href = `tema.html?tema=${slug}`;
}

// El dibujo del anillo vive en Core: progreso-ring.js (compartido con
// Historia). Acá se arma la lista de slugs por MÓDULO (no por tema —
// hoy hay un solo tema, pero varios módulos adentro) a partir de
// "modulos" declarado en cada TOPIC, y se le pasa el progreso ya leído.
function renderFisicoquimicaProgressRing(){
  const progreso = getMateriaProgress('fisicoquimica');
  const slugs = [];
  TOPICS.forEach(t=>{
    for(let i=0;i<(t.modulos||0);i++) slugs.push(`${t.slug}-cap-${i}`);
  });
  renderProgressRing({slugs, progreso, unidadLabel: 'módulos'});
}

function toggleSidebar(){
  const el = document.getElementById('sidebar-collapsible');
  const btn = document.getElementById('sidebar-toggle');
  const isOpen = el.classList.toggle('open');
  btn.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
  btn.textContent = isOpen ? '✕' : '☰';
}

// ══════════════════════════════════════════
//  INIT
// ══════════════════════════════════════════
renderGuideSlot();
renderTopics();
renderFisicoquimicaProgressRing();
