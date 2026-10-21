// Textos e formatação da aba de arboviroses. Os dados vêm de
// GET /api/municipios/:codigo/arboviroses.

export const ARBOVIRUS_DISEASES = [
  { value: "dengue", label: "Dengue" },
  { value: "chikungunya", label: "Chikungunya" },
  { value: "zika", label: "Zika" },
  { value: "febre_amarela", label: "Febre amarela" },
];

export const DISEASES_WITH_FORECAST = new Set(["dengue", "zika", "chikungunya"]);

const MONTH_NAMES = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];
export const MONTH_SHORT_LABELS = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

export const RISK_LEVELS = {
  critico: { label: "Crítico", className: "bg-[#7a1712] text-white" },
  alto: { label: "Alto", className: "bg-[#e34d4d] text-white" },
  moderado: { label: "Moderado", className: "bg-[#f5c451] text-[#3d2a00]" },
  baixo: { label: "Baixo", className: "bg-[#dff3e8] text-[#1d5e3d]" },
};

export const diseaseLabel = (disease) =>
  ARBOVIRUS_DISEASES.find(({ value }) => value === disease)?.label || disease;

const lowerDiseaseLabel = (disease) => diseaseLabel(disease).toLocaleLowerCase("pt-BR");

export const formatMonthYear = (year, month) => `${MONTH_NAMES[month - 1]} de ${year}`;

// "em outubro de 2026", "entre outubro e dezembro de 2026" ou
// "entre novembro de 2026 e janeiro de 2027".
export function describeMonthRange(months) {
  if (!months?.length) return "";
  const first = months[0];
  const last = months[months.length - 1];
  if (months.length === 1) return `em ${formatMonthYear(first.ano_alvo, first.mes_alvo)}`;
  if (first.ano_alvo === last.ano_alvo) {
    return `entre ${MONTH_NAMES[first.mes_alvo - 1]} e ${formatMonthYear(last.ano_alvo, last.mes_alvo)}`;
  }
  return `entre ${formatMonthYear(first.ano_alvo, first.mes_alvo)} e ${formatMonthYear(last.ano_alvo, last.mes_alvo)}`;
}

export function unavailableForecastMessage(reason) {
  if (reason === "modulo_indisponivel") {
    return "O módulo de previsão de arboviroses ainda não está disponível neste servidor.";
  }
  return "A previsão de surtos cobre, por enquanto, os municípios do estado de São Paulo.";
}

// Título, tom e detalhe do banner de previsão de uma doença.
export function forecastHeadline(forecast, disease) {
  const name = lowerDiseaseLabel(disease);
  if (!DISEASES_WITH_FORECAST.has(disease)) {
    return {
      tone: "neutral",
      title: `${diseaseLabel(disease)} não tem previsão de surto`,
      detail: "Há poucos surtos no estado para treinar um modelo; o gráfico mostra os casos confirmados.",
    };
  }
  if (!forecast) {
    return { tone: "neutral", title: "Previsão indisponível", detail: null };
  }

  const principal = forecast.meses.find((month) => month.horizonte === forecast.principal_horizonte);
  if (forecast.situacao === "inicio") {
    return {
      tone: "alert",
      title: `Início de surto de ${name} previsto para ${formatMonthYear(principal.ano_alvo, principal.mes_alvo)}`,
      detail: null,
    };
  }
  if (forecast.situacao === "continuacao") {
    return {
      tone: "alert",
      title: `Surto de ${name} em andamento, com continuação prevista ${describeMonthRange([principal])}`,
      detail: "O município já estava em surto no último mês com dados consolidados.",
    };
  }
  if (forecast.situacao === "sem_meses_futuros") {
    return {
      tone: "neutral",
      title: `Ainda não há previsão de ${name} para os próximos meses`,
      detail: "Os meses cobertos pela última previsão já passaram; a próxima carga mensal traz os seguintes.",
    };
  }
  return {
    tone: "calm",
    title: `Não há previsão de surto de ${name} ${describeMonthRange(forecast.meses)}`,
    detail: forecast.em_surto_mes_referencia
      ? "O município estava em surto no último mês com dados consolidados."
      : null,
  };
}

export function confidenceMessage(confidence) {
  if (!confidence || !Number.isFinite(confidence.valor)) return null;
  const outOfTen = Math.max(0, Math.min(10, Math.round(confidence.valor * 10)));
  if (confidence.medida === "precisao") {
    return `De cada 10 alertas como este, cerca de ${outOfTen} confirmaram surto nos anos de teste do modelo.`;
  }
  return `O modelo antecipa cerca de ${outOfTen} em cada 10 surtos: ausência de alerta não é garantia.`;
}

export const referenceMessage = (reference) =>
  reference
    ? `Previsão feita com dados consolidados até ${formatMonthYear(reference.ano, reference.mes)} ` +
      "(os casos levam cerca de 60 dias para consolidar)."
    : null;

function formatNumber(value, maximumFractionDigits) {
  return value.toLocaleString("pt-BR", { maximumFractionDigits });
}

const SINGULAR_UNITS = { casos: "caso", "internações": "internação", dias: "dia" };

// Valor de um fator SHAP com a unidade do catálogo do modelo.
export function formatFactorValue(value, unit) {
  if (!Number.isFinite(value)) return "sem dado";
  const normalizedUnit = String(unit || "").trim();
  if (normalizedUnit === "1 = sim, 0 = não") return value >= 0.5 ? "sim" : "não";
  const digits = Math.abs(value) >= 100 ? 0 : Math.abs(value) >= 10 ? 1 : 2;
  const number = formatNumber(value, digits);
  if (!normalizedUnit || normalizedUnit.startsWith("índice")) return number;
  if (normalizedUnit === "%") return `${number}%`;
  if (value === 1 && SINGULAR_UNITS[normalizedUnit]) return `1 ${SINGULAR_UNITS[normalizedUnit]}`;
  return `${number} ${normalizedUnit}`;
}

// Doze pontos do ano para o gráfico: null nos meses que a série ainda não cobre.
export function seriesForYear(series, year) {
  const byMonth = new Map((series || []).filter((point) => point.ano === year).map((point) => [point.mes, point.casos]));
  return MONTH_SHORT_LABELS.map((month, index) => ({
    month,
    casos: byMonth.has(index + 1) ? byMonth.get(index + 1) : null,
  }));
}

export function seriesYears(series) {
  return [...new Set((series || []).map((point) => point.ano))].sort((a, b) => a - b);
}

export function formatComparisonValue(value, unit) {
  if (!Number.isFinite(value)) return "sem dado";
  const digits = Math.abs(value) >= 100 ? 0 : Math.abs(value) >= 10 ? 1 : 2;
  const number = formatNumber(value, digits);
  if (!unit) return number;
  return unit === "%" ? `${number}%` : `${number} ${unit}`;
}
