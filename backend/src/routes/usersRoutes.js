const express = require("express");
const { getUsers } = require("../controllers/usersController");

const router = express.Router();
router.use(require('../services/accountRuntime').requireOwner);

router.get("/", getUsers);

module.exports = router;





