const express = require("express");
const { getUsers } = require("../controllers/usersController");

const router = express.Router();

router.get("/", getUsers);

module.exports = router;





