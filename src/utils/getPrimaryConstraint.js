import { get } from "lodash-es";
import { getKnex } from "../knex.js";
import { INTERMEDIATE_SCHEMA } from "../constants.js";

const { knex } = getKnex();
const schema = INTERMEDIATE_SCHEMA;

export async function getPrimaryConstraint(tableName) {
  const { rows } = await knex.raw(
    `SELECT con.*
     FROM pg_catalog.pg_constraint con
            INNER JOIN pg_catalog.pg_class rel
                       ON rel.oid = con.conrelid
            INNER JOIN pg_catalog.pg_namespace nsp
                       ON nsp.oid = connamespace
     WHERE nsp.nspname = ?
       AND rel.relname = ?;`,
    [schema, tableName],
  );

  // Only interested in primary constraints
  return get(rows.filter((row) => row.conname.includes("pkey")), "[0].conname", null);
}
