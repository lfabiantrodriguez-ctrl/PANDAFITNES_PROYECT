const express = require("express");
const authRoutes = require("./authRoutes");
const dniRoutes = require("./dniRoutes");
const planRoutes = require("./planRoutes");
const socioRoutes = require("./socioRoutes");

const router = express.Router();

router.get("/health", (req, res) => {
    res.json({ ok: true });
});

router.use("/auth", authRoutes);
router.use("/dni", dniRoutes);
router.use("/admin/planes", planRoutes);
router.use("/admin/socios", socioRoutes);

module.exports = router;
