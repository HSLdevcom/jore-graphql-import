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
import { intersection } from "lodash";

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
  const { selectedFiles } = getSelectedTables();
  const fileName = path.basename(filePath);

  try {
    await startImport(fileName);
    const queue = [];

    console.log("Unpacking and processing the archive...");

    const directory = await Open.file(filePath);
    const chosenFiles = directory.files.filter((file) =>
      selectedFiles.includes(file.path),
    );

    console.log("Resetting the database...");
    await initDb();

    const filePromises = chosenFiles.map(
      (file) =>
        new Promise((resolve, reject) => {
          const tableName = getTableNameFromFileName(file.path);
          const importStream = createImportStreamForTable(tableName, queue);

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
    await Promise.all(queue);

    console.log("Creating the geometry table...");
    const createGeometrySQL = await fs.readFile(
      path.join(cwd, "src", "setup", "createGeometry.sql"),
      "utf8",
    );

    await knex.raw(createGeometrySQL);

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
