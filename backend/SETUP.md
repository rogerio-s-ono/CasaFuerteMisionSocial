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

---

## 🚀 Deploy automatizado (clasp) — YA NO copiar/pegar

A partir de ahora el `Code.gs` se sube y se republica con **un solo comando** (`npm run deploy`),
sin abrir el editor ni copiar/pegar. Se usa **clasp** (CLI oficial de Google Apps Script).

### Cambio importante — secretos en Script Properties
El `Code.gs` ya **NO** contiene secretos. `SYNC_TOKEN`, `GOOGLE_CLIENT_ID` y `ADMIN_FALLBACK`
se leen de las **Script Properties** del proyecto (así el archivo se puede versionar y desplegar
automáticamente sin exponer nada). Se configuran **una vez** (paso 5 de abajo).

### Ya está hecho (por Kiro, no tienes que hacerlo)
- ✅ Node instalado (vía nvm) y `clasp` instalado en `backend/`.
- ✅ `Code.gs` refactorizado para leer secretos de Script Properties + función `setupSecrets()`.
- ✅ `appsscript.json`, `package.json` (con `npm run deploy`), `deploy.mjs`, `.claspignore` creados.
- ✅ `.clasp.json` / `.deploy.json` como plantillas; `.gitignore` cubre credenciales e IDs.

### Lo que SOLO TÚ puedes hacer (una vez, ~10 min — es tu cuenta Google)

Todos los comandos se ejecutan **dentro de `backend/`**:
```bash
cd backend
```

**1. Login en Google (genera las credenciales de clasp)**
```bash
npm run login
```
Se abre el navegador → autoriza con tu cuenta Google (la dueña de la planilla). Crea
`~/.clasprc.json` (ya está en `.gitignore`).

**2. Activar la Apps Script API** (1 clic, una vez)
- Abre https://script.google.com/home/usersettings
- Activa el interruptor **"Google Apps Script API"** → ON.

**3. Pegar el Script ID** en `backend/.clasp.json`
- Abre tu proyecto Apps Script (menú **Extensiones → Apps Script** desde la planilla).
- **Configuración del proyecto** (icono de engranaje ⚙️) → copia el **"ID de secuencia de comandos"** (Script ID).
- Pégalo en `backend/.clasp.json` sustituyendo `COLE_AQUI_O_SCRIPT_ID`:
  ```json
  { "scriptId": "1AbC...tuScriptId...XyZ", "rootDir": "." }
  ```

**4. Pegar el Deployment ID** en `backend/.deploy.json` (para mantener la MISMA URL `/exec`)
- En el editor Apps Script: **Implementar → Gestionar implementaciones**.
- Abre tu implementación Web App activa → copia el **"ID de implementación"** (Deployment ID,
  empieza por `AKfyc...`).
- Pégalo en `backend/.deploy.json` sustituyendo `COLE_AQUI_O_DEPLOYMENT_ID`:
  ```json
  { "deploymentId": "AKfyc...tuDeploymentId..." }
  ```

> Si aún **no** tienes una Web App creada, hazla una vez por la UI (Implementar → Nueva
> implementación → Aplicación web) y luego copia su Deployment ID aquí. A partir de ahí,
> `npm run deploy` la republica sola.

**5. Grabar los secretos en Script Properties** (una vez)
Dos formas — elige una:

- **Opción rápida (UI):** en el editor Apps Script → **Configuración del proyecto ⚙️ →
  Propiedades de la secuencia de comandos → Añadir propiedad**, y crea:
  | Propiedad | Valor |
  |---|---|
  | `SYNC_TOKEN` | tu token compartido (el mismo de `app/config.js`) |
  | `GOOGLE_CLIENT_ID` | tu OAuth client id (`...apps.googleusercontent.com`) |
  | `ADMIN_FALLBACK` | tu email (varios separados por coma) |

- **Opción código:** edita la función `setupSecrets()` al inicio de `Code.gs` con tus valores
  reales, súbela con `npm run push`, ábrela en el editor (`npm run open`), ejecútala una vez
  (▶) y autoriza. Después vuelve a poner placeholders en `setupSecrets()` (los valores ya
  quedaron guardados en las Script Properties).

### Uso diario — a partir de aquí, todo automático
Cada vez que cambie el `Code.gs`, solo:
```bash
cd backend
npm run deploy
```
Esto hace `clasp push` (sube el código) + `clasp deploy` (republica la Web App **con la misma
URL `/exec`**). No hay que abrir el editor ni copiar/pegar nada.

Comandos útiles:
| Comando | Qué hace |
|---|---|
| `npm run deploy` | Sube el código y republica la Web App (uso normal) |
| `npm run push` | Solo sube el código (sin nueva versión de la Web App) |
| `npm run open` | Abre el proyecto Apps Script en el navegador |
| `npm run login` | Reautentica clasp si expira el token |
| `npm run status` | Muestra qué archivos subiría clasp |

### Notas / problemas comunes
- **"User has not enabled the Apps Script API"** → repite el paso 2 y espera ~1 min.
- **Error de credenciales / token expirado** → `npm run login` de nuevo.
- El `node`/`npm` vienen de nvm; en una terminal nueva ya están disponibles. Si no, ejecuta
  `source ~/.bashrc` o `nvm use --lts`.
- `.clasp.json`, `.deploy.json` y `~/.clasprc.json` **no** se versionan (contienen IDs/credenciales).

> **Actualización Fase 2 (permisos):** el `Code.gs` ahora devuelve la allowlist (admins/líderes)
> en el pull. Tras actualizarlo, **reimplanta** (Nueva versión). En la pestaña **Admin** define
> filas: `email | papel | mision` — papel = `admin` o `lider`; para líderes, `mision` = id de la
> misión (ej. `mercamadrid`, `banco`). Así el login Google reconoce el rol real.

## Login con Google (Fase 2) — Client ID
Para activar el botón "Entrar con Google" necesitas un **OAuth Client ID** (Google Cloud):
1. https://console.cloud.google.com → APIs y servicios → Credenciales → Crear credenciales → **ID de cliente OAuth** → Tipo **Aplicación web**.
2. En **Orígenes autorizados de JavaScript** añade la URL **fija** donde se hospeda el app
   (ej. `https://rogerio-s-ono.github.io`). ⚠️ El login Google **NO funciona con URLs de túnel
   temporales** — necesita un origen fijo autorizado.
3. Copia el **Client ID** (`...apps.googleusercontent.com`) y ponlo en `config.js` → `GOOGLE_CLIENT_ID`
   y en `Code.gs` → `GOOGLE_CLIENT_ID` (el mismo).
4. Mientras no haya Client ID válido + origen autorizado, el botón Google hace *fallback* al
   flujo de teléfono (el app sigue funcionando).

## Notas
- **Fase 1** cubre la **configuración compartida** (lo que edita el Admin) + la base del sync.
- Voluntarios, inscripciones (con validación de cupo por `LockService`) y checklists ya están
  soportados en el `Code.gs`, y se activan en el app en las fases siguientes.
- El app sigue siendo **offline-first**: si no hay red, usa el caché local y sincroniza al reconectar.
