/* eslint-disable consistent-return */
import fs from "fs";

import { createScheduledImport, startScheduledImport } from "./schedule.js";
import { importFile } from "./import.js";
import { DEFAULT_EXPORT_SOURCE, DAILY_TASK_SCHEDULE } from "./constants.js";
import { fetchExportFromFTP } from "./sources/fetchExportFromFTP.js";
import { server } from "./server.js";
import { getKnex } from "./knex.js";
import { reportInfo, reportError } from "./monitor.js";

// The global state that informs the app if an import task is running.
// Always check this state before starting an import.
let isImporting = false;
let currentImporter = "";
const { knex } = getKnex();

// Marks the global isImporting state as true, blocking other imports.
// Also acts as a guard that can be used in if-statements.
const onBeforeImport = (importerId = "global") => {
  if (isImporting) {
    return false;
  }

  isImporting = true;
  currentImporter = importerId;

  return true;
};

// Sets the global isImporting state to false, allowing other import tasks to proceed.
const onAfterImport = (importerId = "global") => {
  if (importerId === currentImporter) {
    isImporting = false;
    currentImporter = "";
    return true;
  }

  return false;
};

const sources = {
  daily: fetchExportFromFTP,
};

// This is the daily scheduled task that runs the import.
createScheduledImport("daily", DAILY_TASK_SCHEDULE, async (onComplete = () => {}) => {
  const importId = "default-source";
  const downloadSource = sources[DEFAULT_EXPORT_SOURCE];

  if (!downloadSource) {
    console.log(`${DEFAULT_EXPORT_SOURCE} is not defined as a source for the importer.`);
    onComplete();
    return;
  }

  if (onBeforeImport(importId)) {
    try {
      console.log(`Importing from source ${DEFAULT_EXPORT_SOURCE}.`);
      const fileToImport = await downloadSource();

      if (fileToImport) {
        await importFile(fileToImport);
      }
    } catch (err) {
      console.log(err);
    }
  }

  onAfterImport(importId);
  onComplete();
});

(async () => {
  const createImportStatus = fs.readFileSync(
    new URL("setup/createImportStatus.sql", import.meta.url),
    "utf8",
  );

  await knex.raw(createImportStatus);

  // Start the task for the daily import as soon as the server starts.
  // This will start the timer.
  await reportInfo("Import started.");
  startScheduledImport("daily");
  server(() => isImporting, onBeforeImport, onAfterImport);
})();

const onCrash = async (e) => {
  console.log("Uncaught Exception...");
  console.error(e);
  await reportError(`Uncaught exception: ${e.message || "Something happened!"}`);
  await knex.destroy();
  process.exit(99);
};

// catch uncaught exceptions, trace, then exit normally
process.on("uncaughtException", onCrash);
process.on("SIGABRT", onCrash);
