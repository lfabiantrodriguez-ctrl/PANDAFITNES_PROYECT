# Control de Acceso y Gestión de Huella Digital Biométrica (Panda Fitness)

Este documento explica cómo funciona el sistema de huella biométrica y cómo probarlo en computadoras, celulares y lectores compatibles.

---

## 1. Control de Acceso (Check-in) en 1 Solo Toque

- **Sin escribir DNI**: Ya **no es necesario ingresar el DNI previamente**.
- Al presionar **`Colocar huella / Validar`**:
  1. El navegador / sistema activa el lector biométrico o el celular vinculado.
  2. Al colocar el dedo en el sensor, el sistema identifica automáticamente a qué socio pertenece la huella.
  3. Comprueba el estado de su membresía y registra su **Entrada** o **Salida**.
  4. Suma automáticamente los puntos de **+25 XP y +10 bambús** en Mi Pandita.
- **Búsqueda por DNI (Opcional)**: En caso de que se desee buscar a un socio específico de forma manual, existe un botón desplegable `¿Validar por un DNI específico?` o la pestaña `Validación Manual`.

---

## 2. Gestión de Socios: Nuevo Socio y Editar

### A. Al Registrar Nuevo Socio (`Registrar Socio`)
- El formulario incluye el apartado limpio de **Huella Digital**.
- Botón directo: **`Registrar huella`** (se habilita al ingresar los 8 dígitos del DNI).
- Una vez colocada la huella en el lector o celular, el botón se transforma automáticamente en:
  - Ícono verde: `✓ Huella registrada`
  - Botón: `Cambiar` (por si se desea registrar otro dedo o dispositivo).
- Al pulsar **`Registrar Socio`**, la huella queda enlazada inmediatamente en la base de datos.

### B. Al Editar un Socio (`Editar Socio`)
- Si el socio ya tiene huella registrada en el sistema:
  - Muestra un distintivo verde con ícono de huella: `✓ Huella registrada (Biometría vinculada y activa para check-in)`.
  - Muestra el botón **`Cambiar`**.
- Si se pulsa **`Cambiar`**, se captura la nueva huella y al pulsar **`Guardar cambios`** se reemplaza la anterior.

---

## 3. Conexión de Celular con Sensor de Huellas a la Computadora

Si tu computadora de escritorio o laptop no tiene lector de huellas integrado, puedes utilizar el **sensor de huella dactilar de cualquier celular** (Android o iPhone) para registrar y validar huellas en la PC de 2 maneras:

### Método A: Cable USB / Conexión de Google Passkeys (FIDO2 Hybrid)
1. Conecta tu celular a la PC con el **cable USB** (o ten el celular cerca con Bluetooth activado).
2. En Google Chrome / Edge en la computadora (`http://localhost:8081`), pulsa **`Registrar huella`** o **`Colocar huella / Validar`**.
3. El navegador de la computadora mostrará la ventana nativa de llaves de paso con la opción:
   - **`Un teléfono o tableta`** (o detectará tu celular directamente si está vinculado a tu cuenta de Google o por cable).
   - Si muestra el código QR, abre la cámara de tu celular, apunta a la pantalla de la PC y presiona el enlace.
4. El celular te pedirá colocar tu huella dactilar en su sensor físico.
5. ¡Listo! La computadora recibe la validación criptográfica directamente desde el sensor de tu celular.

### Método B: Acceso directo desde el Navegador del Celular
Si abres la página web directamente en tu celular:
- **Mediante cable USB con reenvío de puerto (ADB)**:
  Ejecuta en la PC:
  ```bash
  adb reverse tcp:8081 tcp:8081
  adb reverse tcp:3000 tcp:3000
  ```
  Abre en Chrome de tu celular `http://localhost:8081`. El celular lo reconoce como entorno seguro local y utiliza su sensor de huellas dactilares nativo directamente.
- **Mediante túnel HTTPS (ej. ngrok, localtunnel o dominio en producción)**:
  Cualquier celular conectado a la red abre el enlace HTTPS, entra a la recepción y usa su sensor de huellas para registrar o validar acceso.

---

## 4. Pruebas y Verificación Automatizada

El backend cuenta con pruebas automatizadas completas ejecutadas con `node --test test/deviceAccess.test.cjs`:
- `✓ accepts a signed confirmation with user verification`
- `✓ rejects changed origin, challenge, RP, type, missing verification and replayed counter`
- `✓ rejects signatures from another key`
- `✓ single-use proof binds owner and operation`
- `✓ enrollment ticket binds the DNI`
- `✓ only configured secure origins are accepted`
- `✓ enrollment and attendance endpoints complete only with signed single-use proofs`
- `✓ check-in rejects a DNI without device confirmation before touching attendance`
- `✓ profile editing updates personal data without changing membership or password`
- `✓ 1-touch fingerprint authentication automatically identifies member without DNI`
