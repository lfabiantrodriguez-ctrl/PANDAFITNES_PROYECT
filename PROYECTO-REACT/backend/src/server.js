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

app.listen(PORT, () => {
    console.log(`Servidor corriendo en puerto ${PORT}`);
});
