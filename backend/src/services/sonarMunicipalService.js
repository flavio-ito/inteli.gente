const DEFAULT_API_URL = "https://sonar-municipal.vercel.app/api/search";
const SEARCH_QUERY =
  "Projetos de lei e políticas públicas municipais para prevenção e controle de dengue, zika, chikungunya e outras arboviroses urbanas";

function getApiUrl() {
  return String(process.env.SONAR_MUNICIPAL_API_URL || DEFAULT_API_URL).trim();
}

function normalizeProject(project) {
  const publicUrl = project?.link_publico || project?.sapl_url || null;

  return {
    id: project?.index ?? null,
    score: Number.isFinite(Number(project?.score)) ? Number(project.score) : null,
    acao: typeof project?.acao === "string" ? project.acao : null,
    ementa: typeof project?.ementa === "string" ? project.ementa : null,
    municipio: typeof project?.municipio === "string" ? project.municipio : null,
    uf: typeof project?.uf === "string" ? project.uf : null,
    data_apresentacao:
      typeof project?.data_apresentacao === "string" ? project.data_apresentacao : null,
    tipo: typeof project?.tipo_label === "string" ? project.tipo_label : null,
    link: typeof publicUrl === "string" && /^https?:\/\//i.test(publicUrl) ? publicUrl : null,
  };
}

async function buscarProjetosArboviroses({ municipioNome, estadoSigla, limit = 3 }) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12_000);

  try {
    const response = await fetch(getApiUrl(), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query: `${SEARCH_QUERY}. Recomendações aplicáveis a ${municipioNome}, ${estadoSigla}.`,
        top_k: Math.max(1, Math.min(Number(limit) || 3, 6)),
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`Sonar Municipal respondeu com status ${response.status}`);
    }

    const payload = await response.json();
    return (Array.isArray(payload?.results) ? payload.results : [])
      .map(normalizeProject)
      .filter((project) => project.acao || project.ementa);
  } finally {
    clearTimeout(timeout);
  }
}

module.exports = { buscarProjetosArboviroses, normalizeProject };
