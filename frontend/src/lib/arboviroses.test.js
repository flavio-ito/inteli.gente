import { describe, expect, it } from "vitest";
import {
  confidenceMessage,
  describeMonthRange,
  forecastHeadline,
  formatFactorValue,
  seriesForYear,
} from "./arboviroses";

const month = (mes, faixa = "baixo", ano = 2026) => ({ ano_alvo: ano, mes_alvo: mes, faixa_risco: faixa });

describe("forecastHeadline", () => {
  it("names the months actually covered when there is no alert", () => {
    const forecast = {
      situacao: "sem_alerta",
      principal_horizonte: 4,
      meses: [month(10), month(11), month(12)].map((item, index) => ({ ...item, horizonte: 4 + index })),
    };

    expect(forecastHeadline(forecast, "dengue")).toMatchObject({
      tone: "calm",
      title: "Não há previsão de surto de dengue entre outubro e dezembro de 2026",
    });
  });

  it("announces the first alert month as the outbreak onset", () => {
    const forecast = {
      situacao: "inicio",
      principal_horizonte: 6,
      meses: [{ ...month(10), horizonte: 4 }, { ...month(12, "alto"), horizonte: 6 }],
    };

    expect(forecastHeadline(forecast, "dengue").title).toBe(
      "Início de surto de dengue previsto para dezembro de 2026",
    );
  });

  it("does not offer a forecast for yellow fever", () => {
    expect(forecastHeadline(undefined, "febre_amarela").title).toBe(
      "Febre amarela não tem previsão de surto",
    );
  });
});

describe("describeMonthRange", () => {
  it("spans two years when needed", () => {
    expect(describeMonthRange([month(11), month(1, "baixo", 2027)])).toBe(
      "entre novembro de 2026 e janeiro de 2027",
    );
  });
});

describe("confidenceMessage", () => {
  it("uses precision for alerts and coverage otherwise", () => {
    expect(confidenceMessage({ medida: "precisao", valor: 0.5085 })).toMatch(/cerca de 5 confirmaram surto/);
    expect(confidenceMessage({ medida: "cobertura", valor: 0.6959 })).toMatch(/cerca de 7 em cada 10 surtos/);
    expect(confidenceMessage(null)).toBeNull();
  });
});

describe("formatFactorValue", () => {
  it("formats SHAP factor values with their unit", () => {
    expect(formatFactorValue(17.971667, "°C")).toBe("18 °C");
    expect(formatFactorValue(2.490975, "m/s")).toBe("2,49 m/s");
    expect(formatFactorValue(69.02129, "%")).toBe("69%");
    expect(formatFactorValue(1664, "casos")).toBe("1.664 casos");
    expect(formatFactorValue(1, "casos")).toBe("1 caso");
    expect(formatFactorValue(0, "1 = sim, 0 = não")).toBe("não");
    expect(formatFactorValue(-1, "índice de -1 a 1")).toBe("-1");
    expect(formatFactorValue(null, "casos")).toBe("sem dado");
  });
});

describe("seriesForYear", () => {
  it("leaves months beyond the end of the series empty instead of zero", () => {
    const points = seriesForYear(
      [
        { ano: 2026, mes: 5, casos: 0 },
        { ano: 2026, mes: 6, casos: 46 },
      ],
      2026,
    );

    expect(points[4]).toEqual({ month: "Mai", casos: 0 });
    expect(points[5]).toEqual({ month: "Jun", casos: 46 });
    expect(points[6]).toEqual({ month: "Jul", casos: null });
  });
});
