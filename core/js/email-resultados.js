// ══════════════════════════════════════════════════════════
//  ORIGEN · Core · email-resultados.js
//
//  Envío genérico de resultados de una evaluación por correo,
//  reutilizable por cualquier materia (hoy: Fisicoquímica; a futuro
//  puede reemplazar la copia local que tiene Historia en
//  edad-media-guia.html, sin cambiar comportamiento).
//
//  Reutiliza la MISMA cuenta y plantilla de EmailJS que ya usa
//  Historia (mismo proyecto ORIGEN, mismo destinatario docente) —
//  si en algún momento se quiere una plantilla separada para otra
//  materia, alcanza con cambiar estas 3 constantes.
//
//  100% agnóstico de materia y de alumno: nunca hay un nombre fijo
//  acá adentro — todo dato viene en el objeto que arma quien llama.
// ══════════════════════════════════════════════════════════

const EmailResultados = (function(){

  // → Mismas credenciales que ya usa Historia (edad-media-guia.html).
  const EMAILJS_PUBLIC_KEY  = 'aWbe5g7oh_BTeiSj5';
  const EMAILJS_SERVICE_ID  = 'service_o8ihali';
  const EMAILJS_TEMPLATE_ID = 'template_48i5yle';

  let inicializado = false;
  function asegurarInit(){
    if(inicializado) return;
    if(typeof emailjs === 'undefined'){
      throw new Error('EmailJS no está cargado. Agregá <script src="https://cdn.jsdelivr.net/npm/@emailjs/browser@4/dist/email.min.js"></script> antes de este archivo.');
    }
    emailjs.init(EMAILJS_PUBLIC_KEY);
    inicializado = true;
  }

  // Valida un email de forma simple (no exhaustiva, solo para evitar
  // errores obvios de tipeo antes de gastar un envío).
  function emailValido(valor){
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test((valor||'').trim());
  }

  // Arma el texto de la sección "DETALLE POR CAPÍTULO" de la plantilla
  // de EmailJS (variable {{detalle_capitulos}}). Agrupa "detalle" (el
  // array que ya entrega evaluacion-motor.js) por módulo/tema y muestra
  // puntaje + estado de cada uno — 100% agnóstico de materia, agrupa
  // por la clave que ya viene en cada item (nunca un nombre fijo de
  // capítulo ni de módulo). No depende de devolucion-pedagogica.js
  // porque no todas las materias lo cargan hoy (ej. Historia).
  function detallePorCapitulo(detalle, umbralAprobacion){
    umbralAprobacion = umbralAprobacion || 70;
    const grupos = {};
    (detalle || []).forEach(d=>{
      const key = d.tema || d.modulo || 'General';
      if(!grupos[key]) grupos[key] = {puntos:0, max:0};
      grupos[key].puntos += (d.puntos !== undefined ? d.puntos : (d.correcto ? 0.5 : 0));
      grupos[key].max += (d.type==='mc' ? 0.5 : 1);
    });
    return Object.keys(grupos).map(nombre=>{
      const g = grupos[nombre];
      const pct = g.max > 0 ? Math.round((g.puntos/g.max)*100) : 0;
      const estado = pct >= umbralAprobacion ? '✅ Aprobado' : '❌ No aprobado';
      return `${nombre}: ${g.puntos}/${g.max} pts (${pct}%) — ${estado}`;
    }).join('\n');
  }

  // datos: {
  //   toEmail:   correo elegido por el alumno en ESE momento (nunca
  //              se guarda ni se recuerda de una vez anterior),
  //   alias:     nombre/alias del alumno (nunca hardcodeado),
  //   materia:   string libre (ej. 'Fisicoquímica'),
  //   tema:      string libre (ej. 'Mezclas y Sistemas'),
  //   resultado: el objeto que ya entrega evaluacion-motor.js
  //              {puntos, maxPuntos, pct, nota10, aprobado, fortalezas, aRepasar,
  //               detalle} — "detalle" es opcional: si viene, arma el desglose
  //               por módulo/tema de {{detalle_capitulos}}; si no, esa
  //               variable se manda vacía (la plantilla no debería romperse).
  // }
  // Devuelve una Promise (resuelve/rechaza igual que emailjs.send).
  function enviar(datos){
    datos = datos || {};
    if(!emailValido(datos.toEmail)){
      return Promise.reject(new Error('Correo inválido'));
    }
    asegurarInit();

    const r = datos.resultado || {};
    const fecha = new Date().toLocaleDateString('es-AR', {
      day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit'
    });
    const alias = datos.alias || 'estudiante';
    const encabezado = `${datos.materia || ''} — ${datos.tema || ''}`.trim();

    let detalle = `${encabezado}\n`;
    detalle += `Alumno/a: ${alias}\n`;
    if(r.fortalezas && r.fortalezas.length) detalle += `Fortalezas: ${r.fortalezas.join(', ')}\n`;
    if(r.aRepasar && r.aRepasar.length) detalle += `A repasar: ${r.aRepasar.join(', ')}\n`;
    if(r.sugerencia) detalle += `${r.sugerencia}\n`;

    const templateParams = {
      to_email:          datos.toEmail,
      student_email:     alias,
      fecha:             fecha,
      resultado_general: `${encabezado} — ${r.nota10}/10 — ${r.pct}% — ${r.aprobado ? '✅ APROBADO' : '❌ NO APROBADO'} (${r.puntos}/${r.maxPuntos} pts)`,
      detalle_examen:    detalle,
      detalle_capitulos: detallePorCapitulo(r.detalle),
    };

    return emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, templateParams);
  }

  return { enviar, emailValido };
})();
