// O Sonar Municipal roda no mesmo servidor do inteli.gente e não fica exposto à
// internet: toda consulta parte deste backend, nunca do navegador.
const DEFAULT_SONAR_API_URL = "http://127.0.0.1:3000";
const SEARCH_PATH = "/api/search";
const REQUEST_TIMEOUT_MS = 12_000;
const RETRY_DELAY_MS = 300;
const RESULTS_PER_QUERY = 8;
const PROJECTS_PER_THEME = 2;
const MAX_THEMES = 4;
const MAX_CONDITIONAL_THEMES = 3;
const SEARCH_CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const DUPLICATE_SIMILARITY = 0.6;
const COVERAGE_THRESHOLD = 90;
const FLOOD_RISK_THRESHOLD = 5;

const PROFILE_INDICATORS = [
  { id: "populacao", referencia: 4003, rotulo: "População", unidade: "habitantes" },
  { id: "agua", referencia: 3117, rotulo: "Rede de água", unidade: "% da população" },
  { id: "esgoto", referencia: 3127, rotulo: "Coleta de esgoto", unidade: "% da população" },
  { id: "coletaLixo", referencia: 3122, rotulo: "Coleta de lixo", unidade: "% da população" },
  {
    id: "riscoInundacao",
    referencia: 4070,
    rotulo: "Domicílios em risco de inundação",
    unidade: "% dos domicílios urbanos",
  },
];
const PROFILE_INDICATOR_REFERENCES = PROFILE_INDICATORS.map(({ referencia }) => referencia);

const percentFormatter = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 });
const integerFormatter = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 });
const formatPercent = (value) => `${percentFormatter.format(value)}%`;
const formatPopulation = (value) => integerFormatter.format(value);
const withYear = (text, ...years) => {
  const year = Math.max(0, ...years.filter(Number.isFinite));
  return year > 0 ? `${text} (${year}).` : `${text}.`;
};

// Cada tema vira uma busca semântica no Sonar. Os condicionais só entram quando
// os indicadores do município apontam o problema; os universais completam a
// lista. Os termos (sem acento) descartam PLs que a busca trouxe por
// proximidade genérica com "dengue", mas que não tratam do tema.
const ARBOVIRUS_THEMES = [
  {
    id: "saneamento",
    titulo: "Saneamento básico",
    query: "Ampliar saneamento básico e coleta de esgoto para eliminar criadouros do mosquito da dengue",
    termos: ["esgot", "saneament", "abastecimento de agua", "rede de agua", "distribuicao de agua"],
    motivo: ({ agua, esgoto }) => {
      const aguaBaixa = agua && agua.valor < COVERAGE_THRESHOLD;
      const esgotoBaixo = esgoto && esgoto.valor < COVERAGE_THRESHOLD;
      if (aguaBaixa && esgotoBaixo) {
        return withYear(
          `A rede de água atende ${formatPercent(agua.valor)} da população e a coleta de esgoto, ${formatPercent(esgoto.valor)}`,
          agua.ano,
          esgoto.ano,
        );
      }
      if (aguaBaixa) return withYear(`A rede de água atende ${formatPercent(agua.valor)} da população`, agua.ano);
      if (esgotoBaixo) {
        return withYear(`A coleta de esgoto atende ${formatPercent(esgoto.valor)} da população`, esgoto.ano);
      }
      return null;
    },
  },
  {
    id: "residuos",
    titulo: "Coleta de entulho e materiais inservíveis",
    query: "Criar serviço público de coleta de entulho, pneus e materiais inservíveis no município",
    termos: ["entulho", "lixo", "residuo", "inservive", "coleta"],
    motivo: ({ coletaLixo }) =>
      coletaLixo && coletaLixo.valor < COVERAGE_THRESHOLD
        ? withYear(`A coleta de lixo domiciliar atende ${formatPercent(coletaLixo.valor)} da população`, coletaLixo.ano)
        : null,
  },
  {
    id: "drenagem",
    titulo: "Drenagem e bocas de lobo",
    query:
      "Limpar bocas de lobo, galerias pluviais e sistemas de drenagem para evitar água parada e focos do mosquito",
    termos: ["boca de lobo", "bocas de lobo", "bueiro", "galeria", "pluvia", "drenagem", "alagament", "enchente"],
    motivo: ({ riscoInundacao }) =>
      riscoInundacao && riscoInundacao.valor >= FLOOD_RISK_THRESHOLD
        ? withYear(
          `${formatPercent(riscoInundacao.valor)} dos domicílios urbanos estão em área de risco de inundação`,
          riscoInundacao.ano,
        )
        : null,
  },
  {
    id: "imoveis_fechados",
    titulo: "Acesso a imóveis fechados",
    query:
      "Permitir que agentes de endemias entrem em imóveis fechados ou abandonados para eliminar focos do Aedes aegypti",
    termos: ["endemia", "fechad", "ingress", "entrada"],
    motivo: ({ populacao }) =>
      populacao && populacao.valor >= 50_000
        ? `Com ${formatPopulation(populacao.valor)} habitantes, imóveis fechados ou abandonados dificultam as visitas dos agentes de endemias.`
        : null,
  },
  {
    id: "pontos_estrategicos",
    titulo: "Borracharias, ferros-velhos e pneus",
    query:
      "Exigir controle de criadouros do Aedes aegypti em borracharias, ferros-velhos, depósitos de pneus e obras",
    termos: ["borrachari", "pneu", "ferro velho", "ferros velhos", "sucata", "recauchut"],
    motivo: ({ populacao }) =>
      populacao && populacao.valor >= 100_000
        ? "Com mais de 100 mil habitantes, o município tende a concentrar borracharias, ferros-velhos e depósitos de pneus, pontos estratégicos no controle do Aedes."
        : null,
  },
  {
    id: "terrenos",
    titulo: "Terrenos baldios e imóveis abandonados",
    query: "Fiscalizar terrenos baldios e imóveis abandonados para eliminar focos do mosquito Aedes aegypti",
    termos: ["terreno", "lote", "baldio", "abandonad"],
    motivo: () =>
      "Terrenos baldios e imóveis abandonados estão entre os criadouros mais comuns em municípios de qualquer porte.",
    universal: true,
  },
  {
    id: "educacao",
    titulo: "Educação e mobilização",
    query: "Realizar campanhas educativas nas escolas sobre prevenção da dengue e eliminação de criadouros",
    termos: ["escola", "educa", "campanha", "conscientiza", "orientacao", "ensino"],
    motivo: () => "Ações educativas contínuas têm baixo custo e se aplicam a municípios de qualquer porte.",
    universal: true,
  },
  // Temas que só entram pela previsão de surto, quando o grupo correspondente
  // aumentou o risco previsto (ver TEMAS_POR_GRUPO).
  {
    id: "vigilancia",
    titulo: "Vigilância epidemiológica",
    query: "Intensificar vigilância epidemiológica e notificação de casos de dengue no município",
    termos: ["vigilancia", "notifica", "alerta", "divulga", "comite", "boletim", "monitora"],
    motivo: () => null,
    apenasPrevisao: true,
  },
  {
    id: "agentes_endemias",
    titulo: "Agentes de saúde e de combate às endemias",
    query: "Contratar e capacitar agentes de combate às endemias para o controle do Aedes aegypti",
    termos: ["agente", "endemia"],
    motivo: () => null,
    apenasPrevisao: true,
  },
  {
    id: "alagamento",
    titulo: "Alagamentos e áreas de risco",
    query:
      "Mapear áreas de risco de alagamento e enchente e evitar água parada que forma criadouros do mosquito",
    termos: ["alagament", "enchente", "inunda", "area de risco", "areas de risco"],
    motivo: () => null,
    apenasPrevisao: true,
  },
];

// Grupos de fatores da previsão que uma política municipal alcança, com os temas
// que respondem a cada um, do mais direto para o mais amplo.
const TEMAS_POR_GRUPO = {
  servicos_de_saude: ["vigilancia", "agentes_endemias", "imoveis_fechados"],
  ambiente: ["drenagem", "alagamento"],
  saneamento: ["saneamento"],
};
// Mais candidatos que vagas, porque um tema pode não ter PL que cite os seus termos.
const MAX_CANDIDATE_THEMES = 6;
const NOMES_MESES = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];
const NOMES_DOENCAS = { dengue: "dengue", zika: "zika", chikungunya: "chikungunya" };

const searchCache = new Map();

function getSonarSearchUrl() {
  const baseUrl = String(process.env.SONAR_API_URL || DEFAULT_SONAR_API_URL).trim().replace(/\/+$/, "");
  let parsed;
  try {
    parsed = new URL(`${baseUrl}${SEARCH_PATH}`);
  } catch {
    throw new Error(`SONAR_API_URL inválida: ${baseUrl}`);
  }
  if (!["http:", "https:"].includes(parsed.protocol)) {
    throw new Error(`SONAR_API_URL deve usar HTTP ou HTTPS: ${baseUrl}`);
  }
  return parsed.toString();
}

function normalizeText(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

// O tipo chega como "PLO Projeto de Lei Ordinária", "PL-E Projeto de Lei - Executivo"
// ou "PROJETO DE LEI": remove a sigla de cada casa legislativa e o texto em caixa alta.
function cleanProjectType(value) {
  if (typeof value !== "string") return null;
  let type = value.trim().replace(/\s+/g, " ");
  const projectIndex = type.search(/projeto/i);
  if (projectIndex > 0) type = type.slice(projectIndex);
  if (type && type === type.toLocaleUpperCase("pt-BR")) {
    type = type
      .toLocaleLowerCase("pt-BR")
      .replace(/(^|\s)(\p{L}{3,})/gu, (_, space, word) => `${space}${word[0].toLocaleUpperCase("pt-BR")}${word.slice(1)}`);
  }
  return type || null;
}

function normalizeProject(project) {
  const link = [project?.link_publico, project?.sapl_url].find(
    (url) => typeof url === "string" && /^https?:\/\//i.test(url)
  );
  const presentedAt =
    typeof project?.data_apresentacao === "string" ? project.data_apresentacao : null;

  return {
    id: project?.index ?? null,
    score: Number.isFinite(Number(project?.score)) ? Number(project.score) : null,
    acao: typeof project?.acao === "string" ? project.acao.trim() : null,
    ementa: typeof project?.ementa === "string" ? project.ementa.trim() : null,
    municipio: typeof project?.municipio === "string" ? project.municipio : null,
    uf: typeof project?.uf === "string" ? project.uf : null,
    data_apresentacao: presentedAt,
    ano: /^\d{4}/.test(presentedAt || "") ? Number(presentedAt.slice(0, 4)) : null,
    tipo: cleanProjectType(project?.tipo_label),
    link: link || null,
  };
}

function montarPerfilArboviroses(indicadorRows = []) {
  const byReference = new Map(
    indicadorRows.map((row) => [Number(row.indicador_referencia), row])
  );
  const perfil = {};

  for (const indicator of PROFILE_INDICATORS) {
    const row = byReference.get(indicator.referencia);
    const valor = row == null || row.indicador_valor == null ? NaN : Number(row.indicador_valor);
    perfil[indicator.id] = Number.isFinite(valor)
      ? { valor, ano: Number(row.ano) || null }
      : null;
  }

  return perfil;
}

function motivoPorGrupo(grupo, ordem, previsao, temaAdicional) {
  const quando = `de ${NOMES_DOENCAS[previsao.doenca] || previsao.doenca} para ` +
    `${NOMES_MESES[previsao.mes_alvo - 1]} de ${previsao.ano_alvo}`;
  if (temaAdicional) {
    const nome = grupo.grupo_nome.charAt(0).toLocaleLowerCase("pt-BR") + grupo.grupo_nome.slice(1);
    return `Outra frente ligada a ${nome}, ${ordem === 0 ? "o grupo que mais aumentou" : "que também aumentou"} ` +
      `o risco previsto ${quando}.`;
  }
  return ordem === 0
    ? `${grupo.grupo_nome} é o grupo de fatores acionáveis que mais aumentou o risco previsto ${quando}.`
    : `${grupo.grupo_nome} também aumentou o risco previsto ${quando}.`;
}

// Com previsão de surto, os temas saem dos grupos acionáveis que mais aumentaram o
// risco previsto: primeiro um tema de cada grupo, na ordem da contribuição, depois
// os demais temas dos grupos que mais pesaram. Os temas do perfil do município
// (água, esgoto, lixo, inundação e porte) completam a lista e são a alternativa
// quando não há previsão; os universais vêm por último.
function selecionarTemasArboviroses(perfil, previsao = null) {
  const porId = new Map(ARBOVIRUS_THEMES.map((theme) => [theme.id, theme]));
  const escolhidos = [];
  const adicionar = (theme, motivo, origem) => {
    if (!theme || !motivo || escolhidos.some((escolhido) => escolhido.id === theme.id)) return;
    escolhidos.push({ ...theme, motivo, origem });
  };

  const grupos = previsao?.grupos || [];
  grupos.forEach((grupo, ordem) => {
    const [primeiro] = TEMAS_POR_GRUPO[grupo.grupo_sigla] || [];
    adicionar(porId.get(primeiro), motivoPorGrupo(grupo, ordem, previsao, false), "previsao");
  });
  grupos.forEach((grupo, ordem) => {
    for (const id of (TEMAS_POR_GRUPO[grupo.grupo_sigla] || []).slice(1)) {
      adicionar(porId.get(id), motivoPorGrupo(grupo, ordem, previsao, true), "previsao");
    }
  });

  const withReason = ARBOVIRUS_THEMES
    .filter((theme) => !theme.apenasPrevisao)
    .map((theme) => ({ theme, motivo: theme.motivo(perfil) }))
    .filter(({ motivo }) => motivo);
  withReason
    .filter(({ theme }) => !theme.universal)
    .slice(0, MAX_CONDITIONAL_THEMES)
    .forEach(({ theme, motivo }) => adicionar(theme, motivo, "perfil"));
  withReason
    .filter(({ theme }) => theme.universal)
    .forEach(({ theme, motivo }) => adicionar(theme, motivo, "perfil"));

  return escolhidos.slice(0, MAX_CANDIDATE_THEMES);
}

function mentionsThemeTerms(project, terms) {
  const text = normalizeText(`${project.acao || ""} ${project.ementa || ""}`);
  return terms.some((term) => text.includes(term));
}

function tokenSet(project) {
  return new Set(
    normalizeText(project.acao || project.ementa)
      .split(" ")
      .filter((token) => token.length > 2)
  );
}

// Muitos PLs são cópias quase literais de leis de outras cidades; mostrar duas
// versões do mesmo texto não acrescenta nada ao gestor.
function isDuplicateProject(project, selected) {
  const tokens = tokenSet(project);

  return selected.some((other) => {
    if (project.id != null && project.id === other.id) return true;
    const otherTokens = tokenSet(other);
    const union = new Set([...tokens, ...otherTokens]).size;
    if (union === 0) return false;
    const intersection = [...tokens].filter((token) => otherTokens.has(token)).length;
    return intersection / union >= DUPLICATE_SIMILARITY;
  });
}

async function requestSonarSearch(query) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    let response;
    try {
      response = await fetch(getSonarSearchUrl(), {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ query, top_k: RESULTS_PER_QUERY }),
        signal: controller.signal,
      });
    } catch (error) {
      // Falha de rede vale nova tentativa; o timeout não, para não dobrar a espera.
      error.retryable = error.name !== "AbortError";
      throw error;
    }

    if (!response.ok) {
      const detail = await response
        .json()
        .then((body) => body?.detail)
        .catch(() => null);
      const error = new Error(
        `Sonar Municipal respondeu com status ${response.status}${detail ? `: ${detail}` : ""}`
      );
      error.retryable = response.status >= 500;
      throw error;
    }

    const payload = await response.json();
    return Array.isArray(payload?.results) ? payload.results : [];
  } finally {
    clearTimeout(timeout);
  }
}

// O Sonar devolve 500 esporádico quando a conexão dele com o Qdrant é reaproveitada
// depois de fechada ("other side closed"); a segunda tentativa abre outra conexão.
async function pesquisarSonar(query, { retries = 1, retryDelayMs = RETRY_DELAY_MS } = {}) {
  for (let attempt = 0; ; attempt += 1) {
    try {
      return await requestSonarSearch(query);
    } catch (error) {
      if (attempt >= retries || !error.retryable) throw error;
      await new Promise((resolve) => setTimeout(resolve, retryDelayMs));
    }
  }
}

// As buscas são frases fixas compartilhadas por todos os municípios, então o
// cache por frase evita repetir a consulta ao Sonar a cada visita.
function pesquisarSonarComCache(query) {
  const cached = searchCache.get(query);
  if (cached && cached.expiresAt > Date.now()) return cached.promise;

  const promise = pesquisarSonar(query).catch((error) => {
    searchCache.delete(query);
    throw error;
  });
  searchCache.set(query, { expiresAt: Date.now() + SEARCH_CACHE_TTL_MS, promise });
  return promise;
}

function limparCacheSonar() {
  searchCache.clear();
}

// `previsao`, quando houver: { doenca, ano_alvo, mes_alvo, grupos }, com os grupos
// acionáveis que aumentaram o risco na previsão principal, do maior para o menor.
async function buscarProjetosArboviroses({
  indicadores = [],
  previsao = null,
  search = pesquisarSonarComCache,
} = {}) {
  const perfil = montarPerfilArboviroses(indicadores);
  const temas = selecionarTemasArboviroses(perfil, previsao);
  const settled = await Promise.allSettled(temas.map((tema) => search(tema.query)));

  const failures = settled.filter((result) => result.status === "rejected");
  if (failures.length === settled.length) throw failures[0].reason;
  for (const failure of failures) {
    console.warn("Busca parcial no Sonar Municipal falhou:", failure.reason?.message);
  }

  const selected = [];
  const temasComProjetos = [];

  temas.forEach((tema, index) => {
    const result = settled[index];
    if (temasComProjetos.length >= MAX_THEMES || result.status !== "fulfilled") return;

    const candidates = result.value
      .map(normalizeProject)
      .filter((projeto) => (projeto.acao || projeto.ementa) && mentionsThemeTerms(projeto, tema.termos));
    const projetos = [];
    const sameOrigin = (a, b) => a.municipio === b.municipio && a.uf === b.uf;

    // Primeiro um PL por município de origem; só repete a cidade se faltar opção.
    for (const allowRepeatedOrigin of [false, true]) {
      for (const projeto of candidates) {
        if (projetos.length >= PROJECTS_PER_THEME) break;
        if (projetos.includes(projeto) || isDuplicateProject(projeto, selected)) continue;
        if (!allowRepeatedOrigin && projetos.some((chosen) => sameOrigin(chosen, projeto))) continue;

        projetos.push(projeto);
        selected.push(projeto);
      }
    }

    if (projetos.length > 0) {
      temasComProjetos.push({
        id: tema.id,
        titulo: tema.titulo,
        motivo: tema.motivo,
        origem: tema.origem,
        projetos,
      });
    }
  });

  const orientadaPelaPrevisao = temasComProjetos.some((tema) => tema.origem === "previsao");
  return {
    fonte_temas: orientadaPelaPrevisao ? "previsao" : "perfil",
    previsao: orientadaPelaPrevisao
      ? {
        doenca: previsao.doenca,
        ano_alvo: previsao.ano_alvo,
        mes_alvo: previsao.mes_alvo,
        grupos: previsao.grupos.map(({ grupo_sigla: sigla, grupo_nome: nome }) => ({
          grupo_sigla: sigla,
          grupo_nome: nome,
        })),
      }
      : null,
    perfil: PROFILE_INDICATORS.filter(({ id }) => perfil[id]).map(({ id, rotulo, unidade }) => ({
      id,
      rotulo,
      unidade,
      valor: perfil[id].valor,
      ano: perfil[id].ano,
    })),
    temas: temasComProjetos,
  };
}

module.exports = {
  PROFILE_INDICATOR_REFERENCES,
  buscarProjetosArboviroses,
  getSonarSearchUrl,
  isDuplicateProject,
  limparCacheSonar,
  montarPerfilArboviroses,
  normalizeProject,
  pesquisarSonar,
  selecionarTemasArboviroses,
};
