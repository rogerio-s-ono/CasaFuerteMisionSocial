# Backend — Guía de instalación (Fase 1: configuración compartida)

Sigue estos pasos **una vez** para poner el backend en marcha. Solo tú puedes hacerlo
(es en tu cuenta de Google). Al final tendrás una URL `…/exec` que se pega en el app.

## 1. Crear la planilla
1. Ve a https://sheets.google.com y crea una **hoja de cálculo nueva**.
2. Nómbrala p. ej. **"Manos Fuertes — Datos"**. (Es una planilla NUEVA, separada del Gideão.)

## 2. Abrir el editor de Apps Script
1. En la planilla: menú **Extensiones → Apps Script**.
2. Borra el contenido de `Código.gs` (el archivo que viene por defecto).
3. Copia **todo** el contenido de `backend/Code.gs` (de este proyecto) y pégalo.

## 3. Poner los secretos (y guardar una copia fuera del repo)
En la parte de arriba del código, rellena:
- `SYNC_TOKEN` → inventa un texto (ej. una frase). Debe ser **el mismo** que pongas en el app (`config.js`).
- `GOOGLE_CLIENT_ID` → tu Client ID de Google OAuth (el mismo del login). Si aún no lo tienes, déjalo por ahora; el login Google se activa en la Fase 2.
- `ADMIN_FALLBACK` → tu email (para ser admin si la pestaña Admin está vacía).

> **Importante (regla de seguridad):** guarda esta versión con los secretos como **`Code.gs.real`** en tu OneDrive, **NUNCA** en el repositorio. El repo solo tiene la versión con placeholders. El `.gitignore` ya cubre `Code.gs.real`.

## 4. Crear las pestañas (automático)
- En el editor de Apps Script, con la función `_ensureSheets` seleccionada (o ejecuta `doGet` una vez desde el editor), pulsa **Ejecutar** ▶.
- La primera vez pedirá **autorizar** los permisos (acceso a la planilla). Acepta.
- Se crearán las pestañas: `Config`, `Voluntarios`, `Inscripciones`, `Checklists`, `Admin`, `Auditoria`.
- En `Admin` verás una fila con tu email y `admin` — ahí gestionas quién es admin/líder.

## 5. Desplegar como Web App
1. En Apps Script: **Implementar → Nueva implementación**.
2. Tipo: **Aplicación web** (Web App).
3. Configura:
   - **Ejecutar como:** *Yo* (tu cuenta).
   - **Quién tiene acceso:** *Cualquier persona* (para que el app pueda llamar; la seguridad real es el `SYNC_TOKEN` + login Google + allowlist).
4. Pulsa **Implementar** y autoriza si lo pide.
5. Copia la **URL de la aplicación web** (termina en `/exec`).

## 6. Conectar el app
1. En `app/config.js` (local, no versionado) pon:
   ```js
   window.CFMS_CONFIG = {
     SHEET_WEBAPP_URL: 'https://script.google.com/macros/s/XXXX/exec',  // la de arriba
     SYNC_TOKEN: 'el-mismo-token-del-Code.gs',
     GOOGLE_CLIENT_ID: '...apps.googleusercontent.com',
     DEFAULT_LANG: 'es'
   };
   ```
2. Guarda una copia real como `config.js.real` en OneDrive (mismo criterio de secretos).

## 7. Probar
- Abre el app. Debería hacer **pull** al abrir y mostrar el indicador **✓ sincronizado**.
- Entra como **Admin**, edita algo en la configuración → se hace **push** → recarga en otro dispositivo/navegador y el cambio aparece (ya es compartido).

## Reimplantar cuando cambie el Code.gs
Si editas `Code.gs` más adelante: **Implementar → Gestionar implementaciones → (editar) → Nueva versión → Implementar**. La URL `/exec` se mantiene.

## Notas
- **Fase 1** cubre la **configuración compartida** (lo que edita el Admin) + la base del sync.
- Voluntarios, inscripciones (con validación de cupo por `LockService`) y checklists ya están
  soportados en el `Code.gs`, y se activan en el app en las fases siguientes.
- El app sigue siendo **offline-first**: si no hay red, usa el caché local y sincroniza al reconectar.
