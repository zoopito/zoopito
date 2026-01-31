const express = require("express");
const router = express.Router();
const othersController = require("../controllers/others");

router.post("/contact", othersController.contact);
router.post("/subscribe", othersController.subscribe);

module.exports = router;
