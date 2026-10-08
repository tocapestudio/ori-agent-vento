# Problemas frecuentes

## "Ori no ha podido arrancar" (primera versión del instalador)

La primera versión del instalador no incluía un pequeño componente de Windows. Para arreglarlo sin reinstalar:

1. En **Descargas**, baja **OriParche.exe** (unos 5 MB).
2. Haz doble clic, pulsa **Instalar** y, al final, **Abrir Ori**. Tus datos no se tocan.
3. Si sigue fallando, abre **Inicio → Ori → Diagnóstico de Ori**: crea un archivo `Ori-diagnostico-….zip` en el escritorio. Envíalo a quien te ayude.

## Ori no abre

1. Espera hasta **1 minuto**: la primera vez tarda más porque carga el buscador de documentos.
2. Si no se abre el navegador, escribe tú mismo `http://localhost:8765`.
3. Usa **Cerrar Ori** (menú Inicio), espera 10 segundos y vuelve a abrir **Ori**.
4. Reinicia el PC y prueba de nuevo.
5. Si sigue sin abrir, mira los registros en `C:\Users\<usuario>\AppData\Local\Ori\data\logs` (archivos `ori.log` y `mongod.log`) y envíaselos a quien te ayude.

## "El puerto 8765 está ocupado"

Otro programa usa el mismo puerto, o Ori ya está abierto.

1. Prueba a abrir `http://localhost:8765` en el navegador: si aparece Ori, ya estaba abierto.
2. Si no, usa **Cerrar Ori**, reinicia el PC y vuelve a abrir Ori.

## El equipo no puede entrar desde otros PCs

- Comprueba que el PC del centro está **encendido** y con **Ori abierto**.
- Todos deben estar en la **misma red** (misma wifi o cable del centro).
- Usa la dirección exacta de **Ajustes → Acceso desde otros equipos** (empieza por `http://`, no `https://`, y termina en `:8765`).
- Revisa el **firewall** (guía *PC del centro*, paso 3).
- Si la red de Windows está marcada como **Pública**, cámbiala a **Privada**: Configuración → Red e Internet → tu red → Perfil de red: **Privada**.

## Desde casa no conecta (Tailscale)

- Los dos PCs deben tener Tailscale abierto y con **la misma cuenta**.
- El PC del centro debe estar encendido y con Ori abierto.
- Prueba con la dirección `http://100.x.y.z:8765` que aparece en Ajustes del PC del centro.

## "Ori está descansando un momento (límite gratuito alcanzado)"

La clave gratuita de Gemini tiene un límite de peticiones por minuto y por día.

- Espera unos segundos y vuelve a preguntar.
- Si pasa mucho, sube los PDF escaneados en tandas más pequeñas.
- El límite diario se renueva cada día.

## "La última copia de seguridad automática ha fallado"

Ori hace una copia al abrirse cada día. Si falla, aparece un aviso rojo arriba.

1. Entra en **Ajustes → Copias automáticas** y lee el motivo.
2. Comprueba que el disco no está lleno (las copias se guardan en `AppData\Local\Ori\backups`).
3. Pulsa **Hacer copia ahora**. Si funciona, el aviso desaparece.
4. Mientras tanto, usa **Exportar copia de seguridad** para guardar una copia manual.

## Cambiar la clave de Gemini

**Ajustes → Proveedor de IA → Clave de Gemini**: pega la nueva y pulsa **Guardar**. Puedes crear o borrar claves en **https://aistudio.google.com/apikey**.

## Olvidé el código de acceso

Pide el código a otra persona del equipo que esté dentro y cámbialo en **Ajustes → Código de acceso**. Si nadie puede entrar, contacta con tu soporte: se puede restablecer desde el PC del centro.

## Actualizar Ori sin perder datos

1. Por seguridad, haz antes **Exportar copia de seguridad**.
2. Descarga el nuevo `OriSetup.exe` y ejecútalo encima del anterior. El instalador cierra Ori, actualiza el programa y **conserva tus datos** (están en `AppData\Local\Ori\data`).
3. Abre **Ori** de nuevo.

## Desinstalar

Inicio → **Ori → Desinstalar Ori** (o Configuración → Aplicaciones). Te preguntará si quieres borrar también tus datos; por defecto **se conservan**.
