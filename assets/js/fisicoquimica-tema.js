// Mismo set de módulos que fisicoquimica-index.html (arquitectura común de la materia)
const TOPICS = {
  'mezclas-y-sistemas': {title:'Mezclas y Sistemas', icon:'🧪', desc:'4 módulos: Homogéneos, Heterogéneos, Fases y Métodos de Separación.', time:'~2.5 hs', available:true, href:'mezclas-sistemas-guia.html'},
};

const params = new URLSearchParams(window.location.search);
const slug = params.get('tema');
const topic = TOPICS[slug];
const box = document.getElementById('cover-box');

if(!topic){
  box.innerHTML = `
    <div class="cover-eyebrow">Fisicoquímica</div>
    <h1>Módulo no encontrado</h1>
    <p>No encontramos ese módulo. Volvé a la materia para elegir uno de la lista.</p>
    <a class="btn-start" href="fisicoquimica-index.html">Volver a Fisicoquímica</a>`;
} else if(topic.available){
  box.innerHTML = `
    <div class="cover-icon">${topic.icon}</div>
    <div class="cover-eyebrow">Fisicoquímica · Carátula del módulo</div>
    <h1>${topic.title}</h1>
    <p>${topic.desc}</p>
    <div class="cover-meta"><span>⏱ ${topic.time}</span><span>📖 Guía interactiva disponible</span></div>
    <a class="btn-start" href="${topic.href}">Comenzar la guía →</a>`;
} else {
  box.innerHTML = `
    <div class="cover-icon">${topic.icon}</div>
    <div class="cover-eyebrow">Fisicoquímica · Carátula del módulo</div>
    <h1>${topic.title}</h1>
    <p>${topic.desc}</p>
    <div class="cover-meta"><span>⏱ ${topic.time} (estimado)</span><span>🔜 En construcción</span></div>
    <div class="soon-box">
      <strong>Todavía no armamos la guía interactiva de este módulo.</strong><br>
      Ya está lista la arquitectura (carátula → experiencia interactiva → guía → evaluación) para sumarla como hicimos con
      <a href="tema.html?tema=mezclas-y-sistemas" style="color:var(--mostaza);">Mezclas y Sistemas</a>. Volvé pronto.
    </div>`;
}
