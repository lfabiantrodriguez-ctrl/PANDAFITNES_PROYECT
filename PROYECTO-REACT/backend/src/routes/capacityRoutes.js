const express = require("express");
const CapacityController = require("../controllers/CapacityController");

const router = express.Router();

router.get("/", CapacityController.getCapacity);

module.exports = router;
