/* eslint-disable consistent-return */
import express from "express";
import fileUpload from "express-fileupload";
import basicAuth from "express-basic-auth";
import { createEngine } from "express-react-views";
import path from "path";
import fs from "fs-extra";
import { rateLimit } from "express-rate-limit";

import { ADMIN_USER, ADMIN_PASSWORD, PATH_PREFIX, SERVER_PORT, SCHEMA } from "./constants.js";
import { getLatestImportedFile } from "./importStatus.js";
import { getSelectedTableStatus, setTableOption } from "./selectedTables.js";
import { runScheduledImportNow } from "./schedule.js";
import { importFile } from "./import.js";
import { runGeometryMatcher } from "./geometryMatcher.js";
import { createForeignKeys } from "./setup/createDb.js";
import schema from "./schema.js";
import { getKnex } from "./knex.js";
import { createDbDump } from "./utils/createDbDump.js";
import { uploadDbDump } from "./utils/uploadDbDump.js";

const cwd = process.cwd();
const uploadPath = path.join(cwd, "uploads");

export const server = (isImporting, onBeforeImport, onAfterImport) => {
  const app = express();

  const limiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    limit: 100,
    standardHeaders: "draft-8",
    legacyHeaders: false,
  });

  // Define health endpoint here so it won't be under basic auth
  app.get("/health", async (req, res) => {
    res.send("OK");
  });

  let manualDumpInProgress = false;

  app.use(
    fileUpload({
      useTempFiles: true,
      safeFileNames: true,
      preserveExtension: true,
    }),
  );

  app.use(express.urlencoded({ extended: true }));

  app.use(limiter);

  const loginAuthorizer = (user, passwd) => {
    const userMatches = basicAuth.safeCompare(user, ADMIN_USER);
    const passwordMatches = basicAuth.safeCompare(passwd, ADMIN_PASSWORD);
    return userMatches & passwordMatches;
  };

  app.use(
    basicAuth({
      challenge: true,
      authorizer: loginAuthorizer,
    }),
  );

  app.engine("jsx", createEngine());
  app.set("view engine", "jsx");
  app.set("views", new URL("views", import.meta.url).pathname);

  app.get("/", async (req, res) => {
    const latestImportedFile = await getLatestImportedFile();

    res.render("admin", {
      manualDumpInProgress,
      isImporting: isImporting(),
      latestImportedFile,
      selectedTables: getSelectedTableStatus(),
      PATH_PREFIX,
    });
  });

  app.post("/run-daily", (req, res) => {
    runScheduledImportNow("daily");
    res.redirect(PATH_PREFIX);
  });

  app.post("/create-foreign-keys", async (req, res) => {
    const { knex } = getKnex();

    try {
      await createForeignKeys(SCHEMA, schema, knex);
    } catch (e) {
      console.log(`Error creating foreign keys: ${e}`);
    }
    res.redirect(PATH_PREFIX);
  });

  app.post("/run-geometry-matcher", async (req, res) => {
    await runGeometryMatcher().catch((err) => console.error(err));
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
      new URL("setup/createFunctions.sql", import.meta.url),
      "utf8",
    );

    await knex.raw(createFunctionsSQL);
    res.redirect(PATH_PREFIX);
  });

  app.listen(SERVER_PORT, () => {
    console.log(`Server is listening on port ${SERVER_PORT}`);
  });
};
