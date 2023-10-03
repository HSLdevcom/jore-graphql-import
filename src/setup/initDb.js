import fs from "fs-extra";
import { pick } from "lodash-es";

import { createTables, createPrimaryKeys } from "./createDb.js";
import tables from "../schema.js";
import { getKnex } from "../knex.js";
import { INTERMEDIATE_SCHEMA } from "../constants.js";
import { useIntermediateSchema } from "../utils/useIntermediateSchema.js";

const { knex } = getKnex();

// Always run initDb on an empty database (after dropping the jore schema)

export async function initDb() {
  try {
    const createSchemaSQL = await fs.readFile(
      new URL("createSchema.sql", import.meta.url),
      "utf8",
    );

    const createImportStatus = await fs.readFile(
      new URL("createImportStatus.sql", import.meta.url),
      "utf8",
    );

    const createJoreStaticTables = await fs.readFile(
      new URL("createJoreStaticTables.sql", import.meta.url),
      "utf8",
    );

    await knex.raw(`
      ${useIntermediateSchema(createSchemaSQL)}
      ${createImportStatus}
      ${createJoreStaticTables}
    `);

    const createdTables = await createTables(INTERMEDIATE_SCHEMA, tables, knex);

    if (createdTables.length !== 0) {
      await createPrimaryKeys(INTERMEDIATE_SCHEMA, pick(tables, createdTables), knex);
    }

    const createFunctionsSQL = await fs.readFile(
      new URL("createFunctions.sql", import.meta.url),
      "utf8",
    );

    await knex.raw(useIntermediateSchema(createFunctionsSQL));
  } catch (err) {
    console.error(err);
    throw err;
  }
}
