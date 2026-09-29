/* Configuración de ejemplo — COPIA a app/config.js y rellena con los valores reales.
   app/config.js está en .gitignore y NUNCA se versiona.
   Si SHEET_WEBAPP_URL está vacío o con placeholder, el app funciona en modo LOCAL (sin backend). */
window.CFMS_CONFIG = {
  // Backend (Google Apps Script Web App) — ver backend/SETUP.md
  SHEET_WEBAPP_URL: '',   // ej. 'https://script.google.com/macros/s/XXXX/exec' (vacío = modo local)
  SYNC_TOKEN: 'TROCAR_POR_UM_TOKEN',   // el MISMO del Code.gs
  GOOGLE_CLIENT_ID: 'XXXXXXXXXX-xxxx.apps.googleusercontent.com',
  DEFAULT_LANG: 'es'      // 'es' | 'pt'
};
