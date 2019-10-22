import childProcess from "child_process";
import {
  PG_CONNECTION_STRING,
  PYTHON_CMD,
  PBF_DOWNLOAD_URL,
  PBF_FILENAME,
  SCHEMA,
} from "./constants";
import path from "path";
import fs from "fs-extra";
import { download } from "./utils/download";

const cwd = process.cwd();
const downloadDir = path.join(cwd, "downloads");

export const runGeometryMatcher = async (schema = SCHEMA) => {
  return new Promise(async (resolve, reject) => {
    console.log("Starting geometry match process.");
    const startTime = process.hrtime();
    let lastError = null;

    await fs.ensureDir(downloadDir);
    const filePath = path.join(downloadDir, PBF_FILENAME);
    const fileExists = await fs.pathExists(filePath);

    if (!fileExists) {
      console.log("Downloading PBF data...");
      await download(PBF_DOWNLOAD_URL, filePath).catch((err) => console.log('Downloading PBF data failed...' + err));
    } else {
      console.log("PBF file exists...");
    }

    console.log(`Spawning matcher process with file ${filePath}`);
    const matcherProcess = childProcess.spawn(
      PYTHON_CMD,
      ["jore_shape_mapfit.py", filePath, "+init=epsg:3067", PG_CONNECTION_STRING, schema],
      {
        cwd: path.join(__dirname, "../", "geometry-matcher"),
      },
    );

    matcherProcess.stderr.on("data", (data) => {
      lastError = data.toString("utf8");
      console.log("Matcher error:", lastError);
    });

    /*matcherProcess.stdout.on("data", (data) => {
      console.log("Matcher output:", data.toString("utf8"));
    });*/

    matcherProcess.on("close", (code) => {
      const [execDuration] = process.hrtime(startTime);

      if (code !== 0) {
        console.log(`Geometry matcher failed after running for ${execDuration} seconds.`);
        reject(lastError);
      } else {
        console.log(`Geometry matcher finished successfully in ${execDuration} seconds.`);
        resolve();
      }
    });
  });
};
