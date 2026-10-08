# Guía: instalar Ori en el PC de casa

Esta guía es para tu ordenador de casa con **Windows 10 u 11**. No necesitas conocimientos técnicos ni instalar nada más.

## 1. Descargar el instalador

1. Entra en Ori (en línea) y abre **Descargas**, o usa el enlace que te hayan enviado.
2. Pulsa **Descargar** en **Instalador de Ori para Windows** (archivo `OriSetup.exe`, unos 1,4 GB).

## 2. Instalar

1. Haz doble clic en `OriSetup.exe`.
2. Si Windows muestra **"Windows protegió su PC"**, pulsa **Más información → Ejecutar de todas formas** (pasa porque el instalador no está firmado por una empresa).
3. Pulsa **Instalar**. Tarda unos minutos.
4. Windows te preguntará una vez si permites que **Ori** cambie la configuración (firewall). Pulsa **Sí**: así tu equipo podrá entrar desde otros PCs más adelante. En casa no es imprescindible.
5. Al terminar, deja marcado **Abrir Ori** y pulsa **Terminar**.

Se crea el acceso directo **Ori** en el escritorio y en el menú Inicio (también **Cerrar Ori**). Ori **no** se abre solo al encender el PC.

## 3. Primer arranque

1. Haz doble clic en **Ori**. Aparece un aviso "Ori se está iniciando…" y, en menos de un minuto, se abre tu navegador en `http://localhost:8765`.
2. Se abre el **asistente de bienvenida**:
   - **Código del equipo**: viene puesto `Orion9944+`. Puedes dejarlo o cambiarlo.
   - **Clave de Gemini**: ver el paso 4.
   - **Copia de seguridad**: en casa, la primera vez, pulsa **Empezar sin copia**.
3. Entra con el código y crea tu perfil.

![Asistente de bienvenida](/docs/img/asistente.png)

## 4. Conseguir tu clave gratuita de Gemini

1. Entra en **https://aistudio.google.com/apikey** con tu cuenta de Google.
2. Pulsa **Create API key** (Crear clave) y cópiala (empieza por `AIza…`).
3. Pégala en el asistente o, más tarde, en **Ajustes → Proveedor de IA → Clave de Gemini** y pulsa **Guardar**.

La clave es gratuita y personal: no la compartas. Ori nunca la incluye en las copias de seguridad.

## 5. Empezar a usar Ori

1. Ve a **Biblioteca** y sube tus documentos (o una carpeta entera con **Subir carpeta**).
2. Espera a que pasen a **Listo**.
3. Ve a **Chat** y pregunta. Lee el **Manual** (en **Ayuda**) para conocer todas las funciones.

## 6. Hacer copias de seguridad

1. **Ajustes → Copia de seguridad → Exportar copia de seguridad**.
2. Guarda el `.zip` en un USB o en tu nube (Google Drive, OneDrive…).
3. Esta copia es la que usarás para pasar todo al **PC del centro**.

Además, Ori hace **copias automáticas** cada día al abrirse y guarda las de los últimos 3 días en `AppData\Local\Ori\backups` (ver **Ajustes → Copias automáticas**). Aun así, guarda de vez en cuando una copia exportada fuera del PC.

## 7. Cerrar Ori

Usa **Cerrar Ori** (menú Inicio) o **Ajustes → Cerrar Ori en este PC**. Cerrar solo la pestaña del navegador no apaga Ori.

## Dónde se guardan tus datos

En `C:\Users\<tu usuario>\AppData\Local\Ori\data`. Se conservan aunque actualices o reinstales Ori.
