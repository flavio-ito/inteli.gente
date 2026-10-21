const { pool } = require("../config/db");

// Todo o SQL do módulo de arboviroses fica neste arquivo. As tabelas arbovirose_*
// são gravadas só pela carga mensal do pipeline de arboviroses e ainda passam pela
// revisão do banco: se um nome mudar, a correção acontece aqui.
//
// Colunas que hoje são boolean saem como texto ('true'/'false'): se a revisão as
// trocar por 0/1, a leitura continua valendo e o serviço normaliza os dois casos.

// Servidor sem a migration, nome revisto ou role sem permissão de leitura: a tela
// mostra "previsão indisponível" em vez de quebrar.
const CODIGOS_MODULO_INDISPONIVEL = new Set([
  "42P01", // tabela ou view inexistente
  "42703", // coluna inexistente
  "42804", // tipo de coluna diferente do esperado
  "42501", // sem permissão de leitura
  "3F000", // esquema inexistente
]);

class ModuloArbovirosesIndisponivelError extends Error {
  constructor(cause) {
    super(`Módulo de arboviroses indisponível no banco: ${cause.message}`);
    this.name = "ModuloArbovirosesIndisponivelError";
    this.code = cause.code;
    this.cause = cause;
  }
}

async function consultar(sql, params, query = (texto, valores) => pool.query(texto, valores)) {
  try {
    const result = await query(sql, params);
    return result.rows;
  } catch (error) {
    if (CODIGOS_MODULO_INDISPONIVEL.has(error.code)) {
      throw new ModuloArbovirosesIndisponivelError(error);
    }
    throw error;
  }
}

async function buscarMunicipio(municipioCodIbge) {
  const linhas = await consultar(
    `
    SELECT municipio_cod_ibge, municipio_nome, estado_sigla
    FROM bd.municipio
    WHERE municipio_cod_ibge = $1
    `,
    [municipioCodIbge]
  );
  return linhas[0] || null;
}

async function listarPrevisoesAtuais(municipioCodigos) {
  return consultar(
    `
    SELECT
      municipio_cod_ibge,
      doenca,
      definicao,
      ano,
      mes,
      horizonte,
      ano_alvo,
      mes_alvo,
      modelo_tipo,
      escore,
      corte,
      faixa_risco,
      em_surto_mes_referencia::text AS em_surto_mes_referencia,
      precisao,
      cobertura,
      escala_shap,
      mes_alvo_a_partir_do_atual::text AS mes_alvo_a_partir_do_atual
    FROM bd.arbovirose_previsao_atual
    WHERE municipio_cod_ibge = ANY($1::int[])
    ORDER BY municipio_cod_ibge, doenca, horizonte
    `,
    [municipioCodigos]
  );
}

// A view acha o mês de referência mais recente com uma subconsulta por linha.
// Num join direto com as tabelas de fatores, o planejador a executa milhares de
// vezes (cerca de 3 s); materializar antes as previsões do município (18 linhas)
// e filtrar o município na tabela particionada leva milissegundos.
const PREVISOES_ATUAIS_DO_MUNICIPIO = `
  WITH atual AS MATERIALIZED (
    SELECT municipio_cod_ibge, doenca, definicao, ano, mes, horizonte
    FROM bd.arbovirose_previsao_atual
    WHERE municipio_cod_ibge = $1
  )
`;

async function listarFatoresPrevisoesAtuais(municipioCodIbge) {
  return consultar(
    `
    ${PREVISOES_ATUAIS_DO_MUNICIPIO}
    SELECT
      a.doenca,
      a.horizonte,
      f.sentido,
      f.posicao,
      f.fator_sigla,
      v.fator_nome,
      v.fator_unidade,
      f.fator_valor,
      f.contribuicao
    FROM atual a
    JOIN bd.arbovirose_previsao_fator f
      ON f.municipio_cod_ibge = a.municipio_cod_ibge
     AND f.doenca = a.doenca
     AND f.definicao = a.definicao
     AND f.ano = a.ano
     AND f.mes = a.mes
     AND f.horizonte = a.horizonte
    JOIN bd.arbovirose_fator v
      ON v.fator_sigla = f.fator_sigla
    WHERE f.municipio_cod_ibge = $1
    ORDER BY a.doenca, a.horizonte, f.sentido, f.posicao
    `,
    [municipioCodIbge]
  );
}

async function listarGruposPrevisoesAtuais(municipioCodIbge) {
  return consultar(
    `
    ${PREVISOES_ATUAIS_DO_MUNICIPIO}
    SELECT
      a.doenca,
      a.horizonte,
      g.grupo_sigla,
      gf.grupo_nome,
      gf.grupo_acionavel::text AS grupo_acionavel,
      g.contribuicao
    FROM atual a
    JOIN bd.arbovirose_previsao_grupo g
      ON g.municipio_cod_ibge = a.municipio_cod_ibge
     AND g.doenca = a.doenca
     AND g.definicao = a.definicao
     AND g.ano = a.ano
     AND g.mes = a.mes
     AND g.horizonte = a.horizonte
    JOIN bd.arbovirose_grupo_fator gf
      ON gf.grupo_sigla = g.grupo_sigla
    WHERE g.municipio_cod_ibge = $1
    ORDER BY a.doenca, a.horizonte, g.contribuicao DESC
    `,
    [municipioCodIbge]
  );
}

// Série mensal observada. NULL no SINAN é "nenhuma notificação no mês"; quem
// chama decide como exibir. anoInicial limita a leitura às partições necessárias.
async function listarSerieMensal(municipioCodigos, variavelSiglas, anoInicial = 0) {
  return consultar(
    `
    SELECT
      municipio_cod_ibge,
      variavel_sigla,
      ano,
      mes,
      variavel_valor_numerico AS valor
    FROM bd.variavel_mensal_associa_municipio
    WHERE municipio_cod_ibge = ANY($1::int[])
      AND variavel_sigla = ANY($2::text[])
      AND ano >= $3
    ORDER BY municipio_cod_ibge, variavel_sigla, ano, mes
    `,
    [municipioCodigos, variavelSiglas, anoInicial]
  );
}

async function listarMunicipiosEstado(estadoSigla) {
  return consultar(
    `
    SELECT
      municipio_cod_ibge,
      municipio_nome,
      estado_sigla,
      municipio_latitude,
      municipio_longitude,
      municipio_area
    FROM bd.municipio
    WHERE estado_sigla = $1
    ORDER BY municipio_cod_ibge
    `,
    [estadoSigla]
  );
}

// Último valor publicado de cada variável anual, por município do estado.
async function listarVariaveisAnuaisEstado(estadoSigla, variavelSiglas) {
  return consultar(
    `
    SELECT DISTINCT ON (mav.municipio_cod_ibge, mav.variavel_sigla)
      mav.municipio_cod_ibge,
      mav.variavel_sigla,
      mav.ano,
      mav.variavel_valor AS valor
    FROM bd.municipio_apresenta_variavel mav
    JOIN bd.municipio m
      ON m.municipio_cod_ibge = mav.municipio_cod_ibge
    WHERE m.estado_sigla = $1
      AND mav.variavel_sigla = ANY($2::text[])
    ORDER BY mav.municipio_cod_ibge, mav.variavel_sigla, mav.ano DESC
    `,
    [estadoSigla, variavelSiglas]
  );
}

// Os últimos `limite` meses com valor de cada série mensal, por município do estado.
async function listarUltimosValoresMensaisEstado(estadoSigla, variavelSiglas, limite) {
  return consultar(
    `
    SELECT municipio_cod_ibge, variavel_sigla, ano, mes, valor
    FROM (
      SELECT
        v.municipio_cod_ibge,
        v.variavel_sigla,
        v.ano,
        v.mes,
        v.variavel_valor_numerico AS valor,
        ROW_NUMBER() OVER (
          PARTITION BY v.municipio_cod_ibge, v.variavel_sigla
          ORDER BY v.ano DESC, v.mes DESC
        ) AS ordem
      FROM bd.variavel_mensal_associa_municipio v
      JOIN bd.municipio m
        ON m.municipio_cod_ibge = v.municipio_cod_ibge
      WHERE m.estado_sigla = $1
        AND v.variavel_sigla = ANY($2::text[])
        AND v.variavel_valor_numerico IS NOT NULL
    ) ultimos
    WHERE ordem <= $3
    ORDER BY municipio_cod_ibge, variavel_sigla, ano DESC, mes DESC
    `,
    [estadoSigla, variavelSiglas, limite]
  );
}

module.exports = {
  CODIGOS_MODULO_INDISPONIVEL,
  ModuloArbovirosesIndisponivelError,
  buscarMunicipio,
  consultar,
  listarFatoresPrevisoesAtuais,
  listarGruposPrevisoesAtuais,
  listarMunicipiosEstado,
  listarPrevisoesAtuais,
  listarSerieMensal,
  listarUltimosValoresMensaisEstado,
  listarVariaveisAnuaisEstado,
};
