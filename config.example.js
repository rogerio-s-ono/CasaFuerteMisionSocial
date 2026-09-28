/* Configuração de exemplo — COPIE para app/config.js e preencha com os valores reais.
   O arquivo real (app/config.js) está no .gitignore e NUNCA deve ser versionado.

   Lição do projeto anterior (gideao300): num app frontend público, qualquer valor
   aqui é visível no navegador. NÃO confie no SYNC_TOKEN como segredo forte — a
   segurança real é o login Google + allowlist validada no servidor (Apps Script).
   Este repositório é PRIVADO; ainda assim, não coloque dados pessoais reais aqui. */
window.CFMS_CONFIG = {
  // URL do Web App do Google Apps Script (backend / Google Sheets)
  SHEET_WEBAPP_URL: 'https://script.google.com/macros/s/XXXXXXXXXXXXXXXXXXXX/exec',

  // Client ID do Google Identity Services (OAuth) — usado no login
  GOOGLE_CLIENT_ID: 'XXXXXXXXXX-xxxxxxxxxxxxxxxxxxxx.apps.googleusercontent.com',

  // Token de sincronização compartilhado com o backend (camada fraca; ver nota acima)
  SYNC_TOKEN: 'TROCAR_POR_UM_TOKEN',

  // Allowlist de fallback (a fonte real de permissões deve ser a aba Admin da planilha)
  ALLOWED_EMAILS: ['exemplo@gmail.com'],
  ADMIN_EMAILS: ['exemplo@gmail.com'],

  // Idioma padrão da interface: 'pt' ou 'es'
  DEFAULT_LANG: 'es'
};
