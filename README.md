# Ori — Asistente de optometría clínica, terapia visual, entrenamiento visual deportivo, contactología y audiología

App local (FastAPI + React + MongoDB) pensada para ejecutarse en un PC de la clínica y usarse por la red local (LAN).

## Acceso
- Código de acceso del equipo: se define en el primer arranque (guardado con hash bcrypt; se puede cambiar en **Ajustes**). No lo escribas en este repositorio.
- Después del código: pantalla **"¿Quién eres?"** para elegir perfil (sin contraseña). La sesión se guarda en el navegador.

## Funciones (Fase 1)
- **Biblioteca**: pestañas *Común* y *Mi biblioteca*. Subida de PDF (texto o escaneado → OCR), DOCX, XLSX, PPTX, PNG/JPG.
  Los originales se guardan en disco (`STORAGE_DIR`) para verlos y descargarlos. Etiquetas, notas (Ori las usa como conocimiento), búsqueda y filtro por etiqueta.
- **Chat**: respuestas en streaming, basadas solo en tus documentos y con citas clicables `[archivo, p. X]` que abren el documento.
  Ámbito por mensaje: Mi biblioteca / Común / Ambas. "Buscar en internet" solo cuando se activa (DuckDuckGo `ddgs`, sin clave) y siempre etiquetado como "Fuente web".
  Historial por perfil; las conversaciones de otros perfiles se pueden ver en modo solo lectura. Acciones rápidas y aviso para usar solo casos anonimizados.
- **Búsqueda**: híbrida. Embeddings multilingües locales (fastembed `paraphrase-multilingual-mpnet-base-v2`) en un índice vectorial persistido en disco (`INDEX_DIR`, numpy)
  más un índice de texto de MongoDB en español, combinados con RRF. No usa ningún servicio externo.

- **Orden personalizado**: arrastra con el asa (o usa Subir/Bajar) carpetas, documentos, chuletas, plantillas, calculadoras, favoritos y acciones rápidas. Espacios compartidos guardan un orden común; los personales, por perfil.
- **Subir carpeta**: en Biblioteca (botón o arrastrando una carpeta) recrea las subcarpetas, omite archivos ocultos/no soportados y muestra un resumen. El OCR se procesa en cola (2 a la vez).
- **Copia de seguridad** (Ajustes): exporta un .zip con todos los datos y archivos originales (sin la clave de Gemini) e impórtalo en otra instalación en modo *Fusionar* o *Reemplazar todo*. El índice de búsqueda se reconstruye al importar.

## Capa de IA (`backend/llm.py`, configurable en Ajustes o en `.env`)
- **Gemini** (por defecto) con la clave gratuita del propio usuario (`GEMINI_API_KEY`), mediante el SDK oficial `google-genai`.
  Modelo `GEMINI_MODEL=gemini-3-flash-preview` y modelos de respaldo `GEMINI_FALLBACK_MODELS=gemini-3.1-flash-lite`.
  Ante 429 o 503 reintenta con espera progresiva y pasa al modelo de respaldo. Si se alcanza el límite gratuito muestra: "Ori está descansando un momento…".
- **Ollama** (opcional, local): `OLLAMA_BASE_URL`, `OLLAMA_CHAT_MODEL`, `OLLAMA_VISION_MODEL` (este último hace falta para el OCR).
- No se usa la Emergent universal key en tiempo de ejecución.

## Variables de backend (`backend/.env`)
`BACKUP_DIR` (copias automáticas), `MONGO_URL, DB_NAME, LLM_BACKEND, GEMINI_API_KEY, GEMINI_MODEL, GEMINI_FALLBACK_MODELS, OLLAMA_BASE_URL, OLLAMA_CHAT_MODEL, OLLAMA_VISION_MODEL, EMBED_MODEL, EMBED_CACHE_DIR, STORAGE_DIR, INDEX_DIR, TEAM_ACCESS_CODE, JWT_SECRET, DOWNLOADS_DIR`
Opcionales (versión Windows, las pone el lanzador): `FRONTEND_DIR` (sirve el React compilado desde FastAPI en el mismo puerto), `ORI_PORT`, `ORI_SETUP_WIZARD=1` (asistente de primer arranque), `ORI_LAUNCHER`, `HF_HUB_OFFLINE`.

## Actualizar una instalación existente (sin reinstalar)
1. Instala Node.js LTS en el PC (solo la primera vez): https://nodejs.org/es/download
2. Descarga este repositorio (Code → Download ZIP) y descomprímelo.
3. Doble clic en `actualizar-ori.bat`: compila el frontend, cierra Ori, guarda la versión actual en `%LOCALAPPDATA%\Ori\app-anterior` y copia `backend/*.py` y el frontend compilado en `%LOCALAPPDATA%\Ori\app`.
4. Si algo falla: `volver-version-anterior.bat`. Los datos (`%LOCALAPPDATA%\Ori\data`) no se tocan en ningún caso.

## Versión para Windows (Fase 2)
Instalador autónomo `OriSetup.exe` (NSIS), sin Docker ni dependencias:
- `python/` Python 3.11.9 *embeddable* + ruedas `win_amd64` (incl. `msvc-runtime` para las DLL de Visual C++), `mongodb/mongod.exe` 7.0.14 portátil,
  `backend/`, `frontend/` (React compilado con `REACT_APP_BACKEND_URL=""` → API relativa `/api`), `models/` (modelo de embeddings preinstalado, sin descarga), `downloads/` (PDF de ayuda).
- Se instala sin permisos de administrador en `%LOCALAPPDATA%\Ori\app`; los datos van a `%LOCALAPPDATA%\Ori\data` (`db`, `files`, `index`, `logs`, `secret.txt`) y se conservan al actualizar o desinstalar.
- Accesos directos: **Ori** (escritorio + Inicio), **Cerrar Ori** y **Desinstalar Ori** (Inicio). Sin arranque automático.
- `launcher.py` (con `pythonw.exe`, sin consola): arranca `mongod` (127.0.0.1:27718) y uvicorn (0.0.0.0:8765), espera a `/api/`, abre `http://localhost:8765`. `--stop` apaga MongoDB de forma ordenada y cierra el backend.
- Firewall: el instalador pide UAC una vez y crea la regla `netsh` "Ori" (TCP 8765). Pasos manuales en la guía *PC del centro*.
- Primer arranque: asistente (código del equipo, clave de Gemini, importar copia). La clave de Gemini **no** va en el instalador.

Construir (desde Linux): `python3 packaging/build_docs.py <URL> <código> <perfil> [conversación]` (capturas + PDF con Playwright) y `python3 packaging/build_windows.py` (requiere `makensis`). Resultado en `downloads/`.

## Copias automáticas
Al arrancar el backend (en segundo plano, ~20 s después) se crea `ori-backup-AAAA-MM-DD_HHMM.zip` en `BACKUP_DIR` si no hay ninguna de hoy; se conservan solo los últimos 3 días. Mismo formato que *Exportar copia*. API: `GET/PUT /api/backup/auto`, `POST /api/backup/auto/run-now`, `GET /api/backup/auto/files/<nombre>`. Autotest: `tests/autobackup_selftest.py`.

## Icono
`scripts/icon/make_icons.py` genera `frontend/public/{ori.ico,favicon.png,ori-icon.png,apple-touch-icon.png}` desde `scripts/icon/source.png` (el instalador usa `ori.ico`).

## Ayuda y descargas
Páginas **Ayuda** (manual y guías en Markdown: `frontend/public/docs/*.md`) y **Descargas** (`GET /api/downloads`, archivos en `DOWNLOADS_DIR`).

## API
OpenAPI en `/api/openapi.json`; documentación en `/api/docs`.

## Fixtures de prueba
`python tests/fixtures/make_fixtures.py` y luego `tests/fixtures/upload_fixtures.sh <API>/api <PROFILE_ID>`.
