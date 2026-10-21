const {
  buscarIndicadoresRecentesMunicipio,
  buscarMunicipioPorCodigo,
} = require("../repositories/municipiosRepository");
const {
  PROFILE_INDICATOR_REFERENCES,
  buscarProjetosArboviroses,
} = require("../services/sonarMunicipalService");

async function listarProjetosArboviroses(req, res) {
  const municipioCodIbge = Number(req.params.municipioCodIbge);

  if (!Number.isInteger(municipioCodIbge) || municipioCodIbge < 1_000_000 || municipioCodIbge > 9_999_999) {
    return res.status(400).json({ error: "Código IBGE inválido" });
  }

  try {
    const municipio = await buscarMunicipioPorCodigo(municipioCodIbge);
    if (!municipio) return res.status(404).json({ error: "Município não encontrado" });

    const indicadores = await buscarIndicadoresRecentesMunicipio(
      municipioCodIbge,
      PROFILE_INDICATOR_REFERENCES,
    );
    const recomendacoes = await buscarProjetosArboviroses({ indicadores });

    return res.json(recomendacoes);
  } catch (error) {
    console.error("Erro ao consultar o Sonar Municipal:", error);
    return res.status(502).json({ error: "Sonar Municipal temporariamente indisponível" });
  }
}

module.exports = { listarProjetosArboviroses };
