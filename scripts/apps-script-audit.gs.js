/**
 * Web App de Apps Script para el log de auditoria de ORIGEN.
 * Mismo patron que scheduler/apps_script_decisiones.gs.js de ligaf-scraper
 * (PDG), pero ademas expone un GET para poder leer la corrida anterior
 * (el progreso no persiste entre corridas de GitHub Actions -- localStorage
 * no sobrevive entre runs -- asi que Sheets es la unica fuente de "la
 * ultima vez").
 *
 * CÓMO DESPLEGARLO (una sola vez):
 *   1. Crea una hoja de Google Sheets nueva, separada de config_scheduler
 *      de PDG (proyecto distinto, no hay que mezclarlos).
 *   2. Nombra la pestaña "auditoria" (o cambia NOMBRE_PESTAÑA abajo).
 *   3. En la fila 1, pega estos encabezados exactos, uno por columna:
 *        fecha | hora | run_id | resultado_general | total_hallazgos |
 *        hallazgos_desktop | hallazgos_mobile | detalle_hallazgos |
 *        progreso_historia | progreso_fisicoquimica | progreso_json
 *   4. Extensiones -> Apps Script. Borra Code.gs y pega este archivo entero.
 *   5. Desplegar -> Nueva implementacion -> tipo "Aplicacion web".
 *      - Ejecutar como: Yo (tu cuenta)
 *      - Quien tiene acceso: Cualquier usuario
 *      (necesario para que GitHub Actions pueda pegarle sin login)
 *   6. Autorizá los permisos que pida (tu propio script, tu propia hoja).
 *   7. Copia la URL ("URL de la aplicacion web") -- esa va en el secret
 *      ORIGEN_AUDIT_WEBHOOK_URL del repo.
 *
 * Si en algun momento renombras la pestaña, actualiza NOMBRE_PESTAÑA y
 * volvé a desplegar (Desplegar -> Gestionar implementaciones -> lapiz ->
 * Nueva version).
 */

var NOMBRE_PESTAÑA = 'auditoria';

function doPost(e) {
  var hoja = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(NOMBRE_PESTAÑA);
  if (!hoja) {
    return ContentService.createTextOutput(JSON.stringify({ ok: false, error: 'no existe la pestaña ' + NOMBRE_PESTAÑA }))
      .setMimeType(ContentService.MimeType.JSON);
  }
  var datos = JSON.parse(e.postData.contents);
  var progreso = datos.progreso || {};
  hoja.appendRow([
    datos.fecha, datos.hora, datos.run_id, datos.resultado_general,
    datos.total_hallazgos, datos.hallazgos_desktop, datos.hallazgos_mobile,
    datos.detalle_hallazgos,
    progreso.historia !== undefined ? progreso.historia : '',
    progreso.fisicoquimica !== undefined ? progreso.fisicoquimica : '',
    JSON.stringify(progreso),
  ]);
  return ContentService.createTextOutput(JSON.stringify({ ok: true }))
    .setMimeType(ContentService.MimeType.JSON);
}

// GET ?accion=ultima -- devuelve el progreso de la ultima fila registrada,
// para que el script pueda comparar la corrida actual contra la anterior.
function doGet(e) {
  var hoja = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(NOMBRE_PESTAÑA);
  if (!hoja || hoja.getLastRow() < 2) {
    return ContentService.createTextOutput(JSON.stringify({ progreso: null }))
      .setMimeType(ContentService.MimeType.JSON);
  }
  var ultimaFila = hoja.getRange(hoja.getLastRow(), 1, 1, 11).getValues()[0];
  var progresoJson = ultimaFila[10];
  var progreso = null;
  try { progreso = progresoJson ? JSON.parse(progresoJson) : null; } catch (err) { progreso = null; }
  // fallback por si progreso_json vino vacio pero las columnas sueltas si:
  if (!progreso) {
    progreso = {};
    if (ultimaFila[8] !== '') progreso.historia = Number(ultimaFila[8]);
    if (ultimaFila[9] !== '') progreso.fisicoquimica = Number(ultimaFila[9]);
  }
  return ContentService.createTextOutput(JSON.stringify({ progreso: progreso }))
    .setMimeType(ContentService.MimeType.JSON);
}
