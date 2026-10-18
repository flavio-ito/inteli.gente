const { Pool } = require("pg");

const pool = new Pool({
  host: process.env.PGHOST,
  port: Number(process.env.PGPORT),
  database: process.env.PGDATABASE,
  user: process.env.PGUSER,
  password: process.env.PGPASSWORD,
});

function normalizeSecurityContext(usuario = {}) {
  const usuarioId = Number(usuario.usuario_id);
  const municipioCodIbge = usuario.municipio_cod_ibge == null
    ? null
    : Number(usuario.municipio_cod_ibge);
  const usuarioFuncao = String(usuario.usuario_funcao || "").trim().toLowerCase();

  if (!Number.isSafeInteger(usuarioId) || usuarioId <= 0) {
    throw new Error("Contexto de banco sem usuario valido");
  }
  if (!new Set(["admin", "prefeitura"]).has(usuarioFuncao)) {
    throw new Error("Contexto de banco com funcao invalida");
  }
  if (
    usuarioFuncao === "prefeitura" &&
    (!Number.isSafeInteger(municipioCodIbge) || municipioCodIbge <= 0)
  ) {
    throw new Error("Contexto de banco sem municipio valido");
  }

  return { municipioCodIbge, usuarioFuncao, usuarioId };
}

async function setLocalSecurityContext(client, usuario) {
  const context = normalizeSecurityContext(usuario);
  await client.query(
    `SELECT
       set_config('app.usuario_id', $1, true),
       set_config('app.municipio_cod_ibge', $2, true),
       set_config('app.usuario_funcao', $3, true)`,
    [
      String(context.usuarioId),
      context.municipioCodIbge == null ? "" : String(context.municipioCodIbge),
      context.usuarioFuncao,
    ],
  );
  return context;
}

async function withSecurityContext(usuario, operation) {
  if (typeof operation !== "function") {
    throw new TypeError("A operacao de banco deve ser uma funcao");
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await setLocalSecurityContext(client, usuario);
    const result = await operation(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function verifyDatabaseSecurity({
  required = process.env.NODE_ENV === "production",
  query = pool.query.bind(pool),
} = {}) {
  const result = await query(
    `SELECT
       r.rolname,
       r.rolsuper,
       r.rolbypassrls,
       EXISTS (
         SELECT 1
         FROM pg_class c
         JOIN pg_namespace n ON n.oid = c.relnamespace
         WHERE pg_get_userbyid(c.relowner) = current_user
           AND n.nspname = 'stg'
           AND c.relname IN (
             'formulario_submissao',
             'municipio_apresenta_variavel'
           )
       ) AS owns_protected_table
     FROM pg_roles r
     WHERE r.rolname = current_user`,
  );
  const role = result.rows[0];
  if (!role) throw new Error("Nao foi possivel validar a role do PostgreSQL");

  const insecure = role.rolsuper || role.rolbypassrls || role.owns_protected_table;
  if (required && insecure) {
    throw new Error(
      "A role do backend nao pode ser SUPERUSER, BYPASSRLS nem proprietaria das tabelas protegidas",
    );
  }
  return { ...role, secure: !insecure };
}

module.exports = {
  normalizeSecurityContext,
  pool,
  setLocalSecurityContext,
  verifyDatabaseSecurity,
  withSecurityContext,
};
