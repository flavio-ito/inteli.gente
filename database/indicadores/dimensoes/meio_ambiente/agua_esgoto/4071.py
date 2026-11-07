from indicadores.core import IndicatorSpec, Variables, required, to_number


def _calc(variaveis: Variables):
    required(variaveis, ("GTA1009", "GTA1001"))
    gta1009 = to_number(variaveis["GTA1009"])
    gta1001 = to_number(variaveis["GTA1001"])
    if gta1001 <= 0:
        raise ValueError("GTA1001 deve ser maior que zero")
    return (gta1009 / gta1001) * 100, {"GTA1009": gta1009, "GTA1001": gta1001}


SPEC = IndicatorSpec(
    "4071",
    "meio_ambiente",
    "agua_esgoto",
    "Indicador (%) = (GTA1009/GTA1001)*100",
    ("GTA1009", "GTA1001"),
    _calc,
)
