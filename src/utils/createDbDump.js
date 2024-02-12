import childProcess from "child_process";
import path from "path";
import fs from "fs-extra";
import { format } from "date-fns";
import pgConnectionString from "pg-connection-string";

import { PG_CONNECTION_STRING, DEFAULT_DATABASE } from "../constants.js";

const { parse } = pgConnectionString;

const MAX_FILE_AGE = 3600000 * 24 * 14; // 14 days
const MIN_FILE_COUNT = 3;
const cwd = process.cwd();
const dumpsDir = path.join(cwd, "dumps");

export const deleteFiles = ({ filesDir, minFileCount }) => {
  fs.readdir(filesDir, (err, files) => {
    if (files.length < minFileCount) return;
    files.forEach((file) => {
      const removableFile = path.join(filesDir, file);
      fs.stat(removableFile, async (err, stat) => {
        if (err) {
          return console.error(err);
        }
        const now = new Date().getTime();
        const endTime = new Date(stat.ctime).getTime() + MAX_FILE_AGE;
        if (now > endTime) {
          return fs.remove(removableFile, async (err) => {
            if (err) {
              return console.error(err);
            }
            console.log(`Deleted ${removableFile}`);
          });
        }
      });
    });
  });
};

export const createDbDump = async () => {
  return new Promise(async (resolve, reject) => {
    console.log("Creating a DB dump");

    const startTime = process.hrtime();
    let lastError = null;

    await fs.ensureDir(dumpsDir);
    const currentDate = format(new Date(), "yyyy-MM-dd");
    const currentDateFilename = `jore_dump_${currentDate}`;
    const filePath = path.join(dumpsDir, currentDateFilename);
    const fileExists = await fs.pathExists(filePath);

    deleteFiles({ filesDir: path.join(cwd, "dumps"), minFileCount: MIN_FILE_COUNT });
    deleteFiles({ filesDir: path.join(cwd, "downloads"), minFileCount: MIN_FILE_COUNT });

    if (fileExists) {
      console.log("Dump exists, exiting.");
      resolve(filePath);
    } else {
      const pgConnection = parse(PG_CONNECTION_STRING);
      const database = pgConnection.database ? pgConnection.database : DEFAULT_DATABASE;
      console.log(`Dumping the ${database} database into ${filePath}`);
      const dumpProcess = childProcess.spawn(
        "pg_dump",
        [`-f ${filePath}`, "-Fc", "-N '*old'", "-N '*new'"],
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
        lastError = data.toString("utf8");
        console.log("Dump error:", lastError);
      });

      /*dumpProcess.stdout.on("data", (data) => {
        console.log("Dump output:", data.toString("utf8"));
      });*/

      dumpProcess.on("close", (code) => {
        const [execDuration] = process.hrtime(startTime);

        if (code !== 0) {
          console.log(`DB dump failed after ${execDuration} seconds.`);
          reject(lastError);
        } else {
          console.log(`DB dump finished successfully in ${execDuration} seconds.`);
          resolve(filePath);
        }
      });
    }
  });
};
