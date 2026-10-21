const { toFriendlyName } = require("./municipiosController");
const { obterPainelArboviroses } = require("../services/arbovirosesService");

const comLink = (municipio) =>
  municipio ? { ...municipio, friendlyName: toFriendlyName(municipio) } : municipio;

async function getPainelArboviroses(req, res) {
  const municipioCodIbge = Number(req.params.municipioCodIbge);

  if (!Number.isInteger(municipioCodIbge) || municipioCodIbge < 1_000_000 || municipioCodIbge > 9_999_999) {
    return res.status(400).json({ error: "Código IBGE inválido" });
  }

  try {
    const painel = await obterPainelArboviroses(municipioCodIbge);
    if (!painel) return res.status(404).json({ error: "Município não encontrado" });

    return res.json({
      ...painel,
      comparacao: {
        ...painel.comparacao,
        municipio: comLink(painel.comparacao.municipio),
        vizinhos: painel.comparacao.vizinhos.map(comLink),
      },
    });
  } catch (error) {
    console.error("Erro ao montar o painel de arboviroses:", error);
    return res.status(500).json({ error: "Erro ao carregar os dados de arboviroses" });
  }
}

module.exports = { getPainelArboviroses };
