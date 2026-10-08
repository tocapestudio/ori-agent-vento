# Manual de uso de Ori

Ori es tu asistente de **optometría clínica, terapia visual, entrenamiento visual deportivo, contactología y audiología**. Responde en español **basándose en tus propios documentos** y te dice claramente cuando algo no está en ellos.

> **Importante:** usa siempre **casos anonimizados** (sin nombres, DNI, teléfonos ni datos que identifiquen al paciente). Ori es una herramienta de apoyo: el juicio clínico final es tuyo.

## 1. Entrar en Ori: código y perfiles

1. Abre Ori (acceso directo **Ori** del escritorio o la dirección que te haya dado tu centro).
2. Escribe el **código de acceso del equipo** y pulsa **Entrar**.
3. Elige **¿Quién eres?** pulsando tu perfil. Puedes crear perfiles nuevos con **Añadir perfil** (nombre, color o foto). No hay contraseñas individuales.

![Pantalla de acceso](/docs/img/acceso.png)

Para cambiar de perfil o cerrar sesión, usa el menú con tu nombre (arriba a la derecha).

## 2. Chat

Escribe tu pregunta abajo y pulsa **Enviar** (o Intro). Ori busca en tus documentos y responde citando de dónde sale cada dato.

![Chat con referencias](/docs/img/chat.png)

- **Alcance**: elige dónde buscar: **Mi biblioteca**, **Común** o **Ambas**.
- **Buscar en internet**: solo si lo activas, Ori busca también en la web. Las fuentes web aparecen como **[W1]**, **[W2]**… y se pueden pulsar.
- **Referencias**: cada cita del texto, como *[archivo.pdf, p. 3]*, es un enlace. Al pulsarla se abre a la derecha el documento en la página citada (PDF), la imagen o el texto resaltado (Word, Excel, PowerPoint), con los botones **Abrir en pestaña nueva** y **Descargar**.
- **Si no está en tus documentos**, Ori lo dice ("No lo encuentro en tus documentos") y no se lo inventa.
- **Acciones rápidas**: botones con peticiones frecuentes (interpretar un caso, plan de terapia visual, audiometría, lentes de contacto…). Se pliegan solos a los 3 segundos; ábrelos con **Acciones rápidas ▸**.
- **Plantillas**: elige una plantilla en el selector para que Ori la rellene con el caso; lo que falte queda como **[pendiente]**.
- **Dictado por voz**: pulsa el micrófono y habla (funciona en Chrome o Edge). El texto aparece en el cuadro para que lo revises antes de enviar.
- **Copiar y favoritos**: debajo de cada respuesta puedes copiarla o guardarla con la estrella.

![Vista previa de una referencia](/docs/img/referencia.png)

### Conversaciones

En la columna izquierda están tus conversaciones. Puedes **buscar**, **ordenar** (Recientes, Orden personalizado, Nombre), **fijar arriba**, **renombrar** y **eliminar** desde el menú **…**. Ori pone un título automático a cada conversación nueva. Puedes ver las conversaciones de otros perfiles (solo lectura). Oculta la columna con el botón de panel o con **Ctrl+B**.

## 3. Biblioteca

Aquí subes tus documentos: **PDF (también escaneados), Word, Excel, PowerPoint e imágenes (PNG/JPG)**.

![Biblioteca](/docs/img/biblioteca.png)

- **Común** la ve todo el equipo; **Mi biblioteca** es solo tuya.
- **Subir**: botón **Subir archivos** o arrastrando archivos a la ventana.
- **Subir carpeta**: botón **Subir carpeta** o arrastrando una carpeta entera. Ori recrea las subcarpetas, omite archivos ocultos o no compatibles y te muestra un resumen.
- **Carpetas**: crea, renombra, mueve (arrastrando el documento encima de una carpeta o con **Mover a…**) y elimina. Al borrar una carpeta, su contenido pasa a la carpeta superior: nunca se borran documentos sin avisar.
- **Etiquetas y notas**: añade etiquetas para filtrar y notas propias; las notas también sirven a Ori como conocimiento.
- Los PDF escaneados y las imágenes se leen con OCR; puede tardar un poco. El estado aparece en cada tarjeta.

## 4. Chuletas

Resúmenes listos para estudiar o consultar, creados **solo a partir de los documentos que elijas**, con citas de página.

![Chuletas](/docs/img/chuletas.png)

1. Pulsa **Nueva chuleta** (o **Hacer chuleta** en un documento).
2. Elige documentos, formato (Resumen, Tabla, Esquema, Preguntas-respuesta o Libre) y, si quieres, una instrucción.
3. Puedes **editarla**, **regenerarla**, **copiarla**, **imprimirla en A4** o **guardarla en la biblioteca** para que Ori también la use al responder.

## 5. Plantillas

Crea tus modelos de informe, protocolos de terapia visual, planes de entrenamiento deportivo, audiología o contactología. Usa marcadores como `{{nombre_campo}}`. Pueden ser **comunes** (todo el equipo) o **personales**.

![Plantillas](/docs/img/plantillas.png)

## 6. Calculadoras

Cálculos exactos (sin IA) con su fórmula y referencia: amplitud de acomodación (Hofstetter), dioptrías prismáticas ↔ grados, regla de Prentice, AC/A, demanda acomodativa, equivalente esférico, transposición de cilindro, distancia al vértice, criterios de Sheard y Percival y tabla de valores normativos.

**Lentes de contacto (sobrerrefracción)**, con dos modos:

- **Sobrerrefracción con lente puesta**: combina la lente actual con la sobrerrefracción y tiene en cuenta la rotación de la lente.
- **Primera adaptación desde gafa**: aplica distancia al vértice y la compensación de rotación (LARS).

Muestra resultado exacto, lente sugerida redondeada y los pasos. Es orientativo: verifica con la guía del fabricante.

![Calculadoras](/docs/img/calculadoras.png)

## 7. Favoritos

Las respuestas y conversaciones guardadas con la estrella. Las ve todo el equipo, con quién las guardó.

## 8. Ordenar a tu gusto

En Biblioteca, Chuletas, Plantillas, Calculadoras, Favoritos, acciones rápidas y conversaciones puedes elegir **Orden personalizado** y mover elementos arrastrando el asa ⋮⋮ o con las flechas **Subir/Bajar**. También puedes ordenar por **Nombre** o **Fecha**.

## 9. Copias de seguridad

En **Ajustes → Copia de seguridad**:

- **Exportar copia de seguridad** descarga un único archivo .zip con todo (perfiles, documentos y archivos originales, carpetas, chuletas, plantillas, conversaciones, favoritos y ajustes). **Tu clave de Gemini no se incluye.**
- **Importar copia**: elige el .zip y el modo **Fusionar** (añade y actualiza) o **Reemplazar todo** (deja Ori exactamente como en la copia).

Haz una copia cada semana y guárdala en un USB o en la nube.

### Copias automáticas

En **Ajustes → Copias automáticas** (activadas por defecto): **se hace una copia al abrir Ori** (la primera vez de cada día, en segundo plano, sin esperar) **y se guardan los últimos 3 días**; las más antiguas se borran solas. Se guardan en el propio PC, en `C:\Users\<usuario>\AppData\Local\Ori\backups`, con el nombre `ori-backup-AAAA-MM-DD_HHMM.zip`, y se pueden **Descargar** desde la lista o recuperar con **Importar copia**. El botón **Hacer copia ahora** hace una al momento. Si una copia falla, verás un aviso en rojo arriba en Ori y en Ajustes.

> Las copias automáticas protegen frente a errores o borrados, pero están en el mismo PC: si el PC se estropea, se pierden. Por eso conviene además **exportar una copia** de vez en cuando y guardarla fuera (USB o nube).

![Ajustes](/docs/img/ajustes.png)

## 10. Ajustes y modelo de IA

- **Proveedor de IA**: por defecto **Gemini** (Google) con tu clave gratuita. Puedes pegar o cambiar la clave aquí.
- **Ollama (opcional)**: si tienes Ollama instalado en el PC, puedes indicar su dirección y modelos para usarlo como alternativa local.
- **Código de acceso del equipo**: cámbialo cuando quieras; todos tendrán que entrar con el nuevo.
- **Acceso desde otros equipos**: muestra la dirección para que tu equipo entre desde otros PCs y, si tienes Tailscale, la dirección para entrar desde casa.

### Límites gratuitos de Gemini

La clave gratuita tiene un número limitado de peticiones por minuto y por día. Si se alcanza, Ori muestra: *"Ori está descansando un momento (límite gratuito alcanzado)"*. Espera unos segundos o minutos y vuelve a intentarlo. Leer muchos PDF escaneados a la vez consume más; Ori los procesa en cola para no pasarse.
