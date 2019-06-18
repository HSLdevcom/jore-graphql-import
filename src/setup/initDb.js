import { createTables, createPrimaryKeys } from "./createDb";
import fs from "fs-extra";
import path from "path";
import tables from "../schema";
import { pick } from "lodash";
import { getKnex } from "../knex";

const { knex } = getKnex();

export async function initDb() {
  try {
    const createSchemaSQL = await fs.readFile(
      path.join(__dirname, "createSchema.sql"),
      "utf8",
    );

    await knex.raw(createSchemaSQL);
    const createdTables = await createTables("jore", tables, knex);

    if (createdTables.length !== 0) {
      await createPrimaryKeys("jore", pick(tables, createdTables), knex);
    }

    const createFunctionsSQL = await fs.readFile(
      path.join(__dirname, "createFunctions.sql"),
      "utf8",
    );

    await knex.raw(createFunctionsSQL);
  } catch (err) {
    console.error(err);
    throw err;
  }
}
