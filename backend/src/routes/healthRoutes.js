const express = require("express");
const router = express.Router();

router.get("/", (req, res) => {
    res.statuscode(200).json
});

module.exports = router;