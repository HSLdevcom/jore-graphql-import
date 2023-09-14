import fs from "fs-extra";
import { getKnex } from "../knex.js";
import { useIntermediateSchema } from "../utils/useIntermediateSchema.js";

const { knex } = getKnex();

export async function clearDb(intermediate = false) {
  const dropSchema = await fs.readFile(
    new URL("dropSchema.sql", import.meta.url),
    "utf8",
  );
  const modifiedQuery = intermediate ? useIntermediateSchema(dropSchema) : dropSchema;
  return knex.raw(modifiedQuery);
}
