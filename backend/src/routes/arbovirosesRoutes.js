const express = require("express");
const { getPainelArboviroses } = require("../controllers/arbovirosesController");

const router = express.Router();

router.get("/municipios/:municipioCodIbge/arboviroses", getPainelArboviroses);

module.exports = router;
