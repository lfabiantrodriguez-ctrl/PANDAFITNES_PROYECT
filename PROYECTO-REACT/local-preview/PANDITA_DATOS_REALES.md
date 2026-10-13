# Mi pandita, asistencias y recompensas

Los datos de progreso se calculan en el servidor a partir de `asistencias` y `canjes_recompensas`, para el usuario autenticado. Mi pandita, el calendario, el saldo de recompensas y la ficha del socio comparten el mismo cálculo.

- Cada fecha de Lima con una entrada registrada cuenta una sola vez: 25 XP y 10 bambús. Una asistencia activa también cuenta; varias entradas el mismo día no duplican puntos.
- La racha recorre fechas consecutivas respetando los días de entrenamiento configurados en la cuenta. Los descansos no cortan la racha; una falta en un día programado sí. El día actual permite registrar la entrada antes de considerarse falta.
- Niveles: 0, 100, 300, 600 y 1.000 XP; después se sube cada 500 XP. Etapas: bebé hasta 299; intermedio hasta 999; musculoso desde 1.000.
- El saldo descuenta los canjes guardados, incluyendo pendientes y entregados. No toma un saldo inicial ni añade bonos de demostración.
- Los canjes usan el ID del catálogo: precio y stock se validan en el servidor. Una transacción bloquea la cuenta y el producto, guarda el código del canje, descuenta stock y actualiza el acumulado de canjes. El cliente no elige el precio.
- No hay puntos por tocar el panda, alimentarlo o marcar una casilla. El calendario no permite inventar asistencias ni bonos locales.
- Las pantallas consultan cada 15 segundos mientras están visibles y al recuperar el foco. Un error de conexión muestra un mensaje; no sustituye los datos con ejemplos. Con el backend anterior, se ignoran sus totales ficticios y se calcula la vista usando exclusivamente los registros autenticados de historial y canjes. Los nuevos canjes permanecen deshabilitados hasta activar el backend actualizado.
- Los iconos de estas tres pantallas son de Bootstrap Icons.

Se eliminó la inserción automática de recompensas, convenios y ofertas de ejemplo al iniciar el backend. Se conservaron los registros que ya existían en la base de datos; el administrador debe revisar su catálogo y sus canjes históricos si anteriormente se hicieron pruebas con ellos.

Validación: compilación del frontend y nueve pruebas de cálculo, fechas, rachas, niveles, saldo, precio del catálogo, stock y transacciones. No se crearon asistencias ni canjes reales durante las pruebas automatizadas.

Para activar el código nuevo, reiniciar el proceso del backend existente. El frontend sigue en http://localhost:8081. No se cambió la configuración de los puertos.
