from indicadores.core import IndicatorSpec, Variables, required, to_number


def _calc(variaveis: Variables):
    required(variaveis, ("MTIC12b13",))
    valor = to_number(variaveis["MTIC12b13"])
    return valor, {"MTIC12b13": valor}


SPEC = IndicatorSpec(
    "6055",
    "capacidades_institucionais",
    "monitoramento",
    "Indicador = MTIC12b13",
    ("MTIC12b13",),
    _calc,
)
