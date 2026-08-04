const express = require("express");
const {getTwoYearYield, getTenYearYield } = require("../controllers/fredController");

const router = express.Router();

router.get("/2y", getTwoYearYield);
router.get("/10y", getTenYearYield);


module.exports = router;