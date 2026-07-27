
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
function renderProgressRing(){
  const progress = getProgress();
  const values = TOPICS.map(t => progress[t.slug] || 0);
  const avgPct = Math.round(values.reduce((a,b)=>a+b,0) / TOPICS.length);
  const doneCount = values.filter(v=>v>=100).length;

  const circumference = 264; // 2 * PI * 42, redondeado
  const offset = circumference - (circumference * avgPct/100);
  document.getElementById('progress-circle').style.strokeDashoffset = offset;
  document.getElementById('progress-pct').textContent = avgPct + '%';
  document.getElementById('progress-sub').textContent = `${doneCount} de ${TOPICS.length} temas completados`;
}

// ══════════════════════════════════════════
//  TEMAS DE HISTORIA (ahora 19: se sumaron Segunda Revolución
//  Industrial, Independencia Argentina, Guerra de los Balcanes y
//  Guerras Yugoslavas; se sacó el "Balcanes" genérico)
//  Solo "Edad Media" tiene guía interactiva real hoy;
//  el resto ya tiene su carátula temática lista y queda
//  preparado para sumar la experiencia progresivamente.
// ══════════════════════════════════════════
const TOPICS = [
  {slug:'prehistoria',        title:'Prehistoria',              desc:'Los primeros seres humanos, el fuego y el comienzo de todo.', icon:'🔥', img:'../../assets/img/historia/prehistoria.jpg', time:'25 min', available:false},
  {slug:'mesopotamia',        title:'Mesopotamia',              desc:'Entre el Tigris y el Éufrates: la escritura y las primeras ciudades.', icon:'𓉢', img:'../../assets/img/historia/mesopotamia.jpg', time:'30 min', available:false},
  {slug:'egipto',             title:'Antiguo Egipto',           desc:'Faraones, pirámides y una civilización que dejó huella para siempre.', icon:'𓂀', img:'../../assets/img/historia/egipto.jpg', time:'30 min', available:false},
  {slug:'grecia',             title:'Grecia Clásica',           desc:'Filosofía, democracia y los orígenes de nuestra cultura.', icon:'🏛️', img:'../../assets/img/historia/grecia.jpg', time:'35 min', available:false},
  {slug:'roma',               title:'Imperio Romano',           desc:'El imperio que transformó el mundo y su legado en Occidente.', icon:'🦅', img:'../../assets/img/historia/roma.jpg', time:'35 min', available:false},
  {slug:'edad-media',         title:'Edad Media',               desc:'Feudalismo, Iglesia y el poder fragmentado de Europa.', icon:'🏰', img:'../../assets/img/historia/edad-media.jpg', time:'40 min', available:true},
  {slug:'imperio-otomano',    title:'Imperio Otomano',          desc:'Seis siglos de expansión entre Europa, Asia y África.', icon:'☪️', img:'../../assets/img/historia/imperio-otomano.jpg', time:'30 min', available:false},
  {slug:'revolucion-francesa',title:'Revolución Francesa',      desc:'Libertad, igualdad y fraternidad: las ideas que cambiaron el mundo.', icon:'⚜️', img:'../../assets/img/historia/revolucion-francesa.jpg', time:'30 min', available:false},
  {slug:'revolucion-industrial',title:'Revolución Industrial',  desc:'La máquina, las fábricas y el inicio del mundo moderno.', icon:'⚙️', img:'../../assets/img/historia/revolucion-industrial.jpg', time:'30 min', available:false},
  {slug:'segunda-revolucion-industrial', title:'Segunda Revolución Industrial', desc:'Electricidad, telégrafo y una nueva ola de innovación tecnológica.', icon:'💡', img:'../../assets/img/historia/segunda-revolucion-industrial.jpg', time:'30 min', available:false},
  {slug:'primera-guerra',     title:'Primera Guerra Mundial',   desc:'El conflicto que redibujó el mapa del siglo XX.', icon:'⚔️', img:'../../assets/img/historia/primera-guerra.jpg', time:'35 min', available:false},
  {slug:'revolucion-rusa',    title:'Revolución Rusa',          desc:'El fin de los zares y el nacimiento de la Unión Soviética.', icon:'☭', img:'../../assets/img/historia/revolucion-rusa.jpg', time:'30 min', available:false},
  {slug:'segunda-guerra',     title:'Segunda Guerra Mundial',   desc:'El conflicto más grande de la historia y sus consecuencias.', icon:'🌍', img:'../../assets/img/historia/segunda-guerra.jpg', time:'40 min', available:false},
  {slug:'guerra-fria',        title:'Guerra Fría',              desc:'Dos bloques, una tensión global que duró décadas.', icon:'🧊', img:'../../assets/img/historia/guerra-fria.jpg', time:'30 min', available:false},
  {slug:'independencia-argentina', title:'Independencia Argentina', desc:'El proceso que llevó a la Declaración de la Independencia en 1816.', icon:'📜', img:'../../assets/img/historia/independencia-argentina.jpg', time:'30 min', available:false},
  {slug:'historia-argentina', title:'Historia Argentina',       desc:'De la independencia a la democracia: nuestro propio recorrido.', icon:'🇦🇷', img:'../../assets/img/historia/historia-argentina.jpg', time:'40 min', available:false},
  {slug:'guerra-balcanes',    title:'Guerra de los Balcanes',   desc:'Los conflictos de 1912-1913 que anticiparon la Primera Guerra Mundial.', icon:'🗺️', img:'../../assets/img/historia/guerra-balcanes.jpg', time:'25 min', available:false},
  {slug:'guerras-yugoslavas', title:'Guerras Yugoslavas',       desc:'La desintegración violenta de Yugoslavia entre 1991 y 2001.', icon:'🕊️', img:'../../assets/img/historia/guerras-yugoslavas.jpg', time:'30 min', available:false},
  {slug:'globalizacion',      title:'Globalización',            desc:'Un mundo cada vez más conectado, y sus desafíos actuales.', icon:'🌐', img:'../../assets/img/historia/globalizacion.jpg', time:'25 min', available:false},
];

function renderTopics(){
  const grid = document.getElementById('topics-grid');
  const progress = getProgress();
  grid.innerHTML = TOPICS.map((t,i)=>{
    const pct = progress[t.slug] || 0;
    const statusLabel = t.available ? '📖 Disponible' : '🔜 Próximamente';
    const statusClass = t.available ? 'available' : 'soon';
    const btnLabel = t.available ? 'Comenzar' : 'Ver carátula';
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
        <div class="topic-meta"><span>⏱ ${t.time}</span><span class="topic-status ${statusClass}">${statusLabel}</span></div>
        <div class="topic-bar-wrap"><div class="topic-bar" style="width:${pct}%;"></div></div>
        <button class="topic-btn ${t.available?'':'soon'}" onclick="event.stopPropagation(); goToTopic('${t.slug}')">${btnLabel} →</button>
      </div>
    </div>`;
  }).join('');
  document.getElementById('topics-count').textContent = TOPICS.length + ' temas';
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
renderProgressRing();
