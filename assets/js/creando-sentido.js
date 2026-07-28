
// El header es sticky y su alto real cambia según el viewport (la
// marca puede pasar a 2 líneas en pantallas chicas) — se mide acá y
// se guarda en --header-h para que scroll-margin-top (CSS) sepa
// cuánto dejar libre arriba de cada sección al hacer scroll por ancla.
function actualizarAltoHeader(){
  const header = document.querySelector('header');
  if(header) document.documentElement.style.setProperty('--header-h', header.offsetHeight + 'px');
}
actualizarAltoHeader();
window.addEventListener('resize', actualizarAltoHeader);
window.addEventListener('load', actualizarAltoHeader);

// Menú mobile: abre/cierra el dropdown de navegación
function toggleNav(){
  const nav = document.getElementById('nav-links');
  const btn = document.getElementById('nav-toggle');
  const isOpen = nav.classList.toggle('open');
  btn.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
  btn.textContent = isOpen ? '✕' : '☰';
}
document.querySelectorAll('#nav-links a').forEach(a => {
  a.addEventListener('click', () => {
    document.getElementById('nav-links').classList.remove('open');
    const btn = document.getElementById('nav-toggle');
    btn.setAttribute('aria-expanded', 'false');
    btn.textContent = '☰';
  });
});

// Revelado suave al hacer scroll — transición orgánica, sin movimientos bruscos
const revealEls = document.querySelectorAll('.reveal');
const io = new IntersectionObserver((entries) => {
  entries.forEach(e => {
    if (e.isIntersecting) {
      e.target.classList.add('in');
      io.unobserve(e.target);
    }
  });
}, { threshold: 0.15 });
revealEls.forEach(el => io.observe(el));
