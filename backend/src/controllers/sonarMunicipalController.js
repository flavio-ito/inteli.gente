const {
  buscarIndicadoresRecentesMunicipio,
  buscarMunicipioPorCodigo,
} = require("../repositories/municipiosRepository");
const {
  PROFILE_INDICATOR_REFERENCES,
  buscarProjetosArboviroses,
} = require("../services/sonarMunicipalService");
const {
  gruposQueAumentaramRisco,
  obterPrevisaoArboviroses,
} = require("../services/arbovirosesService");

const DOENCAS = new Set(["dengue", "zika", "chikungunya", "febre_amarela"]);

// Grupos acionáveis que aumentaram o risco na previsão principal da doença. Se o
// módulo de previsão falhar, a busca segue pelo perfil do município.
async function previsaoParaTemas(municipioCodIbge, doenca) {
  try {
    const previsao = await obterPrevisaoArboviroses(municipioCodIbge);
    const daDoenca = previsao.doencas?.[doenca];
    const grupos = gruposQueAumentaramRisco(daDoenca);
    if (grupos.length === 0) return null;
    const principal = daDoenca.meses.find((mes) => mes.horizonte === daDoenca.principal_horizonte);
    return { doenca, ano_alvo: principal.ano_alvo, mes_alvo: principal.mes_alvo, grupos };
  } catch (error) {
    console.error("Erro ao ler a previsão de arboviroses para o Sonar Municipal:", error);
    return null;
  }
}

async function listarProjetosArboviroses(req, res) {
  const municipioCodIbge = Number(req.params.municipioCodIbge);

  if (!Number.isInteger(municipioCodIbge) || municipioCodIbge < 1_000_000 || municipioCodIbge > 9_999_999) {
    return res.status(400).json({ error: "Código IBGE inválido" });
  }

  const doenca = String(req.query.doenca || "dengue");
  if (!DOENCAS.has(doenca)) {
    return res.status(400).json({ error: "Doença inválida" });
  }

  try {
    const municipio = await buscarMunicipioPorCodigo(municipioCodIbge);
    if (!municipio) return res.status(404).json({ error: "Município não encontrado" });

    const [indicadores, previsao] = await Promise.all([
      buscarIndicadoresRecentesMunicipio(municipioCodIbge, PROFILE_INDICATOR_REFERENCES),
      previsaoParaTemas(municipioCodIbge, doenca),
    ]);
    const recomendacoes = await buscarProjetosArboviroses({ indicadores, previsao });

    return res.json(recomendacoes);
  } catch (error) {
    console.error("Erro ao consultar o Sonar Municipal:", error);
    return res.status(502).json({ error: "Sonar Municipal temporariamente indisponível" });
  }
}

module.exports = { listarProjetosArboviroses };
