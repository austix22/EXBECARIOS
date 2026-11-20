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

La agenda pública no usa listeners en tiempo real ni consultas repetidas. Consulta hasta seis eventos futuros y guarda el resultado en `localStorage` durante 12 horas por navegador. En cada caché vencida, la consulta lee como máximo seis documentos. La caché no es global: otro navegador, dispositivo o almacenamiento borrado hará otra consulta, por lo que no se puede garantizar que nunca se agote la cuota.

El panel privado permite hasta seis publicaciones y consulta como máximo siete documentos al iniciar sesión y después de guardar o eliminar. La séptima publicación se bloquea hasta que se elimine una. El límite se aplica en el panel; las reglas de Firestore siguen protegiendo quién puede escribir, pero no pueden contar por sí solas todos los documentos de la colección.

Cada publicación puede tener una foto. El navegador la reencoda como JPEG, elimina los metadatos y la limita a 150 KB antes de guardarla en el mismo documento de Firestore. Esto evita Cloud Storage para Firebase, que requiere el plan Blaze; a cambio, las imágenes cuentan como datos descargados de Firestore. Seis fotos al máximo pueden sumar aproximadamente 1,2 MB por consulta sin caché. El límite gratuito de Firestore incluye 50.000 lecturas diarias y 10 GiB de transferencia saliente mensual; el tráfico real puede superar esos límites. App Check, si se configura, ayuda a reducir tráfico automatizado, pero no establece un tope estricto.

## Publicar

El sitio no requiere compilación. Se puede publicar como GitHub Pages desde la raíz del repositorio después de configurar Firebase y las reglas. Las páginas estáticas sirven `index.html`, `admin.html`, CSS, JavaScript e imágenes.

## Contenido legal

La pestaña “Quiénes somos” resume los 25 artículos del estatuto por tema en paneles desplegables. Se incluyen los objetivos, actividades, membresía, derechos y deberes, medidas correctivas, órganos, patrimonio y disposiciones finales. Se omiten nombres y números de identificación personales de las personas fundadoras. El número de cédula jurídica no aparece en el texto disponible; confirmar el dato registral antes de reemplazar la nota pendiente en `index.html`.

El PDF del acta se excluye del repositorio mediante `.gitignore` para no publicar los datos personales que contiene.
