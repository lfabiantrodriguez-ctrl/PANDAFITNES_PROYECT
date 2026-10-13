# Personal con perfil de socio

En Usuarios y roles, cada trabajador tiene el botón Vincular socio / Socio vinculado.

- Usar esta misma cuenta: activa un perfil de entrenamiento sin duplicar el DNI ni cambiar su rol interno. Aparece en Gestión de socios; desde allí se asigna su plan y se registra su dispositivo biométrico.
- Vincular un socio existente: utiliza los datos de entrenamiento de ese socio. Cada socio solo puede vincularse con un trabajador.
- Desvincular: elimina únicamente la relación. Conserva las cuentas, contraseñas, membresías, pagos, huellas, asistencias y canjes. Volver a vincular recupera el historial correspondiente.

La gestión de relaciones requiere ser administrador, o tener ambos permisos Usuarios y roles y Gestión de socios. Las relaciones de administradores solo las gestiona un administrador.

El vínculo añade accesos personales a Mi pandita, Mis asistencias, Mi membresía y Mis recompensas; no amplía los permisos de operación o configuración. Las recompensas personales se muestran separadas de su administración.

Las rutas personales resuelven el socio desde la relación guardada en el servidor, sin aceptar un ID de socio enviado por el navegador. El usuario autenticado y su rol interno permanecen intactos. Si el socio vinculado se desactiva, se bloquean sus funciones de entrenamiento, conservando el acceso laboral del trabajador.

El progreso utiliza asistencias reales y las reglas compartidas de puntos, rachas y niveles. Crear un perfil no asigna puntos, membresías ni asistencias. Las entradas y salidas utilizan el control de acceso existente.

La tabla staff_member_links se crea al iniciar el backend actualizado. No se vinculan cuentas automáticamente. Reiniciar el iniciador local y recargar la página para activar la versión nueva.

Validación: compilación del frontend correcta y 45 pruebas automatizadas aprobadas, incluyendo perfiles en la misma cuenta, asociación única, desvinculación, cuentas desactivadas, permisos, identidad de las rutas personales y conflictos concurrentes. Pruebas con base de datos simulada: no modifican los datos reales ni envían correos. No se ha comprobado contra la base de datos local debido a las restricciones de acceso de este entorno.
