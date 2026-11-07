import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { I18nProvider } from "@/lib/i18n";
import IndicatorsTable from "./IndicatorsTable";
import IndicatorMaturityRanges from "./IndicatorMaturityRanges";

describe("indicator maturity information", () => {
  it.each([false, true])("includes ranges alongside description and source (text=%s)", (valueIsText) => {
    render(<I18nProvider><IndicatorsTable tableOnly indicators={[{
      id: "3117", label: "Abastecimento de água", description: "População atendida.",
      variableSources: ["SINISA"], value: "90,56%", level: 5, valueIsText,
    }]} /></I18nProvider>);
    expect(screen.getByRole("button", { name: "Informações sobre Abastecimento de água" })).toBeInTheDocument();
    expect(screen.getByText("População atendida.")).toBeInTheDocument();
    expect(screen.getByText("SINISA")).toBeInTheDocument();
    const table = screen.getByRole("table", { name: "Faixas de maturidade" });
    expect(within(table).getAllByRole("row")).toHaveLength(8);
    expect(within(table).getByText("0 ≤ valor ≤ 35,99")).toBeInTheDocument();
    expect(within(table).getByText("87,78 < valor ≤ 92,2").parentElement).toHaveClass("bg-[#edf5ff]");
    expect(within(table).getByText("> 99")).toBeInTheDocument();
  });

  it("explains contextual levels and lists their dependencies", () => {
    render(<I18nProvider><IndicatorMaturityRanges indicatorId="6005" /></I18nProvider>);
    expect(screen.getByText("3 / 4 / 5 *")).toBeInTheDocument();
    expect(screen.getByText(/6003, 6006/)).toBeInTheDocument();
  });

  it("reports undefined rules without inventing ranges", () => {
    render(<I18nProvider><IndicatorMaturityRanges indicatorId="4069" /></I18nProvider>);
    expect(screen.getByText("Este indicador ainda não possui faixas de maturidade definidas.")).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });
});
