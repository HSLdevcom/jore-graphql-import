import { getKnex } from "./knex";
import { omit } from "lodash";

const { knex } = getKnex();

const statusTable = "import_status";
const schema = "public";

export async function getLatestImportedFile() {
  return knex
    .withSchema(schema)
    .first()
    .from(statusTable)
    .orderBy("import_start", "desc");
}

export const upsert = async (data) => {
  const { filename } = data;

  const hasRecord = await knex
    .withSchema(schema)
    .first("filename")
    .from(statusTable)
    .where({ filename });

  if (hasRecord) {
    return knex
      .withSchema(schema)
      .from(statusTable)
      .where({ filename })
      .update(omit(data, "filename"));
  }

  return knex
    .withSchema(schema)
    .insert(data)
    .into(statusTable);
};

export const startImport = async (filename) =>
  upsert({
    filename,
    import_end: null,
    success: false,
  });

export const importCompleted = async (filename, isSuccess = true, duration = 0) =>
  upsert({
    filename,
    import_end: knex.raw("NOW()"),
    success: isSuccess,
    duration,
  });
