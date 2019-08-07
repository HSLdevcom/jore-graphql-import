import fs from "fs-extra";
import path from "path";
import { getKnex } from "../knex";
import { useIntermediateSchema } from "../utils/useIntermediateSchema";

const { knex } = getKnex();

export async function clearDb(intermediate = false) {
  const dropSchema = await fs.readFile(path.join(__dirname, "dropSchema.sql"), "utf8");
  const modifiedQuery = intermediate ? useIntermediateSchema(dropSchema) : dropSchema;
  return knex.raw(modifiedQuery);
}
