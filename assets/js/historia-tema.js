// ══════════════════════════════════════════
//  CARÁTULA DINÁMICA POR TEMA — Historia / ORIGEN
//  Lee ?tema=<slug> de la URL y arma la carátula
//  correspondiente. Misma data que historia.js
//  (se duplica acá porque tema.html no carga
//  historia.js, solo este archivo).
// ══════════════════════════════════════════

const TOPICS = [
  {slug:'prehistoria',          title:'Prehistoria',            desc:'Los primeros seres humanos, el fuego y el comienzo de todo.', icon:'🔥', img:'../../assets/img/historia/prehistoria.jpg',          time:'25 min', available:false, era:'Prehistoria'},
  {slug:'mesopotamia',          title:'Mesopotamia',            desc:'Entre el Tigris y el Éufrates: la escritura y las primeras ciudades.', icon:'𓉢', img:'../../assets/img/historia/mesopotamia.jpg',          time:'30 min', available:false, era:'Antigüedad'},
  {slug:'egipto',                title:'Antiguo Egipto',         desc:'Faraones, pirámides y una civilización que dejó huella para siempre.', icon:'𓂀', img:'../../assets/img/historia/egipto.jpg',               time:'30 min', available:false, era:'Antigüedad'},
  {slug:'grecia',                title:'Grecia Clásica',         desc:'Filosofía, democracia y los orígenes de nuestra cultura.', icon:'🏛️', img:'../../assets/img/historia/grecia.jpg',               time:'35 min', available:false, era:'Antigüedad'},
  {slug:'roma',                  title:'Imperio Romano',         desc:'El imperio que transformó el mundo y su legado en Occidente.', icon:'🦅', img:'../../assets/img/historia/roma.jpg',                 time:'35 min', available:false, era:'Antigüedad'},
  {slug:'edad-media',            title:'Edad Media',             desc:'Feudalismo, Iglesia y el poder fragmentado de Europa.', icon:'🏰', img:'../../assets/img/historia/edad-media.jpg',           time:'40 min', available:true,  era:'Edad Media'},
  {slug:'imperio-otomano',       title:'Imperio Otomano',        desc:'Seis siglos de expansión entre Europa, Asia y África.', icon:'☪️', img:'../../assets/img/historia/imperio-otomano.jpg',      time:'30 min', available:false, era:'Edad Media'},
  {slug:'revolucion-francesa',   title:'Revolución Francesa',    desc:'Libertad, igualdad y fraternidad: las ideas que cambiaron el mundo.', icon:'⚜️', img:'../../assets/img/historia/revolucion-francesa.jpg',  time:'30 min', available:false, era:'Edad Moderna'},
  {slug:'revolucion-industrial', title:'Revolución Industrial',  desc:'La máquina, las fábricas y el inicio del mundo moderno.', icon:'⚙️', img:'../../assets/img/historia/revolucion-industrial.jpg', time:'30 min', available:false, era:'Edad Moderna'},
  {slug:'segunda-revolucion-industrial', title:'Segunda Revolución Industrial', desc:'Electricidad, telégrafo y una nueva ola de innovación tecnológica.', icon:'💡', img:'../../assets/img/historia/segunda-revolucion-industrial.jpg', time:'30 min', available:false, era:'Edad Contemporánea'},
  {slug:'primera-guerra',        title:'Primera Guerra Mundial', desc:'El conflicto que redibujó el mapa del siglo XX.', icon:'⚔️', img:'../../assets/img/historia/primera-guerra.jpg', time:'35 min', available:false, era:'Edad Contemporánea'},
  {slug:'revolucion-rusa',       title:'Revolución Rusa',        desc:'El fin de los zares y el nacimiento de la Unión Soviética.', icon:'☭', img:'../../assets/img/historia/revolucion-rusa.jpg',      time:'30 min', available:false, era:'Edad Contemporánea'},
  {slug:'segunda-guerra',        title:'Segunda Guerra Mundial', desc:'El conflicto más grande de la historia y sus consecuencias.', icon:'🌍', img:'../../assets/img/historia/segunda-guerra.jpg', time:'40 min', available:false, era:'Edad Contemporánea'},
  {slug:'guerra-fria',           title:'Guerra Fría',            desc:'Dos bloques, una tensión global que duró décadas.', icon:'🧊', img:'../../assets/img/historia/guerra-fria.jpg', time:'30 min', available:false, era:'Edad Contemporánea'},
  {slug:'independencia-argentina', title:'Independencia Argentina', desc:'El proceso que llevó a la Declaración de la Independencia en 1816.', icon:'📜', img:'../../assets/img/historia/independencia-argentina.jpg', time:'30 min', available:false, era:'Edad Moderna'},
  {slug:'historia-argentina',    title:'Historia Argentina',     desc:'De la independencia a la democracia: nuestro propio recorrido.', icon:'🇦🇷', img:'../../assets/img/historia/historia-argentina.jpg',  time:'40 min', available:false, era:'Edad Contemporánea'},
  {slug:'guerra-balcanes',       title:'Guerra de los Balcanes', desc:'Los conflictos de 1912-1913 que anticiparon la Primera Guerra Mundial.', icon:'🗺️', img:'../../assets/img/historia/guerra-balcanes.jpg', time:'25 min', available:false, era:'Edad Contemporánea'},
  {slug:'guerras-yugoslavas',    title:'Guerras Yugoslavas',     desc:'La desintegración violenta de Yugoslavia entre 1991 y 2001.', icon:'🕊️', img:'../../assets/img/historia/guerras-yugoslavas.jpg', time:'30 min', available:false, era:'Edad Contemporánea'},
  {slug:'globalizacion',         title:'Globalización',          desc:'Un mundo cada vez más conectado, y sus desafíos actuales.', icon:'🌐', img:'../../assets/img/historia/globalizacion.jpg',                                                   time:'25 min', available:false, era:'Edad Contemporánea'},
];

// Un acento de color por época, para que la carátula "sepa" en qué
// momento histórico está aunque no tenga guía interactiva propia todavía.
const ERA_ACCENT = {
  'Prehistoria':          '#C9960C',
  'Antigüedad':           '#D4A017',
  'Edad Media':           '#C9960C',
  'Edad Moderna':         '#8B1A1A',
  'Edad Contemporánea':   '#2E7D6B',
};

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

  const accent = ERA_ACCENT[topic.era] || '#C9960C';
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
    ? `<a href="${topic.slug}-guia.html" style="display:inline-block;background:linear-gradient(135deg,${accent},#E8A800);color:#1C1008;font-family:'Poppins',sans-serif;font-weight:700;font-size:0.95rem;padding:0.85rem 2.2rem;border-radius:10px;text-decoration:none;box-shadow:0 6px 20px rgba(0,0,0,.35);">Comenzar la guía →</a>`
    : `<span style="display:inline-block;background:rgba(255,255,255,.08);color:#8A8577;font-family:'Poppins',sans-serif;font-weight:700;font-size:0.95rem;padding:0.85rem 2.2rem;border-radius:10px;">Guía en camino</span>`;

  box.innerHTML = `
    ${iconFallback}
    <div style="text-align:center;font-family:'Poppins',sans-serif;font-size:0.75rem;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:${accent};margin-bottom:0.6rem;text-shadow:0 1px 6px rgba(0,0,0,.6);">
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
