import { getKnex } from "../knex.js";
import { INTERMEDIATE_SCHEMA } from "../constants.js";

const { knex } = getKnex();
const schema = INTERMEDIATE_SCHEMA;

// "Upsert" function for PostgreSQL. Inserts or updates lines in bulk. Insert if
// the primary key for the line is available, update otherwise.

export async function upsert({
  trx,
  tableName,
  data,
  indices: primaryIndices = [],
  constraint = "",
}) {
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

  function batchInsert(rows) {
    if (trx) {
      return knex.batchInsert(tableId, rows, 1000).transacting(trx);
    }

    return knex.batchInsert(tableId, rows, 1000);
  }

  // Just insert if we don't have any indices
  if (primaryIndices.length === 0) {
    return batchInsert(items);
  }

  const itemCount = items.length;

  // Get the set of keys for all items from the first item.
  // All items should have the same keys.
  const itemKeys = Object.keys(items[0]);

  const keysLength = itemKeys.length;
  let placeholderRow = new Array(keysLength);

  for (let i = 0; i < keysLength; i++) {
    placeholderRow[i] = "?";
  }

  // eslint-disable-next-line prefer-template
  placeholderRow = "(" + placeholderRow.join(",") + ")";

  // Create a string of placeholder values (?,?,?) for each item we want to insert
  const valuesPlaceholders = [];

  // Collect all values to insert from all objects in a one-dimensional array.
  // Ensure that each key has a value.
  const insertValues = [];

  let itemIdx = 0;
  let placeholderIdx = 0;
  let valueIdx = 0;

  while (itemIdx < itemCount) {
    const insertItem = items[itemIdx];

    if (insertItem) {
      valuesPlaceholders[placeholderIdx] = placeholderRow;
      placeholderIdx++;

      for (let k = 0; k < keysLength; k++) {
        insertValues[valueIdx] = insertItem[itemKeys[k]];
        valueIdx++;
      }
    }

    itemIdx++;
  }

  // Create the string of update values for the conflict case
  const updateValues = itemKeys
    .filter((key) => !primaryIndices.includes(key)) // Don't update primary indices
    .map((key) => knex.raw("?? = EXCLUDED.??", [key, key]).toString())
    .join(",\n");

  // Get the keys that the ON CONFLICT should check for
  // If a constraint is set, choose that.
  const onConflictKeys = !constraint
    ? `(${primaryIndices.map(() => "??").join(",")})`
    : "ON CONSTRAINT ??";

  const upsertQuery = `
INSERT INTO ?? (${itemKeys.map(() => "??").join(",")})
VALUES ${valuesPlaceholders.join(",")}
ON CONFLICT ${onConflictKeys} DO UPDATE SET
${updateValues};
`;
  const upsertBindings = [
    tableId,
    ...itemKeys,
    ...insertValues,
    ...(!constraint ? primaryIndices : [constraint]),
  ];

  const dbInterface = trx || knex;
  return dbInterface.raw(upsertQuery, upsertBindings);
}
