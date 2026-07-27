// ══════════════════════════════════════════════════════════
//  ORIGEN · Core · navegacion-estado.js
//
//  Gestor central de estado de navegación. Es la única puerta
//  de entrada que un módulo de contenido necesita tocar para:
//   - saber/guardar dónde está el alumno (materia+módulo+sección+scroll)
//   - navegar a un contenido relacionado ("Conexiones") sin perder
//     el lugar exacto de origen, y poder volver a él
//   - leer/escribir progreso de módulo o materia
//   - leer/escribir el intento de evaluación en curso
//
//  No duplica persistencia: progreso delega en storage.js
//  (getMateriaProgress/setMateriaProgress) y las evaluaciones
//  delegan en evaluacion-motor.js (guardarIntento/restaurarIntento).
//  Si esos Core no están cargados, degrada a localStorage directo
//  sin romper — pero lo ideal es cargar siempre los tres.
//
//  100% agnóstico de materia: todo identificador (materia, módulo,
//  sección) es un string que decide quien llama. Nunca hay un
//  nombre de Historia ni de ninguna otra materia acá adentro.
// ══════════════════════════════════════════════════════════

const NavegacionEstado = (function(){

  const CLAVE_ESTADO = 'origenNavegacion';
  const MAX_PILA = 20;            // tope del historial interno, para no crecer sin límite
  const SCROLL_DEBOUNCE_MS = 400; // cada cuánto se guarda el scroll mientras el alumno lee

  // ── acceso a localStorage: reutiliza storage.js si está, si no degrada ──
  function getJSON(key, fallback){
    if (typeof safeGetJSON === 'function') return safeGetJSON(key, fallback);
    try { return JSON.parse(localStorage.getItem(key) || 'null') ?? fallback; }
    catch(e){ return fallback; }
  }
  function setJSON(key, obj){
    if (typeof safeSetJSON === 'function') return safeSetJSON(key, obj);
    try { localStorage.setItem(key, JSON.stringify(obj)); return true; }
    catch(e){ return false; }
  }

  function leerEstado(){
    return getJSON(CLAVE_ESTADO, {actual:null, pila:[]});
  }
  function escribirEstado(estado){
    return setJSON(CLAVE_ESTADO, estado);
  }

  // ══ POSICIÓN ACTUAL (materia + módulo + sección + scroll) ══

  function registrarPosicion(materia, modulo, seccion, scroll){
    const estado = leerEstado();
    estado.actual = {
      materia, modulo, seccion: seccion || null,
      scroll: scroll || 0, timestamp: Date.now()
    };
    escribirEstado(estado);
    return estado.actual;
  }

  function obtenerPosicionActual(){
    return leerEstado().actual;
  }

  // ── auto-guardado de scroll mientras el alumno navega la página ──
  // Un módulo llama esto UNA vez al cargar, con su propio contexto.
  // A partir de ahí, el scroll se guarda solo (con debounce) y también
  // justo antes de salir de la página (beforeunload).
  let _contexto = null;
  let _scrollTimer = null;

  function iniciarAutoguardadoScroll(materia, modulo, seccion){
    _contexto = {materia, modulo, seccion: seccion || null};

    const guardarAhora = () => registrarPosicion(
      _contexto.materia, _contexto.modulo, _contexto.seccion,
      (typeof window!=='undefined' ? window.scrollY : 0)
    );

    if (typeof window !== 'undefined'){
      window.addEventListener('scroll', () => {
        clearTimeout(_scrollTimer);
        _scrollTimer = setTimeout(guardarAhora, SCROLL_DEBOUNCE_MS);
      }, {passive:true});
      window.addEventListener('beforeunload', guardarAhora);
    }
  }

  // Un módulo llama esto al cargar, después de renderizar su contenido,
  // para volver exactamente a donde el alumno estaba (si corresponde a
  // esta misma materia+módulo+sección; si no, no hace nada).
  function restaurarScrollSiCorresponde(materia, modulo, seccion){
    const actual = obtenerPosicionActual();
    if (actual && actual.materia===materia && actual.modulo===modulo
        && (actual.seccion||null)===(seccion||null)){
      if (typeof window !== 'undefined'){
        setTimeout(()=> window.scrollTo(0, actual.scroll||0), 50);
      }
      return true;
    }
    return false;
  }

  // ══ HISTORIAL INTERNO DE NAVEGACIÓN ("Conexiones") ══

  // Antes de saltar a un contenido relacionado, apila la posición
  // actual (con scroll exacto) para poder volver después.
  // destino: {url} — el motor no decide rutas, solo navega si se le
  // da una url ya armada por quien llama (que sabe el slug/estructura
  // de su propia materia).
  function irAConexion(destino){
    const estado = leerEstado();
    estado.pila = estado.pila || [];
    if (_contexto){
      estado.pila.push({
        materia: _contexto.materia, modulo: _contexto.modulo, seccion: _contexto.seccion,
        scroll: (typeof window!=='undefined' ? window.scrollY : 0),
        timestamp: Date.now()
      });
      if (estado.pila.length > MAX_PILA) estado.pila.shift();
    }
    escribirEstado(estado);
    if (destino && destino.url && typeof window!=='undefined') window.location.href = destino.url;
  }

  // Saca el último punto apilado, lo marca como posición "actual" (para
  // que restaurarScrollSiCorresponde lo reconozca al recargar en destino)
  // y, si se le pasa un armador de URL, navega ahí. Devuelve el punto
  // anterior (o false si no hay historial).
  function volver(construirUrl){
    const estado = leerEstado();
    const previo = (estado.pila || []).pop();
    if (!previo) { escribirEstado(estado); return false; }
    estado.actual = previo;
    escribirEstado(estado);
    if (typeof construirUrl === 'function'){
      const url = construirUrl(previo);
      if (url && typeof window!=='undefined') window.location.href = url;
    }
    return previo;
  }

  function haySalidaPendiente(){
    return (leerEstado().pila || []).length > 0;
  }

  // ══ PROGRESO (delega en storage.js — no duplica persistencia) ══

  function guardarProgresoModulo(materia, moduloSlug, pct){
    const prog = (typeof getMateriaProgress==='function') ? getMateriaProgress(materia) : {};
    prog[moduloSlug] = pct;
    if (typeof setMateriaProgress==='function') setMateriaProgress(materia, prog);
    return prog;
  }
  function obtenerProgresoModulo(materia, moduloSlug){
    const prog = (typeof getMateriaProgress==='function') ? getMateriaProgress(materia) : {};
    return prog[moduloSlug];
  }
  function obtenerProgresoMateria(materia){
    return (typeof getMateriaProgress==='function') ? getMateriaProgress(materia) : {};
  }
  // Borra un slug puntual del progreso de una materia (no solo lo
  // pone en 0 — lo saca del objeto, para que un futuro "obtenerProgresoModulo"
  // devuelva undefined, igual que si nunca se hubiera tocado ese módulo).
  function borrarProgresoModulo(materia, moduloSlug){
    const prog = (typeof getMateriaProgress==='function') ? getMateriaProgress(materia) : {};
    delete prog[moduloSlug];
    if (typeof setMateriaProgress==='function') setMateriaProgress(materia, prog);
    return prog;
  }

  // ══ EVALUACIONES (delega en evaluacion-motor.js — no duplica) ══

  function guardarIntentoEvaluacion(clave, estadoIntento){
    if (typeof EvaluacionMotor !== 'undefined') return EvaluacionMotor.guardarIntento(clave, estadoIntento);
    return setJSON('origenIntento:' + clave, estadoIntento);
  }
  function obtenerIntentoEvaluacion(clave){
    if (typeof EvaluacionMotor !== 'undefined') return EvaluacionMotor.restaurarIntento(clave);
    return getJSON('origenIntento:' + clave, null);
  }
  function hayIntentoEnCurso(clave){
    return obtenerIntentoEvaluacion(clave) !== null;
  }
  function borrarIntentoEvaluacion(clave){
    if (typeof EvaluacionMotor !== 'undefined') return EvaluacionMotor.borrarIntento(clave);
    try { localStorage.removeItem('origenIntento:' + clave); return true; }
    catch(e){ return false; }
  }

  // ══ REINICIO DE SESIÓN DE MATERIA (Core, reutilizable) ══
  //
  // Pensado para el momento en que un alumno termina POR COMPLETO el
  // recorrido de una materia (rindió el examen final) y abandona esa
  // pantalla o vuelve al índice de la materia: se limpia todo el
  // estado "de trabajo" (progreso de módulos + intentos de evaluación
  // en curso) para que el próximo alumno en este dispositivo empiece
  // limpio — pero el registro académico (notas) NO se toca acá adentro:
  // quien llama debe haberlo guardado antes con addGradeRecord, si
  // corresponde, porque este reinicio es deliberadamente "ciego" al
  // contenido académico — solo borra estado de sesión/progreso.
  //
  // config:
  //   materia:            string (ej. 'fisicoquimica')
  //   moduloSlugs:         [ 'mezclas-y-sistemas', 'mezclas-y-sistemas-cap-0', ... ]
  //   clavesEvaluacion:    [ 'fisicoquimica:mezclas-y-sistemas:0', ..., '...final' ]
  //   reiniciarIdentidad:  boolean (default true) — también borra el
  //     alias/guía compartidos de toda la plataforma (Core: storage.js
  //     resetIdentity). Ver advertencia en ese archivo: como el alias
  //     es global, esto hace que CUALQUIER materia vuelva a pedir el
  //     nombre la próxima vez. Es el comportamiento correcto para
  //     evitar arrastrar identidad entre alumnos distintos.
  function reiniciarSesionMateria(config){
    config = Object.assign({materia:null, moduloSlugs:[], clavesEvaluacion:[], reiniciarIdentidad:true}, config);

    (config.moduloSlugs||[]).forEach(slug => borrarProgresoModulo(config.materia, slug));
    (config.clavesEvaluacion||[]).forEach(clave => borrarIntentoEvaluacion(clave));

    if (config.reiniciarIdentidad && typeof resetIdentity === 'function'){
      resetIdentity();
    }
    return true;
  }

  return {
    registrarPosicion, obtenerPosicionActual,
    iniciarAutoguardadoScroll, restaurarScrollSiCorresponde,
    irAConexion, volver, haySalidaPendiente,
    guardarProgresoModulo, obtenerProgresoModulo, obtenerProgresoMateria, borrarProgresoModulo,
    guardarIntentoEvaluacion, obtenerIntentoEvaluacion, hayIntentoEnCurso, borrarIntentoEvaluacion,
    reiniciarSesionMateria,
  };
})();
