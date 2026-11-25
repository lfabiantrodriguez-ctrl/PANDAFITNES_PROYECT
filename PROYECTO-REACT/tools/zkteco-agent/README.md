# Agente ZKTeco para Panda Fitness

Soporta **3 formas** de conexión para relojes ZKTeco (K20, MB, iClock, etc.):

1. **Red LAN / Wi-Fi (`zk_live_agent.py`)**: lee el reloj cada 2 segundos por TCP (puerto 4370) y envía marcaciones en vivo a `/api/zk/marcaciones`.
2. **Pendrive USB automático (`zk_live_agent.py --usb-only` o integrado)**: detecta memorias USB con `attlog.dat` / `1_attlog.dat` y las sube al servidor. (También puedes subir el archivo directo desde la web en *Inicio → Control de Acceso → Importar USB (.dat)*).
3. **Cable USB directo a PC (`zk_usb_cable_agent.py`)**: usa `zkemkeeper.dll` (`Connect_USB`) para modelos ZKTeco con puerto USB-Client.

## Pasos rápidos
1. En Panda Fitness ve a **Configuración Empresa → Huellero / ZKTeco** y copia tu `zk_token`.
2. Edita `config.ini` con la `ip` del reloj, `server_url` y `zk_token`.
3. Registra en el reloj cada socio usando su **DNI de 8 dígitos** como `User ID`.
4. Ejecuta `iniciar_agente.bat` (o `iniciar_usb_cable.bat` si usas cable USB directo).
