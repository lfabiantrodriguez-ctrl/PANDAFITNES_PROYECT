require("dotenv").config({ quiet: true });
const express = require("express");
const cors = require("cors");
const apiRoutes = require("./routes");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Mount central router
app.use("/api", apiRoutes);

const { checkAndCancelExpiredReservations } = require("./services/cronService");
// Iniciar verificador de tolerancia de reservas (cada 30 segundos)
setInterval(() => {
    checkAndCancelExpiredReservations().catch((err) => {
        console.error("Error en verificador en segundo plano de reservas:", err);
    });
}, 30000);

const { finalizeEndedAttendances, finalizeEndedReservations } = require("./services/cronService");
// Finalizar asistencias cuando la reserva haya terminado (cada 30 segundos)
setInterval(() => {
    finalizeEndedAttendances().catch((err) => {
        console.error("Error en verificador de finalización de asistencias:", err);
    });
}, 30000);

// Finalizar reservas confirmadas automáticamente al llegar su hora de fin (cada 30 segundos)
setInterval(() => {
    finalizeEndedReservations().catch((err) => {
        console.error("Error en verificador de finalización automática de reservas:", err);
    });
}, 30000);

app.listen(PORT, () => {
    console.log(`Servidor corriendo en puerto ${PORT}`);
});
