/* eslint-disable consistent-return */
import express from "express";
import fileUpload from "express-fileupload";
import basicAuth from "express-basic-auth";
import { ADMIN_PASSWORD, PATH_PREFIX, SERVER_PORT, SCHEMA } from "./constants";
import { createEngine } from "express-react-views";
import path from "path";
import { getLatestImportedFile } from "./importStatus";
import { getSelectedTableStatus, setTableOption } from "./selectedTables";
import { runScheduledImportNow } from "./schedule";
import fs from "fs-extra";
import { importFile } from "./import";
import { runGeometryMatcher } from "./geometryMatcher";
import { createForeignKeys } from "./setup/createDb";
import schema from "./schema";
import { getKnex } from "./knex";
import { createDbDump } from "./utils/createDbDump";
import { uploadDbDump } from "./utils/uploadDbDump";

const cwd = process.cwd();
const uploadPath = path.join(cwd, "uploads");

export const server = (isImporting, onBeforeImport, onAfterImport) => {
  const app = express();

  let manualDumpInProgress = false;

  app.use(
    fileUpload({
      useTempFiles: true,
      safeFileNames: true,
      preserveExtension: true,
    }),
  );

  app.use(express.urlencoded({ extended: true }));

  app.use(
    basicAuth({
      challenge: true,
      users: { admin: ADMIN_PASSWORD },
    }),
  );

  app.engine("jsx", createEngine());
  app.set("view engine", "jsx");
  app.set("views", path.join(__dirname, "views"));

  app.get("/", async (req, res) => {
    const latestImportedFile = await getLatestImportedFile();

    res.render("admin", {
      manualDumpInProgress,
      isImporting: isImporting(),
      latestImportedFile,
      selectedTables: getSelectedTableStatus(),
    });
  });

  app.post("/run-daily", (req, res) => {
    runScheduledImportNow("daily");
    res.redirect(PATH_PREFIX);
  });

  app.post("/create-foreign-keys", async (req, res) => {
    const { knex } = getKnex();

    await createForeignKeys(SCHEMA, schema, knex);
    res.redirect(PATH_PREFIX);
  });

  app.post("/run-geometry-matcher", (req, res) => {
    runGeometryMatcher().catch((err) => console.error(err));
    res.redirect(PATH_PREFIX);
  });

  app.post("/upload", async (req, res) => {
    if (Object.keys(req.files).length === 0) {
      return res.status(400).send("No files were uploaded.");
    }

    const importId = "uploaded-file";

    // The name of the input field (i.e. "sampleFile") is used to retrieve the uploaded file
    const exportFile = req.files.export;
    const exportName = `${exportFile.name.replace(".zip", "")}-downloaded.zip`;
    const exportPath = path.join(uploadPath, exportName);

    await fs.emptyDir(uploadPath);

    // Use the mv() method to place the file somewhere on your server
    exportFile.mv(exportPath, async (err) => {
      if (err) {
        return res.status(500).send(err);
      }

      if (onBeforeImport(importId)) {
        try {
          await importFile(exportPath);
        } catch (importError) {
          console.error(importError);
        }

        onAfterImport(importId);
      }
    });

    res.redirect(PATH_PREFIX);
  });

  app.post("/select-tables", (req, res) => {
    const tableSettings = req.body;

    const enabledTables = Object.keys(tableSettings);
    const allTables = Object.keys(getSelectedTableStatus());

    for (const tableName of allTables) {
      const isEnabled = enabledTables.includes(tableName);
      setTableOption(tableName, isEnabled);
    }

    res.redirect(PATH_PREFIX);
  });

  app.post("/dump-upload", (req, res) => {
    if (!manualDumpInProgress) {
      manualDumpInProgress = true;

      createDbDump()
        .then(uploadDbDump)
        .then(() => {
          manualDumpInProgress = false;
        });
    }

    res.redirect(PATH_PREFIX);
  });

  app.post("/create-functions", async (req, res) => {
    const { knex } = getKnex();

    const createFunctionsSQL = fs.readFileSync(
      path.join(__dirname, "setup", "createFunctions.sql"),
      "utf8",
    );

    await knex.raw(createFunctionsSQL);
    res.redirect(PATH_PREFIX);
  });

  app.listen(SERVER_PORT, () => {
    console.log(`Server is listening on port ${SERVER_PORT}`);
  });
};
