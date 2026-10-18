const test = require("node:test");
const assert = require("node:assert/strict");
const {
  normalizeSecurityContext,
  setLocalSecurityContext,
  verifyDatabaseSecurity,
} = require("../src/config/db");

test("normaliza o contexto RLS de uma prefeitura", () => {
  assert.deepEqual(
    normalizeSecurityContext({
      municipio_cod_ibge: "3550308",
      usuario_funcao: "prefeitura",
      usuario_id: "12",
    }),
    {
      municipioCodIbge: 3550308,
      usuarioFuncao: "prefeitura",
      usuarioId: 12,
    },
  );
});

test("permite administrador sem municipio associado", () => {
  assert.deepEqual(
    normalizeSecurityContext({
      municipio_cod_ibge: null,
      usuario_funcao: "admin",
      usuario_id: 1,
    }),
    {
      municipioCodIbge: null,
      usuarioFuncao: "admin",
      usuarioId: 1,
    },
  );
});

test("rejeita contexto de prefeitura sem municipio", () => {
  assert.throws(
    () => normalizeSecurityContext({ usuario_funcao: "prefeitura", usuario_id: 12 }),
    { message: "Contexto de banco sem municipio valido" },
  );
});

test("define o contexto RLS com parametros e escopo local", async () => {
  const calls = [];
  const client = {
    async query(sql, params) {
      calls.push({ params, sql });
      return { rows: [] };
    },
  };

  await setLocalSecurityContext(client, {
    municipio_cod_ibge: 3550308,
    usuario_funcao: "prefeitura",
    usuario_id: 12,
  });

  assert.equal(calls.length, 1);
  assert.match(calls[0].sql, /set_config\('app\.usuario_id', \$1, true\)/);
  assert.match(calls[0].sql, /set_config\('app\.municipio_cod_ibge', \$2, true\)/);
  assert.match(calls[0].sql, /set_config\('app\.usuario_funcao', \$3, true\)/);
  assert.deepEqual(calls[0].params, ["12", "3550308", "prefeitura"]);
});

test("aceita role de banco restrita em producao", async () => {
  const status = await verifyDatabaseSecurity({
    required: true,
    query: async () => ({
      rows: [{
        owns_protected_table: false,
        rolbypassrls: false,
        rolname: "inteligente_api",
        rolsuper: false,
      }],
    }),
  });

  assert.equal(status.secure, true);
});

test("recusa superusuario como role do backend em producao", async () => {
  await assert.rejects(
    verifyDatabaseSecurity({
      required: true,
      query: async () => ({
        rows: [{
          owns_protected_table: true,
          rolbypassrls: true,
          rolname: "postgres",
          rolsuper: true,
        }],
      }),
    }),
    /nao pode ser SUPERUSER/,
  );
});
