const repositorioPadrao = require("../repositories/arbovirosesRepository");

const { ModuloArbovirosesIndisponivelError } = repositorioPadrao;

// Doenças com previsão. Febre amarela tem poucos surtos para um modelo e aparece
// só na série observada.
const DOENCAS_PREVISAO = ["dengue", "zika", "chikungunya"];
const SIGLAS_CASOS_CONFIRMADOS = {
  dengue: "ARB_DENGUE_CASOS_CONF",
  zika: "ARB_ZIKA_CASOS_CONF",
  chikungunya: "ARB_CHKGNYA_CASOS_CONF",
  febre_amarela: "ARB_FA_CASOS",
};
const FAIXAS_ALERTA = new Set(["alto", "critico"]);

// Os dados mudam uma vez por mês, na carga do pipeline. O estado "indisponível"
// expira logo, para a tela passar a mostrar os dados assim que a migration entrar.
const CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const CACHE_INDISPONIVEL_TTL_MS = 5 * 60 * 1000;

// Comparação com municípios de porte parecido, como no aplicativo do projeto de
// arboviroses: faixas de população do IBGE, posição de 0 a 100 entre os pares.
const FAIXAS_PORTE = [0, 5_000, 10_000, 20_000, 50_000, 100_000, 500_000, Infinity];
const NOMES_PORTE = [
  "até 5 mil habitantes",
  "de 5 mil a 10 mil habitantes",
  "de 10 mil a 20 mil habitantes",
  "de 20 mil a 50 mil habitantes",
  "de 50 mil a 100 mil habitantes",
  "de 100 mil a 500 mil habitantes",
  "mais de 500 mil habitantes",
];
// A capital paulista tem 11,9 milhões de habitantes e o segundo maior município
// não chega a 1,5 milhão: não há grupo de comparação honesto para ela.
const MUNICIPIOS_SEM_GRUPO = new Set([3550308]);
// Com menos pares que isso, a posição no grupo vira ruído.
const MIN_PARES = 8;
const NUMERO_VIZINHOS = 8;
const MESES_INCIDENCIA_VIZINHOS = 3;
const MESES_LATENCIA = 12;

const VARIAVEIS_ANUAIS = { agua: "IAG0001", esgoto: "IES0001", populacao: "POP_TOT", idhm: "IDHM" };
const VARIAVEIS_MENSAIS = {
  cobertura_aps: "ARB_ESF_COBERTURA",
  equipes_esf: "ARB_ESF_EQUIPES",
  latencia_dengue: "ARB_LATENCIA_DENGUE_MED",
};

// maiorMelhor: true quando mais é melhor, false quando menos é melhor e null nos
// indicadores de contexto, que não têm melhor nem pior.
const INDICADORES_COMPARACAO = [
  { id: "cobertura_aps", tema: "saude", rotulo: "Cobertura da atenção primária", unidade: "%", maiorMelhor: true },
  { id: "equipes_esf", tema: "saude", rotulo: "Equipes de saúde da família por 10 mil habitantes", unidade: "", maiorMelhor: true },
  { id: "latencia_dengue", tema: "saude", rotulo: "Atraso entre sintomas e notificação da dengue", unidade: "dias", maiorMelhor: false },
  { id: "agua", tema: "saneamento", rotulo: "População com abastecimento de água", unidade: "%", maiorMelhor: true },
  { id: "esgoto", tema: "saneamento", rotulo: "População com coleta de esgoto", unidade: "%", maiorMelhor: true },
  { id: "densidade", tema: "contexto", rotulo: "Densidade populacional", unidade: "hab./km²", maiorMelhor: null },
  { id: "idhm", tema: "contexto", rotulo: "IDHM (2010)", unidade: "", maiorMelhor: null },
];

function lerFlag(valor) {
  if (valor === true || valor === 1) return true;
  if (valor === false || valor === 0) return false;
  const texto = String(valor ?? "").trim().toLowerCase();
  if (["true", "t", "1"].includes(texto)) return true;
  if (["false", "f", "0"].includes(texto)) return false;
  return null;
}

function paraNumero(valor) {
  if (valor === null || valor === undefined || valor === "") return null;
  const numero = Number(valor);
  return Number.isFinite(numero) ? numero : null;
}

const indiceMes = (ano, mes) => Number(ano) * 12 + Number(mes) - 1;
const mesDoIndice = (indice) => ({ ano: Math.floor(indice / 12), mes: (indice % 12) + 1 });

function mediana(valores) {
  const ordenados = valores.filter(Number.isFinite).sort((a, b) => a - b);
  if (ordenados.length === 0) return null;
  const meio = Math.floor(ordenados.length / 2);
  return ordenados.length % 2 ? ordenados[meio] : (ordenados[meio - 1] + ordenados[meio]) / 2;
}

function criarCache() {
  const entradas = new Map();
  return {
    obter(chave, carregar, ttl) {
      const atual = entradas.get(chave);
      if (atual && atual.expiraEm > Date.now()) return atual.promessa;

      const promessa = carregar()
        .then((valor) => {
          const entrada = entradas.get(chave);
          if (entrada?.promessa === promessa) entrada.expiraEm = Date.now() + ttl(valor);
          return valor;
        })
        .catch((error) => {
          entradas.delete(chave);
          throw error;
        });
      entradas.set(chave, { promessa, expiraEm: Date.now() + CACHE_TTL_MS });
      return promessa;
    },
    limpar() {
      entradas.clear();
    },
  };
}

const cachePrevisao = criarCache();
const cachePainel = criarCache();
const cacheComparacaoEstado = criarCache();
const ttlPorDisponibilidade = (resultado) =>
  resultado?.disponivel === false || resultado?.previsao?.disponivel === false
    ? CACHE_INDISPONIVEL_TTL_MS
    : CACHE_TTL_MS;

function limparCacheArboviroses() {
  cachePrevisao.limpar();
  cachePainel.limpar();
  cacheComparacaoEstado.limpar();
}

// Converte a falta das tabelas (servidor sem a migration) num resultado
// "indisponível"; qualquer outro erro continua sendo erro.
async function comModuloOpcional(carregar, vazio) {
  try {
    return await carregar();
  } catch (error) {
    if (!(error instanceof ModuloArbovirosesIndisponivelError)) throw error;
    console.warn(error.message);
    return { ...vazio, disponivel: false, motivo: "modulo_indisponivel" };
  }
}

function mapearMes(linha) {
  return {
    horizonte: Number(linha.horizonte),
    ano_alvo: Number(linha.ano_alvo),
    mes_alvo: Number(linha.mes_alvo),
    faixa_risco: linha.faixa_risco,
    escore: paraNumero(linha.escore),
    corte: paraNumero(linha.corte),
    precisao: paraNumero(linha.precisao),
    cobertura: paraNumero(linha.cobertura),
  };
}

function mapearFator(linha) {
  return {
    sentido: linha.sentido,
    posicao: Number(linha.posicao),
    fator_sigla: linha.fator_sigla,
    fator_nome: linha.fator_nome,
    fator_unidade: linha.fator_unidade || null,
    fator_valor: paraNumero(linha.fator_valor),
    contribuicao: paraNumero(linha.contribuicao),
  };
}

function mapearGrupo(linha) {
  return {
    grupo_sigla: linha.grupo_sigla,
    grupo_nome: linha.grupo_nome,
    acionavel: lerFlag(linha.grupo_acionavel) === true,
    contribuicao: paraNumero(linha.contribuicao),
  };
}

// Regras de leitura do módulo (docs/BANCO_ARBOVIROSES.md do projeto de arboviroses):
// futuro é o mês-alvo a partir do atual; surto previsto é faixa alta ou crítica;
// início exige que o município não estivesse em surto no mês de referência.
function montarPrevisaoDoenca(linhas, fatores = [], grupos = []) {
  const ordenadas = [...linhas].sort((a, b) => Number(a.horizonte) - Number(b.horizonte));
  const base = ordenadas[0];
  const meses = ordenadas
    .filter((linha) => lerFlag(linha.mes_alvo_a_partir_do_atual) === true)
    .map(mapearMes);
  const alerta = meses.find((mes) => FAIXAS_ALERTA.has(mes.faixa_risco)) || null;
  const emSurto = lerFlag(base.em_surto_mes_referencia);
  const principal = alerta || meses[0] || null;

  let situacao = "sem_alerta";
  if (!principal) situacao = "sem_meses_futuros";
  else if (alerta) situacao = emSurto ? "continuacao" : "inicio";

  // Com alerta, a confiança é a precisão do modelo daquele horizonte. Sem alerta,
  // a menor cobertura entre os meses exibidos: o quanto o modelo costuma antecipar
  // um surto, para deixar claro que a ausência de alerta não é garantia.
  let confianca = null;
  if (alerta && alerta.precisao !== null) {
    confianca = { medida: "precisao", valor: alerta.precisao };
  } else if (!alerta) {
    const coberturas = meses.map((mes) => mes.cobertura).filter(Number.isFinite);
    if (coberturas.length) confianca = { medida: "cobertura", valor: Math.min(...coberturas) };
  }

  const explicacoes = meses.map((mes) => ({
    horizonte: mes.horizonte,
    fatores: fatores
      .filter((fator) => Number(fator.horizonte) === mes.horizonte)
      .map(mapearFator)
      .sort((a, b) => a.sentido.localeCompare(b.sentido) || a.posicao - b.posicao),
    grupos: grupos
      .filter((grupo) => Number(grupo.horizonte) === mes.horizonte)
      .map(mapearGrupo)
      .sort((a, b) => b.contribuicao - a.contribuicao),
  }));

  return {
    definicao: base.definicao,
    modelo_tipo: base.modelo_tipo,
    escala_shap: base.escala_shap || null,
    referencia: { ano: Number(base.ano), mes: Number(base.mes) },
    em_surto_mes_referencia: emSurto,
    situacao,
    principal_horizonte: principal ? principal.horizonte : null,
    confianca,
    meses,
    explicacoes,
  };
}

async function carregarPrevisao(municipioCodIbge, repositorio) {
  const linhas = await repositorio.listarPrevisoesAtuais([municipioCodIbge]);
  if (linhas.length === 0) return { disponivel: false, motivo: "sem_previsao", doencas: {} };

  const [fatores, grupos] = await Promise.all([
    repositorio.listarFatoresPrevisoesAtuais(municipioCodIbge),
    repositorio.listarGruposPrevisoesAtuais(municipioCodIbge),
  ]);
  const doencas = {};
  for (const doenca of DOENCAS_PREVISAO) {
    const daDoenca = linhas.filter((linha) => linha.doenca === doenca);
    if (daDoenca.length === 0) continue;
    doencas[doenca] = montarPrevisaoDoenca(
      daDoenca,
      fatores.filter((fator) => fator.doenca === doenca),
      grupos.filter((grupo) => grupo.doenca === doenca),
    );
  }
  return { disponivel: true, motivo: null, doencas };
}

function obterPrevisaoArboviroses(municipioCodIbge, { repositorio = repositorioPadrao } = {}) {
  return cachePrevisao.obter(
    municipioCodIbge,
    () => comModuloOpcional(() => carregarPrevisao(municipioCodIbge, repositorio), { doencas: {} }),
    ttlPorDisponibilidade,
  );
}

// Grupos acionáveis por política municipal que aumentaram o risco na previsão
// principal da doença, do maior para o menor. Base dos temas do Sonar Municipal.
// Um grupo com contribuição desprezível (abaixo de 1% da soma das contribuições,
// em módulo, dos 10 grupos daquela previsão) não conta: o texto do card diria que
// ele "aumentou o risco" por um empurrão que o modelo mal registra.
const CONTRIBUICAO_MINIMA_RELATIVA = 0.01;

function gruposQueAumentaramRisco(previsaoDoenca) {
  if (!previsaoDoenca || previsaoDoenca.principal_horizonte === null) return [];
  const explicacao = previsaoDoenca.explicacoes.find(
    (item) => item.horizonte === previsaoDoenca.principal_horizonte,
  );
  const grupos = explicacao?.grupos || [];
  const total = grupos.reduce((soma, grupo) => soma + Math.abs(grupo.contribuicao || 0), 0);
  return grupos
    .filter(
      (grupo) =>
        grupo.acionavel &&
        grupo.contribuicao > 0 &&
        grupo.contribuicao >= CONTRIBUICAO_MINIMA_RELATIVA * total,
    )
    .sort((a, b) => b.contribuicao - a.contribuicao);
}

function montarSerieCasos(linhas) {
  const doencas = {};
  let ultimo = -Infinity;
  for (const [doenca, sigla] of Object.entries(SIGLAS_CASOS_CONFIRMADOS)) {
    // NULL no SINAN é "nenhuma notificação no mês": no gráfico, zero. Meses depois
    // do fim da série não vêm do banco e continuam ausentes.
    doencas[doenca] = linhas
      .filter((linha) => linha.variavel_sigla === sigla)
      .map((linha) => {
        ultimo = Math.max(ultimo, indiceMes(linha.ano, linha.mes));
        return { ano: Number(linha.ano), mes: Number(linha.mes), casos: paraNumero(linha.valor) ?? 0 };
      })
      .sort((a, b) => indiceMes(a.ano, a.mes) - indiceMes(b.ano, b.mes));
  }
  return { doencas, ate: Number.isFinite(ultimo) ? mesDoIndice(ultimo) : null };
}

async function carregarSerie(municipioCodIbge, repositorio) {
  const linhas = await repositorio.listarSerieMensal(
    [municipioCodIbge],
    Object.values(SIGLAS_CASOS_CONFIRMADOS),
  );
  if (linhas.length === 0) return { disponivel: false, motivo: "sem_dados", doencas: {}, ate: null };
  return { disponivel: true, motivo: null, ...montarSerieCasos(linhas) };
}

function faixaDePorte(populacao) {
  for (let i = 0; i < FAIXAS_PORTE.length - 1; i += 1) {
    if (populacao >= FAIXAS_PORTE[i] && populacao < FAIXAS_PORTE[i + 1]) return i;
  }
  return FAIXAS_PORTE.length - 2;
}

const formatarMesAno = ({ ano, mes }) => `${String(mes).padStart(2, "0")}/${ano}`;

// Uma linha por município do estado, com o último valor de cada indicador.
async function carregarTabelaComparacao(estadoSigla, repositorio) {
  const [municipios, anuais, mensais] = await Promise.all([
    repositorio.listarMunicipiosEstado(estadoSigla),
    repositorio.listarVariaveisAnuaisEstado(estadoSigla, Object.values(VARIAVEIS_ANUAIS)),
    repositorio.listarUltimosValoresMensaisEstado(
      estadoSigla,
      Object.values(VARIAVEIS_MENSAIS),
      MESES_LATENCIA,
    ),
  ]);

  const tabela = new Map(
    municipios.map((municipio) => [
      Number(municipio.municipio_cod_ibge),
      {
        municipio_cod_ibge: Number(municipio.municipio_cod_ibge),
        municipio_nome: municipio.municipio_nome,
        estado_sigla: municipio.estado_sigla,
        latitude: paraNumero(municipio.municipio_latitude),
        longitude: paraNumero(municipio.municipio_longitude),
        area: paraNumero(municipio.municipio_area),
        valores: {},
        periodos: {},
      },
    ]),
  );

  const siglaAnual = Object.fromEntries(Object.entries(VARIAVEIS_ANUAIS).map(([id, sigla]) => [sigla, id]));
  for (const linha of anuais) {
    const item = tabela.get(Number(linha.municipio_cod_ibge));
    const id = siglaAnual[linha.variavel_sigla];
    if (!item || !id) continue;
    item.valores[id] = paraNumero(linha.valor);
    item.periodos[id] = String(linha.ano);
  }

  const siglaMensal = Object.fromEntries(Object.entries(VARIAVEIS_MENSAIS).map(([id, sigla]) => [sigla, id]));
  const latencias = new Map();
  for (const linha of mensais) {
    const item = tabela.get(Number(linha.municipio_cod_ibge));
    const id = siglaMensal[linha.variavel_sigla];
    if (!item || !id) continue;
    if (id === "latencia_dengue") {
      // Um mês só é ruidoso (um caso atrasado muda tudo): mediana dos últimos 12
      // meses com notificação.
      const lista = latencias.get(item.municipio_cod_ibge) || [];
      lista.push(paraNumero(linha.valor));
      latencias.set(item.municipio_cod_ibge, lista);
    } else if (item.valores[id] === undefined) {
      // As linhas chegam do mês mais recente para o mais antigo.
      item.valores[id] = paraNumero(linha.valor);
      item.periodos[id] = formatarMesAno(linha);
    }
  }
  for (const [codigo, lista] of latencias) {
    const item = tabela.get(codigo);
    item.valores.latencia_dengue = mediana(lista);
    item.periodos.latencia_dengue = `últimos ${lista.length} meses com notificação`;
  }

  for (const item of tabela.values()) {
    const { populacao, equipes_esf: equipes } = item.valores;
    item.valores.equipes_esf =
      Number.isFinite(equipes) && populacao > 0 ? (equipes / populacao) * 10_000 : null;
    item.valores.densidade =
      populacao > 0 && item.area > 0 ? populacao / item.area : null;
    item.periodos.densidade = item.periodos.populacao;
    item.porte = Number.isFinite(populacao) ? faixaDePorte(populacao) : null;
  }
  return tabela;
}

function obterTabelaComparacao(estadoSigla, repositorio) {
  return cacheComparacaoEstado.obter(
    estadoSigla,
    () => carregarTabelaComparacao(estadoSigla, repositorio),
    () => CACHE_TTL_MS,
  );
}

// Posição de 0 a 100 entre os pares. Nos indicadores com melhor e pior, é a parte
// dos pares que está pior que o município (100 = melhor do grupo); nos de
// contexto, a parte com valor menor. Empates contam pela metade.
function posicaoNoGrupo(municipioCodIbge, tabela) {
  const alvo = tabela.get(municipioCodIbge);
  const populacao = alvo?.valores.populacao ?? null;
  if (!alvo || alvo.porte === null) {
    return { faixa: null, nome_faixa: null, populacao, n_grupo: 0, sem_grupo: false, itens: [] };
  }
  const resumo = {
    faixa: alvo.porte,
    nome_faixa: NOMES_PORTE[alvo.porte],
    populacao,
    periodo_populacao: alvo.periodos.populacao || null,
    sem_grupo: MUNICIPIOS_SEM_GRUPO.has(municipioCodIbge),
  };
  const pares = [...tabela.values()].filter(
    (item) => item.porte === alvo.porte && item.municipio_cod_ibge !== municipioCodIbge,
  );
  if (resumo.sem_grupo) return { ...resumo, n_grupo: 0, itens: [] };

  const itens = [];
  for (const indicador of INDICADORES_COMPARACAO) {
    const valor = alvo.valores[indicador.id];
    if (!Number.isFinite(valor)) continue;
    const valoresPares = pares.map((par) => par.valores[indicador.id]).filter(Number.isFinite);
    if (valoresPares.length < MIN_PARES) continue;

    const pior = valoresPares.filter((par) =>
      indicador.maiorMelhor === false ? par > valor : par < valor,
    ).length;
    const iguais = valoresPares.filter((par) => par === valor).length;
    itens.push({
      id: indicador.id,
      tema: indicador.tema,
      rotulo: indicador.rotulo,
      unidade: indicador.unidade,
      maior_melhor: indicador.maiorMelhor,
      valor,
      mediana: mediana(valoresPares),
      posicao: (100 * (pior + iguais / 2)) / valoresPares.length,
      n_pares: valoresPares.length,
      periodo: alvo.periodos[indicador.id] || null,
    });
  }
  return { ...resumo, n_grupo: pares.length, itens };
}

function distanciaKm(origem, destino) {
  const radianos = (graus) => (graus * Math.PI) / 180;
  const dLat = radianos(destino.latitude - origem.latitude);
  const dLon = radianos(destino.longitude - origem.longitude);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(radianos(origem.latitude)) * Math.cos(radianos(destino.latitude)) * Math.sin(dLon / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(a));
}

// O mosquito não respeita divisa: o que acontece ao lado importa mesmo quando o
// vizinho tem outro porte.
function vizinhosMaisProximos(municipioCodIbge, tabela, quantidade = NUMERO_VIZINHOS) {
  const alvo = tabela.get(municipioCodIbge);
  if (!alvo || !Number.isFinite(alvo.latitude) || !Number.isFinite(alvo.longitude)) return [];
  return [...tabela.values()]
    .filter(
      (item) =>
        item.municipio_cod_ibge !== municipioCodIbge &&
        Number.isFinite(item.latitude) &&
        Number.isFinite(item.longitude),
    )
    .map((item) => ({ item, distancia_km: distanciaKm(alvo, item) }))
    .sort((a, b) => a.distancia_km - b.distancia_km)
    .slice(0, quantidade);
}

async function carregarComparacao(municipio, previsao, serie, repositorio) {
  const codigo = Number(municipio.municipio_cod_ibge);
  const tabela = await obterTabelaComparacao(municipio.estado_sigla, repositorio);
  const porte = posicaoNoGrupo(codigo, tabela);
  const proximos = vizinhosMaisProximos(codigo, tabela);
  const codigos = [codigo, ...proximos.map(({ item }) => item.municipio_cod_ibge)];

  // Incidência de casos confirmados nos últimos meses da série, por 100 mil hab.
  let periodoIncidencia = null;
  const incidencias = new Map();
  if (serie.ate) {
    const fim = indiceMes(serie.ate.ano, serie.ate.mes);
    const inicio = fim - MESES_INCIDENCIA_VIZINHOS + 1;
    periodoIncidencia = { de: mesDoIndice(inicio), ate: serie.ate };
    const linhas = await repositorio.listarSerieMensal(
      codigos,
      Object.values(SIGLAS_CASOS_CONFIRMADOS),
      mesDoIndice(inicio).ano,
    );
    for (const linha of linhas) {
      const indice = indiceMes(linha.ano, linha.mes);
      if (indice < inicio || indice > fim) continue;
      const chave = `${Number(linha.municipio_cod_ibge)}:${linha.variavel_sigla}`;
      incidencias.set(chave, (incidencias.get(chave) || 0) + (paraNumero(linha.valor) ?? 0));
    }
  }

  // Faixa de cada vizinho no mesmo horizonte da previsão principal do município.
  const previsoesVizinhos = previsao.disponivel ? await repositorio.listarPrevisoesAtuais(codigos) : [];
  const faixaDe = (codigoMunicipio, doenca) => {
    const horizonte = previsao.doencas[doenca]?.principal_horizonte;
    if (!horizonte) return null;
    const linha = previsoesVizinhos.find(
      (item) =>
        Number(item.municipio_cod_ibge) === codigoMunicipio &&
        item.doenca === doenca &&
        Number(item.horizonte) === horizonte,
    );
    return linha ? linha.faixa_risco : null;
  };

  const resumoMunicipio = (item, distancia) => {
    const populacao = item.valores.populacao ?? null;
    const incidencia = {};
    const faixas = {};
    for (const [doenca, sigla] of Object.entries(SIGLAS_CASOS_CONFIRMADOS)) {
      const casos = incidencias.get(`${item.municipio_cod_ibge}:${sigla}`);
      incidencia[doenca] =
        periodoIncidencia && populacao > 0 ? ((casos || 0) / populacao) * 100_000 : null;
      if (DOENCAS_PREVISAO.includes(doenca)) faixas[doenca] = faixaDe(item.municipio_cod_ibge, doenca);
    }
    return {
      municipio_cod_ibge: item.municipio_cod_ibge,
      municipio_nome: item.municipio_nome,
      estado_sigla: item.estado_sigla,
      distancia_km: distancia,
      populacao,
      faixas,
      incidencia,
    };
  };

  const alvo = tabela.get(codigo);
  return {
    disponivel: true,
    motivo: null,
    porte,
    municipio: alvo ? resumoMunicipio(alvo, 0) : null,
    vizinhos: proximos.map(({ item, distancia_km: distancia }) => resumoMunicipio(item, distancia)),
    periodo_incidencia: periodoIncidencia,
  };
}

async function carregarPainel(municipioCodIbge, repositorio) {
  const municipio = await repositorio.buscarMunicipio(municipioCodIbge);
  if (!municipio) return null;

  const [previsao, serie] = await Promise.all([
    obterPrevisaoArboviroses(municipioCodIbge, { repositorio }),
    comModuloOpcional(() => carregarSerie(municipioCodIbge, repositorio), { doencas: {}, ate: null }),
  ]);

  // Sem previsão e sem série, o município está fora da cobertura do modelo (hoje,
  // os 645 municípios de São Paulo) e não há o que comparar.
  const comparacao =
    previsao.disponivel || serie.disponivel
      ? await comModuloOpcional(
        () => carregarComparacao(municipio, previsao, serie, repositorio),
        { porte: null, municipio: null, vizinhos: [], periodo_incidencia: null },
      )
      : {
        disponivel: false,
        motivo: previsao.motivo === "modulo_indisponivel" ? "modulo_indisponivel" : "sem_dados",
        porte: null,
        municipio: null,
        vizinhos: [],
        periodo_incidencia: null,
      };

  return {
    municipio: {
      municipio_cod_ibge: Number(municipio.municipio_cod_ibge),
      municipio_nome: municipio.municipio_nome,
      estado_sigla: municipio.estado_sigla,
    },
    previsao,
    serie,
    comparacao,
  };
}

function obterPainelArboviroses(municipioCodIbge, { repositorio = repositorioPadrao } = {}) {
  return cachePainel.obter(
    municipioCodIbge,
    () => carregarPainel(municipioCodIbge, repositorio),
    ttlPorDisponibilidade,
  );
}

module.exports = {
  DOENCAS_PREVISAO,
  INDICADORES_COMPARACAO,
  NOMES_PORTE,
  SIGLAS_CASOS_CONFIRMADOS,
  carregarTabelaComparacao,
  gruposQueAumentaramRisco,
  lerFlag,
  limparCacheArboviroses,
  montarPrevisaoDoenca,
  montarSerieCasos,
  obterPainelArboviroses,
  obterPrevisaoArboviroses,
  posicaoNoGrupo,
  vizinhosMaisProximos,
};
