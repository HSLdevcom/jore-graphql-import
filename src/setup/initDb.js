import { createTables, createPrimaryKeys } from "./createDb";
import fs from "fs-extra";
import path from "path";
import tables from "../schema";
import { pick } from "lodash";
import { getKnex } from "../knex";
import { INTERMEDIATE_SCHEMA } from "../constants";
import { useIntermediateSchema } from "../utils/useIntermediateSchema";

const { knex } = getKnex();

// Always run initDb on an empty database (after dropping the jore schema)

export async function initDb() {
  try {
    const createSchemaSQL = await fs.readFile(
      path.join(__dirname, "createSchema.sql"),
      "utf8",
    );

    const createImportStatus = await fs.readFile(
      path.join(__dirname, "createImportStatus.sql"),
      "utf8",
    );

    await knex.raw(`
      ${useIntermediateSchema(createSchemaSQL)}
      ${createImportStatus}
    `);

    const createdTables = await createTables(INTERMEDIATE_SCHEMA, tables, knex);

    if (createdTables.length !== 0) {
      await createPrimaryKeys(INTERMEDIATE_SCHEMA, pick(tables, createdTables), knex);
    }

    const createFunctionsSQL = await fs.readFile(
      path.join(__dirname, "createFunctions.sql"),
      "utf8",
    );

    await knex.raw(useIntermediateSchema(createFunctionsSQL));
  } catch (err) {
    console.error(err);
    throw err;
  }
}
