/* CONFIG del app — VERSIONADO (repo público, servido por GitHub Pages).
   La seguridad real es login Google + allowlist en el backend (ya NO depende del SYNC_TOKEN,
   que fue abandonado por quedar expuesto en un frontend público). Solo quedan datos públicos
   por diseño: la URL del Web App y el GOOGLE_CLIENT_ID. */
window.CFMS_CONFIG = {
  SHEET_WEBAPP_URL: 'https://script.google.com/macros/s/AKfycbwPHCKuHv9JeBIS5AUhkPYICoQNEZ6h4AsLkT2i-Z9DE7OAhQr1op5f9UuEuJA2SYiKIg/exec',
  GOOGLE_CLIENT_ID: '363930767849-h5s9kodg8ic1rioc540bvlfnp8nmrmvp.apps.googleusercontent.com',
  DEFAULT_LANG: 'es'
};
