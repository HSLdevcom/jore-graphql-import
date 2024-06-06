import childProcess from "child_process";
import { StorageSharedKeyCredential, BlobServiceClient } from "@azure/storage-blob";
import path from "path";
import fs from "fs-extra";
import pgConnectionString from "pg-connection-string";
import {
  PG_CONNECTION_STRING,
  AZURE_STORAGE_KEY,
  AZURE_STORAGE_ACCOUNT,
  AZURE_UPLOAD_CONTAINER,
  DEFAULT_DATABASE
} from "../constants.js";
import { clearDb } from "../setup/clearDb.js";
import { deleteFiles } from "./createDbDump.js";

const { parse } = pgConnectionString;

const cwd = process.cwd();

export const downloadDump = async () => {
  const account = AZURE_STORAGE_ACCOUNT;
  const accountKey = AZURE_STORAGE_KEY;
  const containerName = AZURE_UPLOAD_CONTAINER;

  const sharedKeyCredential = new StorageSharedKeyCredential(account, accountKey);
  const blobServiceClient = new BlobServiceClient(
    `https://${account}.blob.core.windows.net`,
    sharedKeyCredential,
  );

  const containerClient = blobServiceClient.getContainerClient(containerName);

  let latestDump = null;
  for await (const blob of containerClient.listBlobsFlat()) {
    const blobName = blob.name;
    if (blobName.includes("dump")) {
      const blobDate = blob.properties.lastModified;
      if (!latestDump || latestDump.properties.lastModified < blobDate) {
        latestDump = blob;
      }
    }
  }

  if (!latestDump) {
    console.log("No dump file found.");
    throw new Error("No dump file found");
  }

  try {
    const latestDumpName = latestDump.name;
    const blobClient = await containerClient.getBlobClient(latestDumpName);
    const dumpsDir = path.join(cwd, "restore");
    await fs.ensureDir(dumpsDir);
    await blobClient.downloadToFile(`${dumpsDir}/${latestDumpName}`);
    console.log(`Download of ${latestDumpName} success`);
    return latestDumpName;
  } catch (e) {
    console.log(e);
    return null;
  }
};

export const importDbDump = async () => {
  console.log("Importing DB dump");
  const dumpName = await downloadDump();
  return new Promise(async (resolve, reject) => {
    console.log("Clearing DB");
    await clearDb(true);

    const startTime = process.hrtime();
    let lastError = null;
    const dumpsDir = path.join(cwd, "restore");
    await fs.ensureDir(dumpsDir);
    const filePath = path.join(dumpsDir, dumpName);
    const fileExists = await fs.pathExists(filePath);

    if (fileExists) {
      const pgConnection = parse(PG_CONNECTION_STRING);
      const database = pgConnection.database ? pgConnection.database : DEFAULT_DATABASE;
      console.log(`Restoring db with ${filePath}`);

      const dumpProcess = childProcess.spawn(
        "pg_restore",
        [
          "-c",
          "--if-exists",
          "--drop-cascade",
          "--no-owner",
          `-U ${pgConnection.user}`,
          `-d ${database}`,
          "--single-transaction",
          `${filePath}`,
        ],
        {
          cwd,
          shell: true,
          env: {
            PGUSER: pgConnection.user,
            PGPASSWORD: pgConnection.password,
            PGHOST: pgConnection.host,
            PGPORT: pgConnection.port,
            PGDATABASE: database,
          },
        },
      );

      dumpProcess.stderr.on("data", (data) => {
        deleteFiles({ filesDir: dumpsDir, minFileCount: 0 });
        lastError = data.toString("utf8");
        console.log("Dump error:", lastError);
        return lastError;
      });

      dumpProcess.on("close", (code) => {
        const [execDuration] = process.hrtime(startTime);
        deleteFiles({ filesDir: dumpsDir, minFileCount: 0 });
        if (code !== 0) {
          console.log(`DB dump import failed after ${execDuration} seconds.`);
          reject(lastError);
        } else {
          console.log(`DB dump import finished successfully in ${execDuration} seconds.`);
          resolve(filePath);
        }
      });
    }
  });
};
