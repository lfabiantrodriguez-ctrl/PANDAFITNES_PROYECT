# Usuarios y roles

Módulo del personal en `/app/usuarios`, dentro de Configuración del sistema. Incluye dos pestañas: Usuarios y Roles y accesos.

## Funcionalidad

- Crear y editar usuarios con DNI, nombres, apellidos, correo, teléfono, rol, contraseña y estado activo/inactivo.
- Crear roles y editar las ventanas permitidas mediante casillas. Mi perfil siempre está disponible para cada cuenta.
- Excluir el rol cliente tanto del selector como de la creación y edición en el servidor. Los clientes continúan en Gestión de socios.
- Conservar el rol administrador protegido y asegurar que exista al menos un administrador activo. El usuario no puede desactivar su propia cuenta ni cambiar su propio rol desde el módulo.
- Los administradores pueden asignar todos los roles del personal. Un encargado con acceso a Usuarios y roles solo puede otorgar permisos que él mismo tiene; no puede otorgar el rol administrador, modificar administradores ni cambiar su propio rol.
- Verificar usuario activo, rol y permisos actuales en cada consulta autenticada. El servidor no confía en el rol antiguo del token para decidir permisos.
- Ocultar ventanas no asignadas en el menú de escritorio, menú móvil y navegación inferior. Las direcciones directas también están protegidas. El acceso por ventana incluye las acciones de esa ventana; no se añadieron permisos separados de lectura/escritura.
- Actualizar la sesión al recuperar foco y cada 15 segundos mientras está abierta. Un cambio de permisos aplica inmediatamente en el servidor y se refleja automáticamente en el menú.
- Usar la misma foto `avatar_url` en el perfil, barra lateral, encabezado de escritorio y encabezado móvil. Sin foto o con una imagen que no carga, se muestran las iniciales. Al guardar el perfil, los avatares de la sesión se actualizan.

## Persistencia y activación

La tabla nueva `role_access` guarda etiquetas, descripciones y permisos asociados a los roles existentes. Las contraseñas se guardan con bcrypt. No se borran usuarios ni roles y no se crea ninguna cuenta de ejemplo.

Es necesario iniciar el backend actualizado para activar las nuevas rutas y la verificación de permisos. La cuenta de base de datos debe tener permiso para crear `role_access`. Un proceso antiguo que siga abierto no puede aplicar el código nuevo.

Frontend: localhost:8081. Backend: 127.0.0.1:3000. Ambos quedan configurados para acceso local en esta computadora. No se publicó el sistema.

`local-preview/Apagar_Panda_Local.cmd` identifica las instancias de Node de este proyecto y las cierra sin iniciar otras. `local-preview/Iniciar_Solo_Local.cmd` hace ese cierre y después arranca una sola instancia del backend y del frontend, comprobando que respondan. No detienen procesos ajenos que ocupen otros puertos. Los registros del arranque quedan en `local-preview/runtime`.

El entorno de ejecución del asistente no pudo acceder a los procesos de Windows (acceso CIM denegado). Por ello, no se confirmó el cierre del proceso antiguo ni la activación real del módulo en ese proceso. Los iniciadores deben ejecutarse desde el Explorador de Windows para completar ese paso.

## Validación

Compilación del frontend y pruebas automatizadas para roles reservados, permisos, sesiones antiguas, usuarios inactivos, prohibición del rol cliente, contraseñas cifradas, prevención de escalamiento, protección del administrador y sincronía de catálogos del cliente/servidor. La prueba del avatar verifica que renderice la imagen guardada o las iniciales. Las pruebas usan datos en memoria; no crean personal ni alteran usuarios reales.
