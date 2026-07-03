const express = require("express");
const CapacityController = require("../controllers/CapacityController");

const router = express.Router();

router.get("/", CapacityController.getCapacity);
router.get("/historial", CapacityController.getHistoricalCapacity);

module.exports = router;
