
// ══════════════════════════════════════════
//  IDENTIDAD COMPARTIDA DE ORIGEN (solo alias, por ahora)
//  Historia todavía no tiene personaje-guía: solo lo tienen las
//  materias de Exactas (Pedro). Por eso acá solo se pide y guarda
//  el alias — no se toca la clave 'origenGuide', que es global y
//  la va a usar Exactas sin que Historia la pise.
// ══════════════════════════════════════════
function avatarUrl(seed){
  return `https://api.dicebear.com/9.x/avataaars/svg?seed=${encodeURIComponent(seed)}&backgroundColor=c49a3a,7a5d3a&radius=50`;
}

// localStorage puede no estar disponible (orígenes "opacos": preview en
// sandbox, ciertos file://, modo privado estricto, etc.). Si tira error,
// no debe frenar el resto del script — seguimos sin recordar nada.
function safeGet(key){ try{ return localStorage.getItem(key); }catch(e){ return null; } }
function safeSet(key,val){ try{ localStorage.setItem(key,val); return true; }catch(e){ return false; } }

let alias = safeGet('origenAlias') || safeGet('origenHistoriaAlias') || '';

function persistIdentity(){
  safeSet('origenAlias', alias);
  // compatibilidad con la guía de Edad Media, que ya usa esta clave
  safeSet('origenHistoriaAlias', alias);
}

function renderGuideSlot(){
  const slot = document.getElementById('guide-slot');
  const topAvatar = document.getElementById('topbar-avatar');

  if(!alias){
    // Primera vez: solo pedimos alias, con una tarjeta chica, no un modal invasivo
    slot.innerHTML = `
      <div class="setup-card">
        <h4>¿Cómo te llamamos?</h4>
        <p>Elegí tu alias. Se recuerda en toda la plataforma.</p>
        <input type="text" id="setup-alias" placeholder="Tu alias" value="${alias}">
        <button class="btn-setup-save" onclick="saveSetup()">Guardar</button>
      </div>`;
    topAvatar.src = avatarUrl('Origen-guest');
    return;
  }

  topAvatar.src = avatarUrl('Origen-Historia');
  slot.innerHTML = `
    <div class="guide-card">
      <h4>Hola, ${alias}</h4>
      <div class="guide-card-body">
        <div class="guide-card-name">¿Explorás un nuevo tema hoy?</div>
      </div>
      <button class="btn-guide" onclick="document.getElementById('topics-grid').scrollIntoView({behavior:'smooth'})">Elegir un tema</button>
    </div>`;
}

function saveSetup(){
  const val = document.getElementById('setup-alias').value.trim();
  if(!val){ document.getElementById('setup-alias').focus(); return; }
  alias = val;
  persistIdentity();
  renderGuideSlot();
}

// ══════════════════════════════════════════
//  PROGRESO (real, sin inventar números).
//  Se guarda como { slug: pctCompletado } en localStorage.
//  Por ahora arranca en 0 salvo que ya exista progreso guardado.
// ══════════════════════════════════════════
function getProgress(){
  try{ return JSON.parse(safeGet('origenHistoriaProgress') || '{}'); }
  catch(e){ return {}; }
}
// El dibujo del anillo en sí vive en Core: progreso-ring.js (compartido
// con Fisicoquímica).
function renderHistoriaProgressRing(){
  const unidad = TOPICS.length===1 ? 'tema' : 'temas';
  renderProgressRing({slugs: TOPICS.map(t=>t.slug), progreso: getProgress(), unidadLabel: unidad});
}

// ══════════════════════════════════════════
//  TEMAS DE HISTORIA — hoy solo "Edad Media" tiene guía interactiva
//  real; el resto de la colección se retiró del listado hasta que
//  tengan su experiencia propia.
// ══════════════════════════════════════════
const TOPICS = [
  {slug:'edad-media', title:'Edad Media', desc:'Feudalismo, Iglesia y el poder fragmentado de Europa.', icon:'🏰', img:'../../assets/img/historia/edad-media.jpg', time:'40 min'},
];

function renderTopicsGrid(list){
  const grid = document.getElementById('topics-grid');
  const progress = getProgress();
  grid.innerHTML = list.map((t,i)=>{
    const pct = progress[t.slug] || 0;
    const hasImg = !!t.img;
    const visualStyle = hasImg
      ? `background:url('${t.img}') center/cover no-repeat;`
      : `background:linear-gradient(135deg, var(--verde), var(--verde2));`;
    return `
    <div class="topic-card" onclick="goToTopic('${t.slug}')">
      <div class="topic-visual" style="${visualStyle}position:relative;">
        <span class="topic-num" style="${hasImg?'text-shadow:0 1px 4px rgba(0,0,0,.85);':''}">TEMA ${String(i+1).padStart(2,'0')}</span>
        ${hasImg ? '' : t.icon}
      </div>
      <div class="topic-body">
        <div class="topic-title" style="text-transform:uppercase;">${t.title}</div>
        <div class="topic-desc">${t.desc}</div>
        <div class="topic-meta"><span>⏱ ${t.time}</span><span class="topic-status available">📖 Disponible</span></div>
        <div class="topic-bar-wrap"><div class="topic-bar" style="width:${pct}%;"></div></div>
        <button class="topic-btn" onclick="event.stopPropagation(); goToTopic('${t.slug}')">Comenzar →</button>
      </div>
    </div>`;
  }).join('');
}

function renderTopics(){
  renderTopicsGrid(TOPICS);
  document.getElementById('topics-count').textContent = TOPICS.length + (TOPICS.length===1 ? ' tema' : ' temas');
}

// Compara sin importar mayúsculas/acentos (normaliza a NFD y saca
// los diacríticos), para que "edad media" o "EDAD MÉDIA" matcheen igual.
function normalizarTexto(str){
  return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

function buscarTopics(query){
  const grid = document.getElementById('topics-grid');
  const q = normalizarTexto(query.trim());
  if(!q){ renderTopicsGrid(TOPICS); return; }
  const filtrados = TOPICS.filter(t =>
    normalizarTexto(t.title).includes(q) || normalizarTexto(t.desc).includes(q)
  );
  if(filtrados.length === 0){
    grid.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:3rem 1.5rem;">
      <p style="color:#EDEAE2;font-family:'Poppins',sans-serif;font-size:1rem;">No encontramos temas para "${query.trim()}"</p>
    </div>`;
    return;
  }
  renderTopicsGrid(filtrados);
}

function goToTopic(slug){
  window.location.href = `tema.html?tema=${slug}`;
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
renderHistoriaProgressRing();
