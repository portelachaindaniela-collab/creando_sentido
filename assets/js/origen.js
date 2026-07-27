
const PAGES = document.querySelectorAll('.page');
function show(id){
  PAGES.forEach(p => p.classList.remove('active'));
  const pg = document.getElementById('page-' + id);
  if(pg){ pg.classList.add('active'); window.scrollTo(0,0); }
}
document.querySelectorAll('[data-page]').forEach(el => {
  el.addEventListener('click', e => { e.preventDefault(); show(el.dataset.page); });
});
document.querySelectorAll('[data-scroll]').forEach(el => {
  el.addEventListener('click', e => {
    e.preventDefault();
    show('home');
    setTimeout(() => scrollToId(el.dataset.scroll), 50);
  });
});
function scrollToId(id){
  document.getElementById(id).scrollIntoView({behavior:'smooth'});
}
function toggleSidebar(){
  const el = document.getElementById('sidebar-collapsible');
  const btn = document.getElementById('sidebar-toggle');
  const isOpen = el.classList.toggle('open');
  btn.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
  btn.textContent = isOpen ? '✕' : '☰';
}

function startFQ(){
  const name = document.getElementById('fq-name').value.trim() || 'estudiante';
  document.getElementById('fq-welcome').textContent = '¡Bienvenida, ' + name + '!';
  show('app-fq-mapa');
}

let backTarget = 'home';
const QUESTIONS = {
  'fq-1': { text: 'En una solución homogénea, ¿cómo se distribuyen las partículas del soluto?', correctIdx: 1, back: 'app-fq-mapa' }
};

function openQuestion(track, chapter){
  const key = track + '-' + chapter;
  const q = QUESTIONS[key] || { text: 'Este capítulo todavía no tiene una pregunta de ejemplo cargada.', correctIdx: 0, back: 'app-fq-mapa' };
  document.getElementById('q-text').textContent = q.text;
  backTarget = q.back;
  document.getElementById('q-back').onclick = () => show(backTarget);
  document.querySelectorAll('.q-opt').forEach((btn,i) => {
    btn.classList.remove('correct','wrong');
    btn.disabled = false;
    btn.dataset.correct = (i === q.correctIdx) ? 'true' : 'false';
  });
  document.getElementById('q-feedback').className = 'q-feedback';
  document.getElementById('q-feedback').textContent = '';
  show('app-pregunta');
}

function answer(btn, forcedCorrect){
  const isCorrect = btn.dataset.correct === 'true';
  document.querySelectorAll('.q-opt').forEach(b => b.disabled = true);
  const fb = document.getElementById('q-feedback');
  if(isCorrect){
    btn.classList.add('correct');
    fb.textContent = '¡Correcto! Podés avanzar al siguiente capítulo.';
    fb.className = 'q-feedback show ok';
  } else {
    btn.classList.add('wrong');
    fb.textContent = 'No es correcta. Volvé al contenido del capítulo y repasá antes de reintentar — no te decimos cuál era la respuesta correcta a propósito.';
    fb.className = 'q-feedback show bad';
  }
}
