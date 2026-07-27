// ══════════════════════════════════════════════════════════
//  ORIGEN · Core · pedro.js
//
//  Compañero de estudio de las materias de Exactas. Panel de ayuda
//  contextual — reemplaza el viejo chat permanente de "Sra. Paloma".
//
//  Regla dura, no negociable: Pedro NUNCA resuelve una evaluación.
//  Por diseño, este archivo no tiene ningún método que reciba una
//  pregunta de examen y devuelva la respuesta correcta. Todo lo que
//  ofrece son las mismas ayudas pedagógicas del contenido del módulo
//  (ejemplos, analogías, resumen, conexiones, conceptos clave,
//  experimento), nunca la corrección de una evaluación.
//
//  No duplica contenido: reutiliza el mismo objeto "modulo" que ya
//  usa modulo-template.js — {ejemplos, curiosidad, resumen,
//  conexiones, conceptosImportantes, analogia?, experimento?}.
//  Si un campo no viene, esa opción del panel simplemente no
//  aparece (no se inventa contenido).
//
//  Contrato "guía" (Pedro es la primera implementación; Sofía/Tomás
//  podrían implementarlo después si Historia vuelve a tener guía):
//    explicar(modulo), darEjemplo(modulo), hacerAnalogia(modulo),
//    resumir(modulo), relacionar(modulo), conceptosClave(modulo),
//    proponerExperimento(modulo)
//  Deliberadamente NO existe resolverEvaluacion(modulo, pregunta).
// ══════════════════════════════════════════════════════════

const Pedro = (function(){

  const NOMBRE = 'Pedro';
  const AVATAR_EMOJI = '🧑‍🔬'; // respaldo si no hay imagen real, o si la imagen no carga
  let avatarUrlConfigurado = null;

  // Cualquier materia puede llamar esto una vez, antes de montarPanel,
  // para usar la foto real de Pedro en vez del emoji. Si no se llama,
  // o si la imagen falla al cargar, se usa el emoji sin romper nada.
  function configurarAvatar(url){
    avatarUrlConfigurado = url;
  }

  function avatarHTML(tamanoPx){
    if (!avatarUrlConfigurado) return `<span class="pedro-avatar-emoji" style="font-size:${tamanoPx}px;">${AVATAR_EMOJI}</span>`;
    return `<img src="${avatarUrlConfigurado}" alt="${NOMBRE}" class="pedro-avatar-img" style="width:${tamanoPx}px;height:${tamanoPx}px;border-radius:50%;object-fit:cover;" onerror="this.outerHTML='<span class=\\'pedro-avatar-emoji\\' style=\\'font-size:${tamanoPx}px;\\'>${AVATAR_EMOJI}</span>'">`;
  }

  // ── Cada acción devuelve {titulo, html} o null si no hay contenido ──
  function explicar(modulo){
    if (!modulo.desarrollo && !modulo.definicion) return null;
    const texto = modulo.desarrollo || modulo.definicion;
    return { titulo: 'Te lo explico de otra manera', html: `<p>${texto}</p>` };
  }

  function darEjemplo(modulo){
    if (!modulo.ejemplos || !modulo.ejemplos.length) return null;
    return { titulo: 'Un ejemplo concreto', html: `<ul>${modulo.ejemplos.map(e=>`<li>${e}</li>`).join('')}</ul>` };
  }

  function hacerAnalogia(modulo){
    if (!modulo.analogia) return null;
    return { titulo: 'Pensalo así', html: `<p>${modulo.analogia}</p>` };
  }

  function resumir(modulo){
    if (!modulo.resumen) return null;
    return { titulo: 'En resumen', html: `<p>${modulo.resumen}</p>` };
  }

  function relacionar(modulo){
    if (!modulo.conexiones || !modulo.conexiones.length) return null;
    return { titulo: 'Se relaciona con', html: `<ul>${modulo.conexiones.map(c=>`<li>${c.titulo}</li>`).join('')}</ul>` };
  }

  function conceptosClave(modulo){
    if (!modulo.conceptosImportantes || !modulo.conceptosImportantes.length) return null;
    return { titulo: 'Conceptos clave', html: `<ul>${modulo.conceptosImportantes.map(c=>`<li>${c}</li>`).join('')}</ul>` };
  }

  function proponerExperimento(modulo){
    if (!modulo.experimento) return null;
    return { titulo: 'Probá esto en casa (con cuidado)', html: `<p>${modulo.experimento}</p>` };
  }

  // ── Qué opciones mostrar en el panel para este módulo puntual ──
  // Solo aparecen las que tienen contenido real — nunca se inventa nada.
  function opcionesDisponibles(modulo){
    const candidatas = [
      { id:'explicar', label:'Explicame de otra manera', fn: explicar },
      { id:'ejemplo', label:'Dame un ejemplo', fn: darEjemplo },
      { id:'analogia', label:'Hacé una analogía', fn: hacerAnalogia },
      { id:'resumen', label:'Resumime esto', fn: resumir },
      { id:'conexiones', label:'¿Con qué se relaciona?', fn: relacionar },
      { id:'conceptos', label:'Conceptos clave', fn: conceptosClave },
      { id:'experimento', label:'Proponeme un experimento', fn: proponerExperimento },
    ];
    return candidatas.filter(c => c.fn(modulo) !== null);
  }

  // ── Render del panel lateral (HTML + wiring de clicks) ──
  // contenedorId: el <div> donde va el panel. botonId: el botón que
  // lo abre ("Necesito ayuda" / "Preguntale a Pedro").
  //
  // IMPORTANTE (punto 4 de la revisión funcional): esta función se
  // vuelve a llamar cada vez que cambia el módulo/capítulo activo —
  // eso es necesario para que Pedro hable del contenido correcto.
  // Pero antes, cada llamada enganchaba un listener de click NUEVO
  // en el mismo botón flotante sin sacar los anteriores: después de
  // navegar unos capítulos, un solo clic disparaba varios toggles
  // acumulados y el panel dejaba de responder de forma consistente.
  // La bandera boton.dataset.pedroWired asegura que el botón se
  // enganche una única vez, sin importar cuántas veces se llame a
  // montarPanel después.
  function montarPanel(contenedor, boton, modulo){
    const opciones = opcionesDisponibles(modulo);
    contenedor._pedroBoton = boton || contenedor._pedroBoton || null;

    function render(activo){
      const botones = opciones.map(o =>
        `<button class="pedro-opcion ${o.id===activo?'activa':''}" data-op="${o.id}">${o.label}</button>`
      ).join('');

      let cuerpo = '';
      if (activo){
        const opcion = opciones.find(o => o.id===activo);
        const resultado = opcion.fn(modulo);
        cuerpo = `<div class="pedro-respuesta"><h4>${resultado.titulo}</h4>${resultado.html}</div>`;
      } else {
        cuerpo = `<p class="pedro-intro">Hola, soy ${NOMBRE}. ¿En qué te ayudo con este tema?</p>`;
      }

      contenedor.innerHTML =
        `<div class="pedro-header">
           ${avatarHTML(32)}<strong>${NOMBRE}</strong>
           <button type="button" class="pedro-close" aria-label="Cerrar">✕</button>
         </div>
         <div class="pedro-opciones">${botones}</div>
         ${cuerpo}`;

      contenedor.querySelectorAll('.pedro-opcion').forEach(b=>{
        b.addEventListener('click', ()=> render(b.dataset.op));
      });
      const cerrar = contenedor.querySelector('.pedro-close');
      if (cerrar) cerrar.addEventListener('click', ()=> cerrarPanel(contenedor));
    }

    render(null);

    if (boton && !boton.dataset.pedroWired){
      boton.dataset.pedroWired = '1';
      boton.addEventListener('click', ()=> togglePanel(contenedor, boton));
    }
  }

  function togglePanel(contenedor, boton){
    const abierto = contenedor.style.display === 'block';
    if(abierto) cerrarPanel(contenedor, boton);
    else abrirPanel(contenedor, boton);
  }

  function abrirPanel(contenedor, boton){
    contenedor.style.display = 'block';
    if (boton) boton.style.display = 'none';
  }

  function cerrarPanel(contenedor, boton){
    contenedor.style.display = 'none';
    // "boton" es opcional: cerrarPanel también se llama desde la (X)
    // interna, que no lo recibe directamente — se busca el que ya
    // quedó enganchado a este contenedor.
    const btnAsociado = boton || contenedor._pedroBoton;
    if (btnAsociado) btnAsociado.style.display = '';
  }

  return {
    explicar, darEjemplo, hacerAnalogia, resumir, relacionar,
    conceptosClave, proponerExperimento, opcionesDisponibles, montarPanel,
    configurarAvatar, avatarHTML, togglePanel, cerrarPanel,
  };
})();
