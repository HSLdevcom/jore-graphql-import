import fs from "fs-extra";
import path from "path";
import { getKnex } from "../knex";

const { knex } = getKnex();

export async function clearDb() {
  const dropSchema = await fs.readFile(path.join(__dirname, "dropSchema.sql"), "utf8");
  return knex.raw(dropSchema);
}
