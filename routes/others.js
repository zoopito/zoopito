const express = require("express");
const router = express.Router();
const othersController = require("../controllers/others");

router.post("/contact", othersController.contact);
router.post("/subscribe", othersController.subscribe);
router.get("/documentation", othersController.documentation);
router.get("/faqs", othersController.faqs);
router.get("/careers", othersController.Careers);

module.exports = router;
