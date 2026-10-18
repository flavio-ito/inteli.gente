BEGIN;

-- O backend define estas variaveis somente a partir da sessao autenticada e
-- dentro da mesma transacao que executa as consultas protegidas.
ALTER TABLE stg.formulario_submissao ENABLE ROW LEVEL SECURITY;
ALTER TABLE stg.formulario_submissao FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS formulario_submissao_tenant_policy
  ON stg.formulario_submissao;

CREATE POLICY formulario_submissao_tenant_policy
  ON stg.formulario_submissao
  USING (
    current_user = 'inteligente_etl'
    OR current_setting('app.usuario_funcao', true) = 'admin'
    OR municipio_cod_ibge = NULLIF(
      current_setting('app.municipio_cod_ibge', true),
      ''
    )::integer
  )
  WITH CHECK (
    current_user = 'inteligente_etl'
    OR current_setting('app.usuario_funcao', true) = 'admin'
    OR (
      municipio_cod_ibge = NULLIF(
        current_setting('app.municipio_cod_ibge', true),
        ''
      )::integer
      AND usuario_id = NULLIF(
        current_setting('app.usuario_id', true),
        ''
      )::integer
    )
  );

ALTER TABLE stg.municipio_apresenta_variavel ENABLE ROW LEVEL SECURITY;
ALTER TABLE stg.municipio_apresenta_variavel FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS municipio_apresenta_variavel_tenant_policy
  ON stg.municipio_apresenta_variavel;

CREATE POLICY municipio_apresenta_variavel_tenant_policy
  ON stg.municipio_apresenta_variavel
  USING (
    current_user = 'inteligente_etl'
    OR current_setting('app.usuario_funcao', true) = 'admin'
    OR municipio_cod_ibge = NULLIF(
      current_setting('app.municipio_cod_ibge', true),
      ''
    )::integer
  )
  WITH CHECK (
    current_user = 'inteligente_etl'
    OR current_setting('app.usuario_funcao', true) = 'admin'
    OR (
      municipio_cod_ibge = NULLIF(
        current_setting('app.municipio_cod_ibge', true),
        ''
      )::integer
      AND EXISTS (
        SELECT 1
        FROM stg.formulario_submissao s
        WHERE s.submissao_id = municipio_apresenta_variavel.submissao_id
          AND s.usuario_id = NULLIF(
            current_setting('app.usuario_id', true),
            ''
          )::integer
      )
    )
  );

COMMIT;
