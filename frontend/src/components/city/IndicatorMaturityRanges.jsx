import catalog from "@/data/maturityRanges.json";
import { useI18n } from "@/lib/i18n";

const labels = ["F", "E", "1", "2", "3", "4", "5"];
const number = (value) => value.toLocaleString("pt-BR", { maximumFractionDigits: 12 });

export const hasMaturityRule = (id) => Boolean(catalog.indicators[String(id)]);

export const formatMaturityRange = ({ lower, upper, lowerInclusive, upperInclusive }) => {
  if (lower === upper) return `= ${number(lower)}`;
  if (lower == null) return `${upperInclusive ? "≤" : "<"} ${number(upper)}`;
  if (upper == null) return `${lowerInclusive ? "≥" : ">"} ${number(lower)}`;
  return `${number(lower)} ${lowerInclusive ? "≤" : "<"} valor ${upperInclusive ? "≤" : "<"} ${number(upper)}`;
};

export default function IndicatorMaturityRanges({ indicatorId, level }) {
  const { t } = useI18n();
  const rule = catalog.indicators[String(indicatorId)];
  if (!rule) return null;

  return (
    <span className="mt-3 block border-t border-[#d7e4f5] pt-2">
      <span className="mb-1 block font-semibold text-[#1f2d3d]">{t("Faixas de maturidade")}</span>
      {rule.ranges.length === 0 ? (
        <span className="block">{t("Este indicador ainda não possui faixas de maturidade definidas.")}</span>
      ) : (
        <>
          <span role="table" aria-label={t("Faixas de maturidade")} className="block">
            <span role="row" className="grid grid-cols-[5rem_1fr] gap-2 font-semibold">
              <span role="columnheader">{t("Nível")}</span>
              <span role="columnheader">{t("Valor")}</span>
            </span>
            {rule.ranges.map((range, index) => (
              <span
                role="row"
                key={index}
                className={`grid grid-cols-[5rem_1fr] gap-2 rounded px-1 py-0.5 ${range.levels.includes(Number(level)) ? "bg-[#edf5ff] font-semibold text-[#1f2d3d]" : ""}`}
              >
                <span role="cell">{range.levels.map((value) => labels[value - 1]).join(" / ")}{range.levels.length > 1 ? " *" : ""}</span>
                <span role="cell">{formatMaturityRange(range)}</span>
              </span>
            ))}
          </span>
          {rule.ranges.some((range) => range.levels.length > 1) && (
            <span className="mt-2 block">
              * {t("O nível nesta faixa depende dos níveis dos indicadores de contexto.")}
              {rule.dependencies.length > 0 && ` ${rule.dependencies.join(", ")}.`}
            </span>
          )}
        </>
      )}
    </span>
  );
}
