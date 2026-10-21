const test = require("node:test");
const assert = require("node:assert/strict");

const {
  ModuloArbovirosesIndisponivelError,
  consultar,
} = require("../src/repositories/arbovirosesRepository");
const {
  carregarTabelaComparacao,
  gruposQueAumentaramRisco,
  limparCacheArboviroses,
  montarPrevisaoDoenca,
  montarSerieCasos,
  obterPainelArboviroses,
  obterPrevisaoArboviroses,
  posicaoNoGrupo,
  vizinhosMaisProximos,
} = require("../src/services/arbovirosesService");

const SAO_CARLOS = 3548906;

test.beforeEach(() => limparCacheArboviroses());

const PRECISAO = [0.69, 0.6, 0.57, 0.57, 0.52, 0.51];
const COBERTURA = [0.75, 0.73, 0.71, 0.7, 0.7, 0.69];

// Seis horizontes a partir da referência 2026-06: os meses-alvo de julho a
// setembro já passaram, outubro a dezembro são futuros.
function previsoes({ doenca = "dengue", faixas = {}, emSurto = "false", futuro = (h) => h >= 4, flag = (v) => String(v) } = {}) {
  return [1, 2, 3, 4, 5, 6].map((horizonte) => ({
    municipio_cod_ibge: SAO_CARLOS,
    doenca,
    definicao: doenca === "dengue" ? "inc100" : "canal",
    ano: 2026,
    mes: 6,
    horizonte,
    ano_alvo: 2026,
    mes_alvo: 6 + horizonte,
    modelo_tipo: doenca === "dengue" ? "xgb" : "rf",
    escore: "0.0100",
    corte: "0.30",
    faixa_risco: faixas[horizonte] || "baixo",
    em_surto_mes_referencia: emSurto,
    precisao: String(PRECISAO[horizonte - 1]),
    cobertura: String(COBERTURA[horizonte - 1]),
    escala_shap: doenca === "dengue" ? "log_odds" : "probabilidade",
    mes_alvo_a_partir_do_atual: flag(futuro(horizonte)),
  }));
}

const fator = (horizonte, sentido, posicao, contribuicao, extra = {}) => ({
  doenca: "dengue",
  horizonte,
  sentido,
  posicao,
  fator_sigla: `${sentido}_${posicao}`,
  fator_nome: `Fator ${sentido} ${posicao}`,
  fator_unidade: "°C",
  fator_valor: "17.97",
  contribuicao: String(contribuicao),
  ...extra,
});

const grupo = (horizonte, sigla, contribuicao, acionavel) => ({
  doenca: "dengue",
  horizonte,
  grupo_sigla: sigla,
  grupo_nome: sigla,
  grupo_acionavel: acionavel,
  contribuicao: String(contribuicao),
});

function repositorioFalso(dados = {}) {
  const falhar = dados.erro ? async () => { throw dados.erro; } : null;
  return {
    buscarMunicipio: async () => dados.municipio ?? { municipio_cod_ibge: SAO_CARLOS, municipio_nome: "SÃO CARLOS", estado_sigla: "SP" },
    listarPrevisoesAtuais: falhar || (async (codigos) =>
      (dados.previsoes || []).filter((linha) => codigos.includes(linha.municipio_cod_ibge))),
    listarFatoresPrevisoesAtuais: falhar || (async () => dados.fatores || []),
    listarGruposPrevisoesAtuais: falhar || (async () => dados.grupos || []),
    listarSerieMensal: falhar || (async (codigos, siglas, anoInicial = 0) =>
      (dados.serie || []).filter((linha) =>
        codigos.includes(linha.municipio_cod_ibge) && siglas.includes(linha.variavel_sigla) && linha.ano >= anoInicial)),
    listarMunicipiosEstado: falhar || (async () => dados.municipios || []),
    listarVariaveisAnuaisEstado: falhar || (async () => dados.anuais || []),
    listarUltimosValoresMensaisEstado: falhar || (async () => dados.mensais || []),
  };
}

const erroTabelaAusente = () =>
  new ModuloArbovirosesIndisponivelError({
    code: "42P01",
    message: 'relation "bd.arbovirose_previsao_atual" does not exist',
  });

test("monta a previsão sem alerta com os meses futuros, a explicação e a cobertura como confiança", async () => {
  const repositorio = repositorioFalso({
    previsoes: previsoes(),
    fatores: [
      fator(4, "diminui", 1, -0.99, { fator_nome: "Temperatura média" }),
      fator(4, "aumenta", 2, 0.12),
      fator(4, "aumenta", 1, 0.15),
      fator(2, "aumenta", 1, 0.3),
    ],
    grupos: [
      grupo(4, "clima", -1.6, "false"),
      grupo(4, "servicos_de_saude", 0.34, "true"),
      grupo(4, "ambiente", 0.08, "1"),
    ],
  });

  const previsao = await obterPrevisaoArboviroses(SAO_CARLOS, { repositorio });
  const dengue = previsao.doencas.dengue;

  assert.equal(previsao.disponivel, true);
  assert.equal(dengue.situacao, "sem_alerta");
  assert.deepEqual(dengue.referencia, { ano: 2026, mes: 6 });
  assert.deepEqual(dengue.meses.map(({ mes_alvo: mes }) => mes), [10, 11, 12]);
  assert.equal(dengue.principal_horizonte, 4);
  assert.deepEqual(dengue.confianca, { medida: "cobertura", valor: 0.69 });
  assert.deepEqual(dengue.explicacoes.map(({ horizonte }) => horizonte), [4, 5, 6]);

  const [outubro] = dengue.explicacoes;
  assert.deepEqual(
    outubro.fatores.map(({ sentido, posicao }) => `${sentido}${posicao}`),
    ["aumenta1", "aumenta2", "diminui1"],
  );
  assert.equal(outubro.fatores[2].fator_nome, "Temperatura média");
  assert.equal(outubro.fatores[2].fator_valor, 17.97);
  assert.deepEqual(
    outubro.grupos.map(({ grupo_sigla: sigla, acionavel }) => [sigla, acionavel]),
    [["servicos_de_saude", true], ["ambiente", true], ["clima", false]],
  );
});

test("aponta início de surto no primeiro mês futuro em faixa alta e usa a precisão como confiança", () => {
  const dengue = montarPrevisaoDoenca(previsoes({ faixas: { 2: "critico", 5: "alto", 6: "critico" } }));

  assert.equal(dengue.situacao, "inicio");
  assert.equal(dengue.principal_horizonte, 5);
  assert.deepEqual(dengue.confianca, { medida: "precisao", valor: 0.52 });
});

test("trata como continuação quando o município já estava em surto, com flags gravadas como 0 e 1", () => {
  const dengue = montarPrevisaoDoenca(
    previsoes({ faixas: { 6: "alto" }, emSurto: "1", flag: (v) => (v ? "1" : "0") }),
  );

  assert.equal(dengue.em_surto_mes_referencia, true);
  assert.equal(dengue.situacao, "continuacao");
  assert.equal(dengue.principal_horizonte, 6);
  assert.deepEqual(dengue.meses.map(({ horizonte }) => horizonte), [4, 5, 6]);
});

test("informa quando todos os meses previstos já passaram", () => {
  const dengue = montarPrevisaoDoenca(previsoes({ futuro: () => false }));

  assert.equal(dengue.situacao, "sem_meses_futuros");
  assert.equal(dengue.principal_horizonte, null);
  assert.equal(dengue.confianca, null);
});

test("mostra a previsão como indisponível quando o servidor não tem as tabelas", async (t) => {
  const aviso = t.mock.method(console, "warn", () => {});
  const repositorio = repositorioFalso({ erro: erroTabelaAusente() });

  const painel = await obterPainelArboviroses(SAO_CARLOS, { repositorio });

  assert.deepEqual(painel.previsao, { doencas: {}, disponivel: false, motivo: "modulo_indisponivel" });
  assert.equal(painel.serie.disponivel, false);
  assert.equal(painel.serie.motivo, "modulo_indisponivel");
  assert.equal(painel.comparacao.disponivel, false);
  assert.equal(painel.comparacao.motivo, "modulo_indisponivel");
  assert.ok(aviso.mock.callCount() >= 2);
});

test("mostra sem previsão para município fora da cobertura do modelo", async () => {
  const repositorio = repositorioFalso({
    municipio: { municipio_cod_ibge: 2908606, municipio_nome: "CONDE", estado_sigla: "BA" },
  });

  const painel = await obterPainelArboviroses(2908606, { repositorio });

  assert.equal(painel.previsao.disponivel, false);
  assert.equal(painel.previsao.motivo, "sem_previsao");
  assert.equal(painel.serie.motivo, "sem_dados");
  assert.equal(painel.comparacao.motivo, "sem_dados");
});

test("devolve nulo para município inexistente", async () => {
  const repositorio = repositorioFalso({ municipio: null });
  repositorio.buscarMunicipio = async () => null;

  assert.equal(await obterPainelArboviroses(1234567, { repositorio }), null);
});

test("erros que não vêm do esquema continuam sendo erros", async () => {
  const repositorio = repositorioFalso({ erro: new Error("conexão recusada") });

  await assert.rejects(obterPrevisaoArboviroses(SAO_CARLOS, { repositorio }), /conexão recusada/);
});

test("classifica tabela ausente, coluna renomeada e falta de permissão como módulo indisponível", async () => {
  for (const code of ["42P01", "42703", "42804", "42501"]) {
    const query = async () => { throw Object.assign(new Error(`erro ${code}`), { code }); };
    await assert.rejects(consultar("SELECT 1", [], query), (error) => {
      assert.ok(error instanceof ModuloArbovirosesIndisponivelError);
      assert.equal(error.code, code);
      return true;
    });
  }

  const desligado = async () => { throw Object.assign(new Error("terminating connection"), { code: "57P01" }); };
  await assert.rejects(consultar("SELECT 1", [], desligado), (error) => {
    assert.ok(!(error instanceof ModuloArbovirosesIndisponivelError));
    return true;
  });
});

test("mostra NULL como zero na série e deixa ausentes os meses depois do fim", () => {
  const { doencas, ate } = montarSerieCasos([
    { variavel_sigla: "ARB_DENGUE_CASOS_CONF", ano: 2026, mes: 5, valor: null },
    { variavel_sigla: "ARB_DENGUE_CASOS_CONF", ano: 2026, mes: 6, valor: "46" },
    { variavel_sigla: "ARB_DENGUE_CASOS_CONF", ano: 2026, mes: 4, valor: "12" },
    { variavel_sigla: "ARB_FA_CASOS", ano: 2026, mes: 6, valor: null },
  ]);

  assert.deepEqual(doencas.dengue, [
    { ano: 2026, mes: 4, casos: 12 },
    { ano: 2026, mes: 5, casos: 0 },
    { ano: 2026, mes: 6, casos: 46 },
  ]);
  assert.deepEqual(doencas.febre_amarela, [{ ano: 2026, mes: 6, casos: 0 }]);
  assert.deepEqual(doencas.zika, []);
  assert.deepEqual(ate, { ano: 2026, mes: 6 });
});

test("ignora grupos acionáveis com contribuição desprezível", () => {
  const previsao = {
    principal_horizonte: 4,
    explicacoes: [{
      horizonte: 4,
      grupos: [
        { grupo_sigla: "clima", acionavel: false, contribuicao: -3.46 },
        { grupo_sigla: "sazonalidade", acionavel: false, contribuicao: -1.04 },
        { grupo_sigla: "servicos_de_saude", acionavel: true, contribuicao: 0.2 },
        { grupo_sigla: "saneamento", acionavel: true, contribuicao: 0.6 },
        { grupo_sigla: "ambiente", acionavel: true, contribuicao: 0.0001 },
      ],
    }],
  };

  assert.deepEqual(gruposQueAumentaramRisco(previsao).map(({ grupo_sigla: sigla }) => sigla), [
    "saneamento",
    "servicos_de_saude",
  ]);
  assert.deepEqual(gruposQueAumentaramRisco({ principal_horizonte: null, explicacoes: [] }), []);
});

// Dez municípios de 20 a 50 mil habitantes em linha, a 0,1 grau um do outro, e um
// grande, que fica em outra faixa de porte.
function estadoFalso() {
  const municipios = [];
  const anuais = [];
  const mensais = [];
  for (let i = 0; i < 10; i += 1) {
    const codigo = 3500001 + i;
    municipios.push({
      municipio_cod_ibge: codigo,
      municipio_nome: `M${i}`,
      estado_sigla: "SP",
      municipio_latitude: -22,
      municipio_longitude: -47 - i * 0.1,
      municipio_area: "100",
    });
    anuais.push(
      { municipio_cod_ibge: codigo, variavel_sigla: "POP_TOT", ano: 2022, valor: String(30_000 + i * 1_000) },
      { municipio_cod_ibge: codigo, variavel_sigla: "IAG0001", ano: 2024, valor: i < 4 ? "90" : String(91 + i) },
    );
    mensais.push(
      { municipio_cod_ibge: codigo, variavel_sigla: "ARB_ESF_EQUIPES", ano: 2026, mes: 6, valor: "6" },
      { municipio_cod_ibge: codigo, variavel_sigla: "ARB_ESF_EQUIPES", ano: 2026, mes: 5, valor: "99" },
      { municipio_cod_ibge: codigo, variavel_sigla: "ARB_LATENCIA_DENGUE_MED", ano: 2026, mes: 6, valor: String(i + 2) },
      { municipio_cod_ibge: codigo, variavel_sigla: "ARB_LATENCIA_DENGUE_MED", ano: 2026, mes: 5, valor: "20" },
      { municipio_cod_ibge: codigo, variavel_sigla: "ARB_LATENCIA_DENGUE_MED", ano: 2026, mes: 4, valor: "1" },
    );
  }
  municipios.push({
    municipio_cod_ibge: 3599999,
    municipio_nome: "GRANDE",
    estado_sigla: "SP",
    municipio_latitude: -22,
    municipio_longitude: -46.95,
    municipio_area: "1000",
  });
  anuais.push({ municipio_cod_ibge: 3599999, variavel_sigla: "POP_TOT", ano: 2022, valor: "900000" });
  return { municipios, anuais, mensais };
}

test("compara com municípios do mesmo porte, contando empates pela metade", async () => {
  const tabela = await carregarTabelaComparacao("SP", repositorioFalso(estadoFalso()));
  const primeiro = tabela.get(3500001);

  assert.equal(primeiro.valores.equipes_esf, 2);
  assert.equal(primeiro.periodos.equipes_esf, "06/2026");
  assert.equal(primeiro.valores.densidade, 300);
  // Mediana de 2, 20 e 1 dias.
  assert.equal(primeiro.valores.latencia_dengue, 2);

  const porte = posicaoNoGrupo(3500001, tabela);
  assert.equal(porte.nome_faixa, "de 20 mil a 50 mil habitantes");
  assert.equal(porte.n_grupo, 9);

  const agua = porte.itens.find(({ id }) => id === "agua");
  // Valor 90, empatado com 3 dos 9 pares e acima de nenhum: (0 + 3/2) / 9.
  assert.equal(agua.posicao, (100 * 1.5) / 9);
  // Pares: 90, 90, 90, 95, 96, 97, 98, 99 e 100.
  assert.equal(agua.mediana, 96);

  // Menos atraso é melhor: os 9 pares com mediana maior ficam atrás dele.
  const latencia = porte.itens.find(({ id }) => id === "latencia_dengue");
  assert.equal(latencia.posicao, 100);
  assert.ok(!porte.itens.some(({ id }) => id === "esgoto"));
});

test("não compara município sem grupo nem indicador com menos de 8 pares", async () => {
  const tabela = await carregarTabelaComparacao("SP", repositorioFalso(estadoFalso()));

  const grande = posicaoNoGrupo(3599999, tabela);
  assert.equal(grande.n_grupo, 0);
  assert.deepEqual(grande.itens, []);
});

test("ordena os vizinhos pela distância", async () => {
  const tabela = await carregarTabelaComparacao("SP", repositorioFalso(estadoFalso()));

  const vizinhos = vizinhosMaisProximos(3500001, tabela, 3);
  assert.deepEqual(
    vizinhos.map(({ item }) => item.municipio_nome),
    ["GRANDE", "M1", "M2"],
  );
  assert.ok(vizinhos[0].distancia_km < vizinhos[1].distancia_km);
});
