from __future__ import annotations

from indicadores.core import IndicatorSpec, Variables, to_number


PESOS_VARIAVEIS = {
    "MGRD01": 1,
    "MGRD06": 1,
    "MGRD07": 1,
    "MGRD08": 1,
    "MGRD11": 1,
    "MGRD14": 1,
}

TEXTOS_VARIAVEIS = {
    "MGRD01": "O município foi atingido pela seca nos últimos 4 anos",
    "MGRD06": "O município foi atingido por alagamentos nos últimos 4 anos",
    "MGRD07": "O município foi atingido por processo erosivo acelerado nos últimos 4 anos",
    "MGRD08": "O município foi atingido por enchentes ou inundações graduais nos últimos 4 anos",
    "MGRD11": "O município foi atingido por enxurradas ou inundações bruscas nos últimos 4 anos",
    "MGRD14": "O município foi atingido por escorregamentos ou deslizamentos de encostas nos últimos 4 anos",
}


def _calc(variaveis: Variables):
    usadas = {
        sigla: to_number(variaveis.get(sigla, 0), default=0.0)
        for sigla in PESOS_VARIAVEIS
    }
    valor = sum(usadas[sigla] * peso for sigla, peso in PESOS_VARIAVEIS.items())
    textos_ativos = [
        texto
        for sigla, texto in TEXTOS_VARIAVEIS.items()
        if usadas.get(sigla, 0) == 1
    ]
    return valor, usadas, "; ".join(textos_ativos)


SPEC = IndicatorSpec(
    "4042",
    "sociocultural",
    "gestao_desastres",
    "Somatoria(MGRD01*1 + MGRD06*1 + MGRD07*1 + MGRD08*1 + MGRD11*1 + MGRD14*1)",
    tuple(PESOS_VARIAVEIS.keys()),
    _calc
)
