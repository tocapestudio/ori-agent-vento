# Guía: instalar Ori en el PC del centro

El PC del centro será el "servidor": tiene los datos y el resto del equipo entra desde sus ordenadores por la red del centro. Tú podrás entrar desde casa con **Tailscale** (gratis).

> **Recuerda:** el PC del centro tiene que estar **encendido** y con **Ori abierto** para que el equipo (y tú desde casa) puedan usarlo. Fuera del horario, al apagarlo, Ori no estará disponible.

## 1. Instalar

Sigue los pasos 1 y 2 de la guía **PC de casa** (descargar `OriSetup.exe` e instalar). Cuando Windows pregunte por el **firewall**, pulsa **Sí**: es necesario para que el equipo pueda entrar.

## 2. Importar la copia desde casa

1. En el PC de casa: **Ajustes → Copia de seguridad → Exportar copia de seguridad**. Lleva el `.zip` en un USB o súbelo a tu nube.
2. En el PC del centro, abre **Ori**. En el asistente:
   - Deja el código y pulsa **Siguiente**.
   - Pega tu **clave de Gemini** (la copia no la incluye).
   - En **Copia de seguridad**, elige el `.zip` y pulsa **Importar copia**.
3. Entra con el **código de acceso que tenías en casa**. Tendrás todos tus documentos, chuletas, plantillas y conversaciones.

Si Ori ya estaba en uso, también puedes importar desde **Ajustes → Copia de seguridad → Importar copia** (modo **Reemplazar todo** o **Fusionar**).

## 3. Permitir el acceso en el firewall

El instalador crea la regla automáticamente (puerto **8765**). Si el equipo no consigue entrar:

1. Pulsa Inicio, escribe **Firewall de Windows Defender** y ábrelo.
2. **Permitir una aplicación o una característica…** → **Cambiar la configuración** → **Permitir otra aplicación…**
3. Busca `C:\Users\<usuario>\AppData\Local\Ori\app\python\python.exe`, añádelo y marca **Privada** y **Pública**.

Opción alternativa (avanzada): abre **Símbolo del sistema como administrador** y escribe:

`netsh advfirewall firewall add rule name="Ori" dir=in action=allow protocol=TCP localport=8765`

## 4. Que el equipo entre desde otros PCs

1. En el PC del centro, ve a **Ajustes → Acceso desde otros equipos**. Verás algo como **Dirección para tu equipo: http://192.168.1.50:8765**.
2. En los otros ordenadores (conectados a la **misma wifi o red** del centro), abre Chrome o Edge y escribe esa dirección.
3. Entran con el código del equipo y eligen su perfil. Guarda la dirección en **Favoritos** del navegador.

### Opcional: fijar la IP del PC del centro

La dirección puede cambiar si se reinicia el router. Para que sea siempre la misma, pide a quien gestione el router que haga una **reserva DHCP** (IP fija) para el PC del centro. Mientras tanto, si deja de funcionar, mira la dirección nueva en **Ajustes**.

## 5. Entrar desde casa con Tailscale

Tailscale crea una conexión privada y segura entre tus ordenadores, sin abrir nada en el router. Es gratis para uso personal.

**En el PC del centro:**

1. Descarga Tailscale de **https://tailscale.com/download/windows** e instálalo.
2. Inicia sesión (por ejemplo, con tu cuenta de Google). Crea la cuenta si es la primera vez.
3. Ori mostrará en **Ajustes** la dirección **Desde casa con Tailscale** (por ejemplo `http://pc-centro.tu-red.ts.net:8765` o `http://100.x.y.z:8765`).

**En el PC de casa (o portátil):**

1. Instala Tailscale e inicia sesión con **la misma cuenta**.
2. Abre el navegador y escribe la dirección de Tailscale que viste en Ajustes, por ejemplo `http://pc-centro:8765`.

Si no funciona, comprueba en el icono de Tailscale (junto al reloj) que ambos PCs aparecen **conectados**.

## 6. Rutina diaria

- Al llegar: enciende el PC del centro y haz doble clic en **Ori**. Al abrirse, Ori hace sola la **copia automática del día** (se guardan los últimos 3 días en el propio PC).
- Al irte: **Cerrar Ori** (o simplemente apagar el PC).
- Cada semana: **Exportar copia de seguridad** y guárdala **fuera del PC** (USB u OneDrive/Google Drive): las copias automáticas están en el mismo PC y no sirven si este se estropea.
- Si ves el aviso rojo **"La última copia de seguridad automática ha fallado"**, entra en **Ajustes → Copias automáticas** y pulsa **Hacer copia ahora**.
