# Puente Local para Lector USB de Escritorio (ZK4500 / ZK9500 / DigitalPersona)

Este servicio corre en la PC de recepción donde está conectado el lector USB y expone `http://127.0.0.1:9090` para que Panda Fitness capture y valide huellas directamente.

## Pasos rápidos
1. Instala el driver y SDK del fabricante en Windows (*ZKFinger SDK* para ZKTeco ZK4500/ZK9500 o *DigitalPersona OneTouch SDK*) y `pip install pywin32 requests`.
2. Copia tu `zk_token` desde **Configuración Empresa → Huellero / ZKTeco** en `config.ini`.
3. Ejecuta `iniciar_lector_usb.bat`.
4. Desde Panda Fitness (en **Registrar Socio** o **Control de Acceso**), selecciona la pestaña **Lector USB** dentro del modal biométrico.
