const express = require("express");
const { listarProjetosArboviroses } = require("../controllers/sonarMunicipalController");
const { createRateLimiter } = require("../middleware/rateLimitMiddleware");

const router = express.Router();
const rateLimiter = createRateLimiter({
  keyPrefix: "sonar-municipal",
  max: 20,
  windowMs: 15 * 60 * 1000,
});

router.get(
  "/sonar-municipal/:municipioCodIbge/projetos-arboviroses",
  rateLimiter,
  listarProjetosArboviroses,
);

module.exports = router;
