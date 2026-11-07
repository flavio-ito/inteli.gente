from __future__ import annotations

from indicadores.core import IndicatorSpec, Variables, to_number


PESOS_VARIAVEIS = {
    "MMAM261": 1,
    "MMAM2610": 1,
    "MMAM2611": 1,
    "MMAM2612": 1,
    "MMAM2613": 1,
    "MMAM262": 1,
    "MMAM263": 1,
    "MMAM264": 1,
    "MMAM265": 1,
    "MMAM266": 1,
    "MMAM267": 1,
    "MMAM268": 1,
    "MMAM269": 1,
}

TEXTOS_VARIAVEIS = {
    "MMAM261": "Condições climáticas extremas (secas, enxurradas)",
    "MMAM262": "Poluição do ar",
    "MMAM263": "Poluição de algum corpo d’água",
    "MMAM264": "Assoreamento de algum corpo d’água",
    "MMAM265": "Diminuição de vazão de algum corpo d’água",
    "MMAM266": "Desmatamentos",
    "MMAM267": "Queimadas",
    "MMAM268": "Contaminação do solo (por agrotóxicos, fertilizantes)",
    "MMAM269": "Perda de solos por erosão e/ou desertificação (voçorocas, arenização)",
    "MMAM2610": "Degradação de áreas legalmente protegidas",
    "MMAM2611": "Diminuição da biodiversidade (fauna e flora)",
    "MMAM2612": "Existência de moradia em situação de risco ambiental",
    "MMAM2613": "Falta de saneamento (destinação inadequada do esgoto doméstico)",
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
    "4068",
    "sociocultural",
    "gestao_desastres",
    "Somatoria(MMAM261*1 + MMAM2610*1 + MMAM2611*1 + MMAM2612*1 + MMAM2613*1 + MMAM262*1 + MMAM263*1 + MMAM264*1 + MMAM265*1 + MMAM266*1 + MMAM267*1 + MMAM268*1 + MMAM269*1)",
    tuple(PESOS_VARIAVEIS.keys()),
    _calc
)
