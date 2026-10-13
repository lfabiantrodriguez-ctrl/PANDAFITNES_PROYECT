process.env.TZ = "America/Lima";
require("dotenv").config({ quiet: true });
const express = require("express");
const cors = require("cors");
const apiRoutes = require("./routes");

const app = express();
const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '127.0.0.1';

app.use(cors());
app.use(express.json({ limit: "15mb" }));
app.use(express.urlencoded({ limit: "15mb", extended: true }));

// Mount central router
app.use("/api", apiRoutes);

const { finalizeEndedGuests } = require("./services/cronService");

// Finalizar invitados activos automáticamente cuando su tiempo de permanencia se cumple (cada 30 segundos)
setInterval(() => {
    finalizeEndedGuests().catch((err) => {
        console.error("Error en verificador de finalización automática de invitados:", err);
    });
}, 30000);

const { runSchemaMigrations } = require("./services/schemaMigration");

runSchemaMigrations().then(async () => {
    await require('./services/roleAccess').init();
    app.listen(PORT, HOST, () => {
        console.log(`Servidor corriendo en puerto ${PORT}`);
    });
});
