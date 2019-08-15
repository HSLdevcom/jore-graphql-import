import { getSelectedTables } from "./selectedTables";
import { startImport, importCompleted } from "./importStatus";
import { createImportStreamForTable } from "./database";
import { processLine } from "./preprocess";
import path from "path";
import fs from "fs-extra";
import { Open } from "unzipper";
import schema from "./schema";
import iconv from "iconv-lite";
import split from "split2";
import { initDb } from "./setup/initDb";
import { getKnex } from "./knex";
import Queue from "p-queue";
import { runGeometryMatcher } from "./geometryMatcher";
import { createForeignKeys } from "./setup/createDb";
import { clearDb } from "./setup/clearDb";
import { useIntermediateSchema } from "./utils/useIntermediateSchema";
import { INTERMEDIATE_SCHEMA, SCHEMA, AZURE_STORAGE_ACCOUNT } from "./constants";
import { createDbDump } from "./utils/createDbDump";
import { uploadDbDump } from "./utils/uploadDbDump";

const { knex } = getKnex();
const cwd = process.cwd();

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const getTableNameFromFileName = (filename) =>
  Object.entries(schema).find(
    ([, { filename: schemaFilename }]) => filename === schemaFilename,
  )[0];

export async function importFile(filePath) {
  const execStart = process.hrtime();
  const { selectedFiles, selectedTables } = getSelectedTables();
  const fileName = path.basename(filePath);

  try {
    await startImport(fileName);
    const queue = new Queue({ concurrency: 50 });

    console.log("Unpacking and processing the archive...");
    const directory = await Open.file(filePath);

    const chosenFiles = directory.files.filter((file) =>
      selectedFiles.includes(file.path),
    );

    // Add static terminaaliryhma.dat file to the import.
    // If you use more props or methods on the File objects returned
    // from Unzipper.Open, remember to mirror them on this file.
    const terminalGroupFileName = "terminaaliryhma.dat";
    chosenFiles.push({
      path: terminalGroupFileName,
      stream() {
        return fs.createReadStream(path.join(cwd, "data", terminalGroupFileName));
      },
    });

    console.log("Resetting the database...");
    // Remove the intermediate schema (by passing true) if it exists
    await clearDb(true);

    // Init the intermediate schema
    await initDb();

    const filePromises = chosenFiles.map(
      (file) =>
        new Promise(async (resolve, reject) => {
          const tableName = getTableNameFromFileName(file.path);
          const importStream = await createImportStreamForTable(tableName, queue);

          file
            .stream()
            .pipe(iconv.decodeStream("ISO-8859-1"))
            .pipe(iconv.encodeStream("utf8"))
            .pipe(split())
            .pipe(processLine(tableName))
            .pipe(importStream)
            .on("finish", () => {
              resolve(tableName);
            })
            .on("error", reject);
        }),
    );

    console.log("Importing the data...");
    await Promise.all(filePromises);

    console.log("Finishing up the DB queries...");
    await delay(1000);
    await queue.onEmpty();

    if (selectedTables.includes("geometry")) {
      console.log("Creating the geometry table...");

      const createGeometrySQL = await fs.readFile(
        path.join(cwd, "src", "setup", "createGeometry.sql"),
        "utf8",
      );

      await knex.raw(useIntermediateSchema(createGeometrySQL));
      await runGeometryMatcher(INTERMEDIATE_SCHEMA);
    }

    // Switch the current active schema to be named "[schema name]_old"
    // and the new schema where we imported all the data to be named "[schema name]".
    // The schema name is controlled by the SCHEMA and INTERMEDIATE_SCHEMA constants,
    // and the schema name has traditionally been "jore". Note that the names are
    // hard-coded in this particular SQL script.

    const switchSchemasSQL = await fs.readFile(
      path.join(cwd, "src", "setup", "switchSchemas.sql"),
      "utf8",
    );

    await knex.raw(switchSchemasSQL);

    await createForeignKeys(SCHEMA, schema, knex);

    const createFunctionsSQL = await fs.readFile(
      path.join(cwd, "src", "setup", "createFunctions.sql"),
      "utf8",
    );

    await knex.raw(createFunctionsSQL);

    // Disallow dump and upload by unsetting AZURE_STORAGE_ACCOUNT
    if (AZURE_STORAGE_ACCOUNT) {
      const dumpFilePath = await createDbDump();
      await uploadDbDump(dumpFilePath);
    }

    const [execDuration] = process.hrtime(execStart);
    await importCompleted(fileName, true, execDuration);

    console.log(`${fileName} imported in ${execDuration}s`);
  } catch (err) {
    const [execDuration] = process.hrtime(execStart);

    console.log(`${fileName} import failed. Duration: ${execDuration}s`);
    console.error(err);

    await importCompleted(fileName, false, execDuration);
  }
}
