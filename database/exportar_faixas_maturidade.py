"""Exporta as faixas das regras Python para os informativos do frontend.

Execute na raiz: python database/exportar_faixas_maturidade.py
Não importa o pacote indicadores nem acessa o banco. Os pontos de corte são
obtidos da AST; a função calcular original é avaliada em cada intervalo e
fronteira. As consultas de contexto são substituídas pelos níveis possíveis.
"""
from __future__ import annotations

import ast
import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
RULES = ROOT / "database/indicadores/dimensoes"
OUTPUT = ROOT / "frontend/src/data/maturityRanges.json"


def rule_paths():
    return sorted(RULES.glob("*/maturidade/maturidade_*.py"))


def extract_ranges(path: Path):
    tree = ast.parse(path.read_text(encoding="utf-8-sig"))
    function = next(n for n in tree.body if isinstance(n, ast.FunctionDef) and n.name == "calcular")
    # A few rules calculate the contextual weighted average inline. Retain the
    # input branches and replace only SQL/aggregation with its possible levels,
    # preserving the original clamp at the end of the function.
    sql_start = next((i for i, n in enumerate(function.body) if isinstance(n, ast.If) and ast.unparse(n.test).startswith("conn is None")), None)
    if sql_start is not None:
        tail = function.body[sql_start:]
        clamps = [n for n in tail if isinstance(n, ast.If) and isinstance(n.test, ast.Compare) and isinstance(n.test.left, ast.Name) and n.test.left.id == "nivel_topico"]
        if len(clamps) != 2:
            raise ValueError(f"Limites de contexto não reconhecidos: {path}")
        replacement = ast.parse("nivel_topico = _calcular_nivel_contexto()\nif nivel_topico is None:\n    return nivel_base\n").body
        function.body = function.body[:sql_start] + replacement + clamps + [ast.Return(value=ast.Name(id="nivel_topico", ctx=ast.Load()))]
    cutoffs = set()
    for node in ast.walk(function):
        if isinstance(node, ast.Compare) and any(
            isinstance(n, ast.Name) and n.id == "ind" for n in ast.walk(node)
        ):
            # Current rules compare ind directly with numeric constants. Fail
            # explicitly if a new rule requires a different partition strategy.
            for operand in [node.left, *node.comparators]:
                if isinstance(operand, ast.Name) and operand.id == "ind":
                    continue
                if isinstance(operand, ast.Call) and ast.unparse(operand).startswith("abs(float(ind) - "):
                    center = ast.literal_eval(operand.args[0].right)
                    tolerance = ast.literal_eval(node.comparators[0])
                    cutoffs.update([center - tolerance, center, center + tolerance])
                    continue
                value = ast.literal_eval(operand)
                values = value if isinstance(value, tuple) else [value]
                if not all(isinstance(v, (int, float)) for v in values):
                    raise ValueError(f"Comparação não suportada em {path}")
                cutoffs.update(values)

    helpers = {
        n.func.id for n in ast.walk(function)
        if isinstance(n, ast.Call) and isinstance(n.func, ast.Name)
        and n.func.id.startswith(("_calcular_nivel_contexto", "_buscar_nivel_"))
    }
    calls = {n.func.id for n in ast.walk(function) if isinstance(n, ast.Call) and isinstance(n.func, ast.Name)}
    if calls - helpers - {"ValueError", "abs", "float"}:
        raise ValueError(f"Chamada não suportada em {path}: {calls - helpers}")

    # Keep only the original calculation and literal context weights; helper
    # functions that query SQL are never compiled or executed here.
    weights = {}
    for node in tree.body:
        if isinstance(node, ast.AnnAssign) and isinstance(node.target, ast.Name) and node.target.id == "INDICADORES_CONTEXTO_PESOS":
            weights = ast.literal_eval(node.value)
        if isinstance(node, ast.Assign) and any(isinstance(t, ast.Name) and t.id == "INDICADORES_CONTEXTO_PESOS" for t in node.targets):
            weights = ast.literal_eval(node.value)
    module = ast.Module(body=[ast.ImportFrom(module="__future__", names=[ast.alias(name="annotations")], level=0), function], type_ignores=[])
    namespace = {"INDICADORES_CONTEXTO_PESOS": weights}
    exec(compile(ast.fix_missing_locations(module), str(path), "exec"), namespace)

    points = sorted(cutoffs)
    cells = []
    previous = None
    for point in points:
        cells.append((previous, point, False, False, point - max(1, abs(point)) if previous is None else (previous + point) / 2))
        cells.append((point, point, True, True, point))
        previous = point
    cells.append((previous, None, False, False, 0 if previous is None else previous + max(1, abs(previous))))

    segments = []
    for lower, upper, lower_inclusive, upper_inclusive, sample in cells:
        levels = set()
        for context_level in ([None, *range(1, 8)] if helpers else [None]):
            for helper in helpers:
                namespace[helper] = lambda *args, _level=context_level: _level
            try:
                level = namespace["calcular"](sample)
            except ValueError:
                level = None
            if level in range(1, 8):
                levels.add(level)
        levels = sorted(levels)
        # Include unclassified cells while merging, so gaps in discrete rules
        # can never accidentally become a continuous range.
        if segments and segments[-1]["levels"] == levels:
            segments[-1].update(upper=upper, upperInclusive=upper_inclusive)
        else:
            segments.append(dict(lower=lower, upper=upper, lowerInclusive=lower_inclusive, upperInclusive=upper_inclusive, levels=levels))

    dependencies = sorted(weights) or sorted(int(name.rsplit("_", 1)[1]) for name in helpers if name.startswith("_buscar_nivel_"))
    return {"ranges": [s for s in segments if s["levels"]], "dependencies": dependencies}


def build_catalog():
    return {
        "sources": {
            p.relative_to(ROOT).as_posix(): hashlib.sha256(p.read_text(encoding="utf-8").encode("utf-8")).hexdigest()
            for p in rule_paths()
        },
        "indicators": {p.stem.removeprefix("maturidade_"): extract_ranges(p) for p in rule_paths()},
    }


if __name__ == "__main__":
    catalog = build_catalog()
    OUTPUT.write_text(json.dumps(catalog, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Faixas exportadas: {len(catalog['indicators'])} indicadores.")
