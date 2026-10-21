const test = require("node:test");
const assert = require("node:assert/strict");

const {
  buscarProjetosArboviroses,
  getSonarSearchUrl,
  montarPerfilArboviroses,
  normalizeProject,
  pesquisarSonar,
  selecionarTemasArboviroses,
} = require("../src/services/sonarMunicipalService");

function withSonarUrl(value, callback) {
  const previous = process.env.SONAR_API_URL;
  if (value === undefined) delete process.env.SONAR_API_URL;
  else process.env.SONAR_API_URL = value;
  try {
    return callback();
  } finally {
    if (previous === undefined) delete process.env.SONAR_API_URL;
    else process.env.SONAR_API_URL = previous;
  }
}

const indicador = (indicador_referencia, indicador_valor, ano = 2024) => ({
  indicador_referencia,
  indicador_valor: String(indicador_valor),
  ano,
});

const CIDADE_GRANDE_SANEADA = [
  indicador(4003, 256915, 2023),
  indicador(3117, 98.08),
  indicador(3127, 97.88),
  indicador(3122, 97.88),
  indicador(4070, 0.68, 2025),
];

const CIDADE_PEQUENA_COM_DEFICITS = [
  indicador(4003, 8200, 2023),
  indicador(3117, 61.2),
  indicador(3127, 18.5),
  indicador(3122, 70),
  indicador(4070, 12.4, 2025),
];

const sonarResult = (index, acao, extra = {}) => ({
  index,
  score: 0.9,
  municipio: "Cidade",
  uf: "SP",
  acao,
  ementa: null,
  data_apresentacao: "2021-05-04",
  link_publico: `https://sapl.cidade.sp.leg.br/materia/${index}`,
  tipo_label: "PLO Projeto de Lei Ordinária ",
  ...extra,
});

test("monta a URL de busca a partir da base local configurada", () => {
  withSonarUrl(undefined, () => assert.equal(getSonarSearchUrl(), "http://127.0.0.1:3000/api/search"));
  withSonarUrl("http://127.0.0.1:3100/", () =>
    assert.equal(getSonarSearchUrl(), "http://127.0.0.1:3100/api/search"));
  withSonarUrl("http://app:3000/sonar", () =>
    assert.equal(getSonarSearchUrl(), "http://app:3000/sonar/api/search"));
});

test("rejeita SONAR_API_URL sem protocolo HTTP", () => {
  withSonarUrl("ftp://127.0.0.1:3000", () => assert.throws(getSonarSearchUrl, /HTTP ou HTTPS/));
  withSonarUrl("nao-e-url", () => assert.throws(getSonarSearchUrl, /SONAR_API_URL inválida/));
});

test("ignora indicadores ausentes ou não numéricos ao montar o perfil", () => {
  const perfil = montarPerfilArboviroses([indicador(4003, 5000), { indicador_referencia: 3117, indicador_valor: null, ano: 2024 }]);
  assert.deepEqual(perfil.populacao, { valor: 5000, ano: 2024 });
  assert.equal(perfil.agua, null);
  assert.equal(perfil.esgoto, null);
});

test("prioriza imóveis fechados e pontos estratégicos em cidade grande com saneamento universal", () => {
  const temas = selecionarTemasArboviroses(montarPerfilArboviroses(CIDADE_GRANDE_SANEADA));
  assert.deepEqual(
    temas.map(({ id }) => id),
    ["imoveis_fechados", "pontos_estrategicos", "terrenos", "educacao"],
  );
  assert.match(temas[0].motivo, /256\.915 habitantes/);
});

test("prioriza déficits de saneamento, lixo e drenagem e limita os temas condicionais", () => {
  const temas = selecionarTemasArboviroses(montarPerfilArboviroses(CIDADE_PEQUENA_COM_DEFICITS));
  assert.deepEqual(
    temas.map(({ id }) => id),
    ["saneamento", "residuos", "drenagem", "terrenos", "educacao"],
  );
  assert.equal(
    temas[0].motivo,
    "A rede de água atende 61,2% da população e a coleta de esgoto, 18,5% (2024).",
  );
  assert.equal(temas[2].motivo, "12,4% dos domicílios urbanos estão em área de risco de inundação (2025).");
});

test("normaliza o PL removendo a sigla do tipo e links que não são HTTP", () => {
  const semLink = normalizeProject(sonarResult(7, "Limpar terrenos baldios.", { link_publico: "javascript:alert(1)", sapl_url: null }));
  assert.equal(semLink.tipo, "Projeto de Lei Ordinária");
  assert.equal(semLink.ano, 2021);
  assert.equal(semLink.link, null);

  const comSapl = normalizeProject(sonarResult(8, "Limpar terrenos baldios.", {
    link_publico: "javascript:alert(1)",
    sapl_url: "https://sapl.cidade.sp.leg.br",
  }));
  assert.equal(comSapl.link, "https://sapl.cidade.sp.leg.br");

  const tipos = ["PL-E Projeto de Lei - Executivo", "PLOl Projeto de Lei Ordinária (iniciativa do Leg)", "PROJETO DE LEI ORDINÁRIA"]
    .map((tipo_label) => normalizeProject(sonarResult(9, "Ação", { tipo_label })).tipo);
  assert.deepEqual(tipos, [
    "Projeto de Lei - Executivo",
    "Projeto de Lei Ordinária (iniciativa do Leg)",
    "Projeto de Lei Ordinária",
  ]);
});

test("prefere PLs de municípios diferentes dentro do mesmo tema", async () => {
  const temas = selecionarTemasArboviroses(montarPerfilArboviroses(CIDADE_PEQUENA_COM_DEFICITS));
  const saneamento = temas.find(({ id }) => id === "saneamento");
  const search = async (query) =>
    query === saneamento.query
      ? [
        sonarResult(1, "Implementar e ampliar redes coletoras de esgoto sanitário.", { municipio: "Votorantim" }),
        sonarResult(2, "Construir redes de distribuição de água e esgoto.", { municipio: "Votorantim" }),
        sonarResult(3, "Criar política municipal de saneamento básico e fundo de saneamento.", { municipio: "Colniza", uf: "MT" }),
      ]
      : [];

  const resultado = await buscarProjetosArboviroses({ indicadores: CIDADE_PEQUENA_COM_DEFICITS, search });

  assert.deepEqual(resultado.temas[0].projetos.map(({ id }) => id), [1, 3]);
});

test("filtra PLs fora do tema, remove cópias entre temas e limita dois por tema", async () => {
  const resultsByTheme = {
    imoveis_fechados: [
      sonarResult(1, "Instituir a entrada de agentes de endemias em imóveis abandonados, públicos ou privados."),
      sonarResult(2, "Criar programa municipal de combate à dengue."),
      sonarResult(3, "Autorizar a entrada de agentes de endemias em imóveis abandonados, públicos ou privados."),
      sonarResult(4, "Permitir o ingresso de agentes em imóveis fechados durante surtos."),
      sonarResult(5, "Instituir a entrada forçada em imóveis fechados por agentes de endemias."),
    ],
    pontos_estrategicos: [
      sonarResult(6, "Exigir que borracharias tomem medidas para evitar criadouros do Aedes."),
    ],
    terrenos: [
      sonarResult(1, "Instituir a entrada de agentes de endemias em imóveis abandonados, públicos ou privados."),
      sonarResult(8, "Limpar terrenos baldios e construções abandonadas no perímetro urbano."),
    ],
    educacao: [],
  };
  const queries = [];
  const temas = selecionarTemasArboviroses(montarPerfilArboviroses(CIDADE_GRANDE_SANEADA));
  const search = async (query) => {
    queries.push(query);
    return resultsByTheme[temas.find((tema) => tema.query === query).id];
  };

  const resultado = await buscarProjetosArboviroses({ indicadores: CIDADE_GRANDE_SANEADA, search });

  assert.equal(queries.length, 4);
  assert.deepEqual(
    resultado.temas.map(({ id, projetos }) => [id, projetos.map(({ id: projetoId }) => projetoId)]),
    [
      ["imoveis_fechados", [1, 4]],
      ["pontos_estrategicos", [6]],
      ["terrenos", [8]],
    ],
  );
  assert.deepEqual(
    resultado.perfil.map(({ id, valor }) => [id, valor]),
    [["populacao", 256915], ["agua", 98.08], ["esgoto", 97.88], ["coletaLixo", 97.88], ["riscoInundacao", 0.68]],
  );
});

test("devolve os temas disponíveis quando parte das buscas falha", async (t) => {
  const warn = t.mock.method(console, "warn", () => {});
  const search = async (query) => {
    if (query.includes("borracharias")) throw new Error("timeout");
    return [sonarResult(query.length, `Ação sobre ${query.toLowerCase()}`)];
  };

  const resultado = await buscarProjetosArboviroses({ indicadores: CIDADE_GRANDE_SANEADA, search });

  assert.deepEqual(resultado.temas.map(({ id }) => id), ["imoveis_fechados", "terrenos", "educacao"]);
  assert.equal(warn.mock.callCount(), 1);
});

test("propaga o erro quando todas as buscas no Sonar falham", async () => {
  const search = async () => {
    throw new Error("Sonar Municipal respondeu com status 500");
  };

  await assert.rejects(
    buscarProjetosArboviroses({ indicadores: CIDADE_GRANDE_SANEADA, search }),
    /status 500/,
  );
});

const jsonResponse = (status, body) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

test("repete uma vez a busca quando o Sonar devolve erro 5xx", async (t) => {
  const responses = [
    jsonResponse(500, { detail: "Falha ao buscar no Qdrant ou gerar embeddings." }),
    jsonResponse(200, { results: [sonarResult(1, "Limpar terrenos baldios.")] }),
  ];
  const fetchMock = t.mock.method(globalThis, "fetch", async () => responses.shift());

  const results = await pesquisarSonar("terrenos baldios", { retryDelayMs: 0 });

  assert.equal(fetchMock.mock.callCount(), 2);
  assert.deepEqual(results.map(({ index }) => index), [1]);
  const [url, options] = fetchMock.mock.calls[0].arguments;
  assert.equal(url, getSonarSearchUrl());
  assert.deepEqual(JSON.parse(options.body), { query: "terrenos baldios", top_k: 8 });
});

test("não repete a busca quando o Sonar rejeita a consulta", async (t) => {
  const fetchMock = t.mock.method(globalThis, "fetch", async () =>
    jsonResponse(400, { detail: "Informe a query para buscar." }));

  await assert.rejects(pesquisarSonar("", { retryDelayMs: 0 }), /status 400: Informe a query/);
  assert.equal(fetchMock.mock.callCount(), 1);
});

const PREVISAO_DEZEMBRO = {
  doenca: "dengue",
  ano_alvo: 2026,
  mes_alvo: 12,
  grupos: [
    { grupo_sigla: "servicos_de_saude", grupo_nome: "Serviços de saúde", contribuicao: 0.19 },
    { grupo_sigla: "ambiente", grupo_nome: "Ambiente e riscos", contribuicao: 0.13 },
  ],
};

test("com previsão, escolhe os temas pelos grupos que mais aumentaram o risco", () => {
  const temas = selecionarTemasArboviroses(montarPerfilArboviroses(CIDADE_GRANDE_SANEADA), PREVISAO_DEZEMBRO);

  assert.deepEqual(
    temas.map(({ id, origem }) => [id, origem]),
    [
      ["vigilancia", "previsao"],
      ["drenagem", "previsao"],
      ["agentes_endemias", "previsao"],
      ["imoveis_fechados", "previsao"],
      ["alagamento", "previsao"],
      ["pontos_estrategicos", "perfil"],
    ],
  );
  assert.equal(
    temas[0].motivo,
    "Serviços de saúde é o grupo de fatores acionáveis que mais aumentou o risco previsto de dengue para dezembro de 2026.",
  );
  assert.equal(temas[1].motivo, "Ambiente e riscos também aumentou o risco previsto de dengue para dezembro de 2026.");
  assert.match(temas[2].motivo, /^Outra frente ligada a serviços de saúde, o grupo que mais aumentou/);
});

test("sem previsão, os temas que dependem dela não entram", () => {
  const temas = selecionarTemasArboviroses(montarPerfilArboviroses(CIDADE_PEQUENA_COM_DEFICITS), null);

  assert.ok(temas.every(({ origem }) => origem === "perfil"));
  assert.ok(!temas.some(({ id }) => ["vigilancia", "agentes_endemias", "alagamento"].includes(id)));
});

test("informa quando a busca foi orientada pela previsão", async () => {
  const search = async (query) =>
    query.includes("vigilância epidemiológica")
      ? [sonarResult(1, "Instituir comitê de vigilância e enfrentamento da dengue no município.")]
      : [];

  const resultado = await buscarProjetosArboviroses({
    indicadores: CIDADE_GRANDE_SANEADA,
    previsao: PREVISAO_DEZEMBRO,
    search,
  });

  assert.equal(resultado.fonte_temas, "previsao");
  assert.deepEqual(resultado.temas.map(({ id, origem }) => [id, origem]), [["vigilancia", "previsao"]]);
  assert.deepEqual(resultado.previsao, {
    doenca: "dengue",
    ano_alvo: 2026,
    mes_alvo: 12,
    grupos: [
      { grupo_sigla: "servicos_de_saude", grupo_nome: "Serviços de saúde" },
      { grupo_sigla: "ambiente", grupo_nome: "Ambiente e riscos" },
    ],
  });
});
