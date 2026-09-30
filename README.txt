SORTEO REYNOSA — PANEL, ETAPA 1

Incluye: acceso administrador /admin.html, pedidos pendientes/pagados/todos,
buscador, ventas confirmadas, disponibilidad real, reserva atómica, cancelación
que libera números, confirmación MANUAL y borrador de WhatsApp.
Los datos privados y claves se utilizan en el servidor. No se envían a la página.

ACTIVACIÓN
1. En Supabase, abre SQL Editor > New query. Pega todo database.sql y pulsa Run.
   Se crean sr_pedidos y sr_boletos. El script no borra tus otras tablas.
2. En Supabase > Authentication > Users, crea tu usuario administrador.
   Pon su correo en ADMIN_EMAIL. Tu contraseña se usa al entrar al panel.
3. En Vercel > tu proyecto > Settings > Environment Variables agrega:
   SUPABASE_URL (URL del proyecto), SUPABASE_SERVICE_ROLE_KEY (clave service_role),
   ADMIN_EMAIL (correo del usuario anterior), BASE_URL (URL de tu página).
   Conserva MP_ACCESS_TOKEN. Nunca pegues claves secretas en chats o HTML.
4. Actualiza el repositorio conectado a Vercel con los archivos de este ZIP,
   y vuelve a desplegar. Abrir /admin.html muestra el acceso.
5. Prueba primero con un pedido de prueba y Mercado Pago en sandbox.
   Confirma que aparece en Pendientes y que otra compra no puede reservar el número.
   Cancélalo desde el panel: debe volver a estar disponible.

LÍMITES DE ESTA ETAPA
- Mercado Pago crea el cobro y usa el ID del pedido como referencia, pero NO
  confirma automáticamente. Verifica el ingreso y usa Confirmar pago.
- Los apartados no vencen automáticamente: se liberan al cancelar manualmente.
- WhatsApp abre un borrador; no envía mensajes por sí solo.
- Se administra el sorteo #001. Crear más sorteos, subir comprobantes,
  selección de ganador y asistente todavía no están implementados.
- No consideres los parámetros de retorno de Mercado Pago prueba de pago.
- Antes de ventas reales, completa la prueba de extremo a extremo en tu cuenta.

LOCAL (Node 20+)
npm install
Copia .env.example como .env y configura valores. npm start.
Vercel: conserva la configuración de tu proyecto Express existente.
