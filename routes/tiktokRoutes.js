const express = require("express");
const { getTiktokVideo } = require("../controllers/tiktokController");

const router = express.Router();

router.get("/images/video", getTiktokVideo);

module.exports = router;
