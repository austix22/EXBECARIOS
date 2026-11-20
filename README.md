# Exbecarios Japón · Costa Rica

Sitio informativo estático con agenda pública y un panel privado para administrar eventos.

## Desarrollo local

Abre la carpeta del proyecto con un servidor estático local (por ejemplo, Live Server en VS Code). Los módulos de Firebase requieren `http://localhost`; no abras las páginas como archivos `file://`.

## Configurar Firebase

1. Crea un proyecto de Firebase, registra una aplicación web y copia su configuración en `js/firebase-config.js`.
2. **Opcional:** registra la aplicación en Firebase App Check con reCAPTCHA v3, agrega el dominio donde publicarás el sitio y copia la clave pública del sitio en `appCheckSiteKey`. El sitio funciona sin App Check.
3. Activa **Authentication → Sign-in method → Email/Password** y crea **Cloud Firestore**.
4. Crea la cuenta administradora desde **Authentication → Users → Add user** usando `exbecarios.japon.cr@gmail.com`. En el panel se puede iniciar sesión con el alias `ADMIN345`; Firebase valida la contraseña de esa cuenta. No habilites un formulario de registro público.
5. Copia el UID de esa cuenta en `adminUids` dentro de `js/firebase-config.js` y reemplaza `REPLACE_WITH_ADMIN_UID` en `firestore.rules` por el mismo UID.
6. Publica `firestore.rules` en Firebase Console → Firestore Database → Rules. Activa la exigencia de App Check solo si también configuraste App Check.

La configuración web de Firebase no es un secreto: el acceso se protege con las reglas de Firestore, no ocultando la configuración del navegador. La interfaz solo muestra acciones de administración al UID configurado, y las reglas vuelven a verificarlo en el servidor.

## Lecturas y cuotas

La agenda pública no usa listeners en tiempo real ni consultas repetidas. Hace una consulta con límite de 12 eventos futuros y guarda el resultado en `localStorage` durante cinco minutos. Así, una visita normal hace como máximo una lectura inicial por evento en una ventana de caché, además de las lecturas que Firebase facture por documento. App Check, si se configura, ayuda a reducir tráfico automatizado, pero ni la caché ni App Check establecen un tope diario estricto para visitantes legítimos.

El panel privado consulta hasta 50 eventos solo al iniciar sesión y después de guardar o eliminar. No se crean usuarios ni documentos al visitar la página pública.

## Publicar

El sitio no requiere compilación. Se puede publicar como GitHub Pages desde la raíz del repositorio después de configurar Firebase y las reglas. Las páginas estáticas sirven `index.html`, `admin.html`, CSS, JavaScript e imágenes.

## Contenido legal

La pestaña “Quiénes somos” resume los 25 artículos del estatuto por tema en paneles desplegables. Se incluyen los objetivos, actividades, membresía, derechos y deberes, medidas correctivas, órganos, patrimonio y disposiciones finales. Se omiten nombres y números de identificación personales de las personas fundadoras. El número de cédula jurídica no aparece en el texto disponible; confirmar el dato registral antes de reemplazar la nota pendiente en `index.html`.

El PDF del acta se excluye del repositorio mediante `.gitignore` para no publicar los datos personales que contiene.
