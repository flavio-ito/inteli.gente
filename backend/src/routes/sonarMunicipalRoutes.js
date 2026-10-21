const express = require("express");
const { listarProjetosArboviroses } = require("../controllers/sonarMunicipalController");
const { createRateLimiter } = require("../middleware/rateLimitMiddleware");

const router = express.Router();
// A página de cada município consulta esta rota ao abrir. O Sonar é local e as
// buscas ficam em cache, então o limite só precisa barrar abuso, não poupar a API.
const rateLimiter = createRateLimiter({
  keyPrefix: "sonar-municipal",
  max: 120,
  windowMs: 15 * 60 * 1000,
});

router.get(
  "/sonar-municipal/:municipioCodIbge/projetos-arboviroses",
  rateLimiter,
  listarProjetosArboviroses,
);

module.exports = router;
