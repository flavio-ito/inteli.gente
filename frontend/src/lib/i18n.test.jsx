import { describe, expect, it } from "vitest";
import { translateString } from "./i18n";

describe("i18n", () => {
  it.each([
    ["en", "Outbreak expected to start in December", "dengue cases in the year", "Overall score 75 out of 100"],
    ["fr", "Début de l'épidémie prévu en décembre", "Cas de dengue sur l'année", "Score global de 75 sur 100"],
    ["es", "Inicio del brote previsto para diciembre", "Casos de dengue en el año", "Puntuación general de 75 sobre 100"],
  ])("traduz mensagens dinâmicas em %s", (language, outbreak, cases, score) => {
    expect(translateString("Início do surto previsto para dezembro", language)).toBe(outbreak);
    expect(translateString("Casos de dengue no ano", language)).toBe(cases);
    expect(translateString("Pontuação geral 75 de 100", language)).toBe(score);
    expect(translateString("Descrição", language)).not.toBe("Descrição");
  });

  it("traduz corretamente regiões selecionadas", () => {
    expect(translateString("Região - Sul", "en")).toBe("Region - Southern");
    expect(translateString("Região - Sul", "fr")).toBe("Région - Sud");
    expect(translateString("Região - Sul", "es")).toBe("Región - Sur");
  });

  it("mantém o português como texto-fonte", () => {
    expect(translateString("Região - Sul", "pt")).toBe("Região - Sul");
  });

  it("traduz o filtro e o título de municípios respondentes", () => {
    expect(translateString("Respondentes", "en")).toBe("Respondents");
    expect(translateString("Brasil — municípios respondentes", "en")).toBe(
      "Brazil — responding municipalities",
    );
    expect(translateString("Brasil — municípios respondentes", "fr")).toBe(
      "Brésil — municipalités répondantes",
    );
    expect(translateString("Brasil — municípios respondentes", "es")).toBe(
      "Brasil — municipios respondientes",
    );
  });

  it("traduz o título de acesso à conta como uma frase completa", () => {
    expect(translateString("Acesse sua conta", "en")).toBe("Sign in to your account");
    expect(translateString("Acesse sua conta", "fr")).toBe("Connectez-vous à votre compte");
    expect(translateString("Acesse sua conta", "es")).toBe("Inicie sesión en su cuenta");
  });
});
