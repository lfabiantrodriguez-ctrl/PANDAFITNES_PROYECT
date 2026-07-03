const express = require("express");
const authRoutes = require("./authRoutes");
const dniRoutes = require("./dniRoutes");
const planRoutes = require("./planRoutes");
const socioRoutes = require("./socioRoutes");
const reservationRoutes = require("./reservationRoutes");
const capacityRoutes = require("./capacityRoutes");
const checkInRoutes = require("./checkInRoutes");
const attendanceRoutes = require("./attendanceRoutes");
const membershipRoutes = require("./membershipRoutes");

const router = express.Router();

router.get("/health", (req, res) => {
    res.json({ ok: true });
});

router.use("/auth", authRoutes);
router.use("/dni", dniRoutes);
router.use("/admin/planes", planRoutes);
router.use("/admin/socios", socioRoutes);
router.use("/admin/asistencias", attendanceRoutes);
router.use("/asistencias", attendanceRoutes);
router.use("/aforo", capacityRoutes);
router.use("/reservas", reservationRoutes);
router.use("/admin/checkin", checkInRoutes);
router.use("/membresias", membershipRoutes);

module.exports = router;
