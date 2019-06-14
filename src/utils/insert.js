import { getKnex } from "../knex";

const { knex } = getKnex();
const schema = "jore";

export async function insert({ tableName, data }) {
  let items = [];

  if (Array.isArray(data)) {
    items = data;
  } else if (data) {
    items = [data];
  }

  if (items.length === 0) {
    return Promise.resolve();
  }

  // Prepend the schema name to the table. This is more convenient in raw queries
  // and batch queries where Knex doesn't seem to use the withSchema function.
  const tableId = `${schema}.${tableName}`;
  return knex.batchInsert(tableId, items, 1000);
}
