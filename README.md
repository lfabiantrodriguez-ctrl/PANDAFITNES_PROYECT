# Panda-Fitness-gym

Aplicación web para la gestión integral del gimnasio **Panda Fitness** (React + Vite, Node.js + Express, MySQL e integración ZKTeco / USB).

## Puesta en marcha en una computadora nueva

1. **Base de datos MySQL**
   - Crea la base de datos en MySQL (o importa el esquema inicial):
     ```sql
     CREATE DATABASE IF NOT EXISTS panda_fitness CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
     ```
     También tienes el archivo completo en `PROYECTO-REACT/database/panda_fitness.sql`.

2. **Backend (`PROYECTO-REACT/backend`)**
   - Copia `PROYECTO-REACT/backend/.env.example` a `PROYECTO-REACT/backend/.env` y coloca tus credenciales de MySQL (`DB_USER`, `DB_PASSWORD`, `DB_NAME`).
   - Instala dependencias, carga los datos demo y levanta el servidor:
     ```bash
     cd PROYECTO-REACT/backend
     npm install
     npm run seed
     npm start
     ```
     *(Usa `npm run seed:reset` si deseas reiniciar los datos de prueba desde cero).*

3. **Frontend (`PROYECTO-REACT/frontend`)**
   - En otra terminal:
     ```bash
     cd PROYECTO-REACT/frontend
     npm install
     npm run dev
     ```
   - Abre `http://localhost:8081/` en el navegador.

4. **Cuentas de prueba creadas por `npm run seed`**
   - **Administrador**: DNI `00000000` / `admin@123` *(en BD nueva)*
   - **Recepción**: DNI `40100101` / `Panda2026!`
   - **Entrenador (vinculado a socio)**: DNI `40100102` / `Panda2026!`
   - **Supervisor**: DNI `40100103` / `Panda2026!`
   - **Socios demo**: DNI `71234501` .. `71234508` / `Cliente2026!`

5. **Agentes opcionales de huellero (`PROYECTO-REACT/tools/`)**
   - `tools/zkteco-agent/`: Reloj ZKTeco por red LAN/Wi-Fi (`iniciar_agente.bat`), pendrive USB `attlog.dat` y cable USB `zkemkeeper.dll` (`iniciar_usb_cable.bat`).
   - `tools/usb-reader-agent/`: Lector USB de escritorio (`iniciar_lector_usb.bat`, puerto local `9090`).
