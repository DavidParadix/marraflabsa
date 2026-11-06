# MARRAFLAB / PRODUCTOS THUNDER — paquete de producción

Este paquete conserva el sitio público y sustituye el acceso antiguo del administrador por Firebase Authentication. También incorpora roles, edición de registros, bitácora de actividad y carga de imágenes en Firebase Storage.

## Contenido

- `index.html`: sitio y panel administrativo actualizado.
- `firestore.rules`: reglas para contenido público, perfiles privados y bitácora.
- `storage.rules`: reglas de imágenes privadas para escritura y públicas para lectura.
- `functions/`: funciones seguras para crear cuentas y administrar roles/estados.
- `firebase.json`: configuración de despliegue.

## Antes de publicar: pasos obligatorios

1. **Haz una copia de seguridad** de Firestore y conserva el `index.html` actual.
2. En Firebase Console, abre el proyecto `marraflabsa` → Authentication → Sign-in method y habilita **Email/Password**.
3. En Authentication → Users, crea manualmente la primera cuenta del administrador con su correo real y una contraseña temporal segura. Copia su UID.
4. En Firestore, crea la colección `userRoles` y un documento cuyo ID sea exactamente ese UID. Añade estos campos:
   - `uid` (string): el UID de Authentication.
   - `name` (string): nombre del administrador.
   - `email` (string): correo de la cuenta.
   - `role` (string): `Administrador`.
   - `active` (boolean): `true`.
   - `createdBy` (string): `bootstrap`.
   - `createdAt` (timestamp): fecha y hora actuales.
5. **Elimina el campo `users`** del documento `public/marraflabDB` en Firestore. La versión antigua almacenaba allí usuarios y contraseñas. No despliegues las reglas nuevas mientras ese campo siga presente: la regla lo bloquea deliberadamente.
6. Comprueba que el documento `public/marraflabDB` conserve los campos de contenido del sitio: `brandLogos`, `seo`, `services`, `products`, `testimonials`, `gallery`, `blog` y `whatsapp`. No guardes contraseñas ni perfiles dentro de ese documento.
7. Instala Node.js 20 y Firebase CLI. En la carpeta de este paquete ejecuta:

   ```bash
   npm install -g firebase-tools
   firebase login
   firebase use marraflabsa
   cd functions
   npm install
   cd ..
   firebase deploy --only firestore:rules,storage,functions
   ```

   El despliegue de Cloud Functions requiere que el proyecto tenga habilitada la facturación de Firebase/Google Cloud (plan Blaze). Revisa los costos y límites antes de habilitarla.

8. Sube `index.html` a la raíz pública del hosting y verifica que el dominio autorizado esté agregado en Authentication → Settings → Authorized domains.
9. Abre el sitio, entra con el correo y contraseña del primer administrador y prueba: publicar, editar, eliminar, cargar una imagen, crear un editor, cambiar su rol y revisar Actividad.
10. El usuario nuevo recibe un correo de restablecimiento para establecer su propia contraseña. Si no llega, el administrador puede volver a enviar el enlace desde Usuarios.

## Roles

- **Administrador:** administra contenido, logos/SEO, usuarios, roles y consulta la actividad.
- **Editor:** administra servicios, productos, testimonios, galería, blog y opciones de WhatsApp. No puede administrar usuarios ni cambiar logos/SEO.

Los permisos no dependen solamente de ocultar botones: también se verifican en las reglas de Firestore, Storage y Cloud Functions.

## Notas de migración y seguridad

- El antiguo acceso `admin / admin123` queda deshabilitado. Ya no se aceptan usuarios ni contraseñas guardados dentro del HTML o del documento público.
- No publiques reglas abiertas como `allow read, write: if true`.
- No compartas claves privadas de cuentas de servicio ni archivos JSON de Admin SDK en el hosting.
- Las claves `apiKey` de Firebase usadas por el cliente identifican el proyecto; la seguridad real se aplica mediante Authentication y reglas.
- Las imágenes nuevas se suben a Storage; no se incrustan en el documento Firestore. Las imágenes antiguas que ya estén como URL o Base64 seguirán visibles, pero conviene migrar las Base64 antiguas a Storage para reducir el tamaño del documento.
- La bitácora registra las operaciones del panel. Las entradas son inmutables para clientes normales; administradores de proyecto con privilegios de Firebase aún pueden alterarlas desde consola, por lo que no equivale a un registro legal inviolable.
- Este paquete fue revisado estáticamente. No puedo desplegarlo en tu proyecto ni validar tus reglas, dominio, correo o facturación desde aquí. La puesta en producción solo se completa después de ejecutar los pasos y probarlo en tu Firebase real.
