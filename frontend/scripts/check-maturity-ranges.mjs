import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../../", import.meta.url));

// The checked-in catalog lets Node-only deployments build without Python.
// Refuse stale data when any original rule changes, is added or is removed.
export function checkMaturityRanges() {
  const catalog = JSON.parse(readFileSync(path.join(root, "frontend/src/data/maturityRanges.json"), "utf8"));
  const rulesRoot = path.join(root, "database/indicadores/dimensoes");
  const sources = readdirSync(rulesRoot, { recursive: true })
    .filter((name) => /[/\\]maturidade[/\\]maturidade_\d+\.py$/.test(name))
    .map((name) => `database/indicadores/dimensoes/${name.replaceAll("\\", "/")}`);
  if (sources.length !== Object.keys(catalog.sources).length || sources.some((name) => (
    createHash("sha256").update(readFileSync(path.join(root, name), "utf8").replaceAll("\r\n", "\n")).digest("hex") !== catalog.sources[name]
  ))) {
    throw new Error("Faixas de maturidade desatualizadas. Na raiz do projeto, execute: python database/exportar_faixas_maturidade.py");
  }
}
