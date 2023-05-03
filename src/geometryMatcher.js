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
const ONE_HOUR = 60 * 60 * 1000; /*/ ms */
const PBF_UPDATE_INTERVAL = 24 * ONE_HOUR;
const PBF_DOWNLOAD_MAX_RETRIES = 3;
const PBF_MIN_SIZE = 30000000; // Minimum size of pbf file in bytes. Should usually be about 60-70 Mb

export const runGeometryMatcher = async (schema = SCHEMA) => {
  return new Promise(async (resolve, reject) => {
    console.log("Starting geometry match process.");
    const startTime = process.hrtime();
    let lastError = null;

    await fs.ensureDir(downloadDir);
    const filePath = path.join(downloadDir, PBF_FILENAME);
    const fileExists = await fs.pathExists(filePath);

    const modifiedLessThanDurationAgo = (durationMs) => {
      const lastModified = fs.statSync(filePath, (err) => {
        if (err) throw err;
      }).mtimeMs;
      return new Date().getTime() - durationMs > lastModified;
    };

    if (!fileExists || modifiedLessThanDurationAgo(PBF_UPDATE_INTERVAL)) {
      console.log(
        `PBF data does not exist or is older than ${PBF_UPDATE_INTERVAL /
          3600000} hours. Downloading new PBF data...`,
      );

      let retries = 0
      while (retries < PBF_DOWNLOAD_MAX_RETRIES) {
        await download(PBF_DOWNLOAD_URL, filePath).catch((err) =>
          console.log(`Downloading PBF data failed...${err}`),
        );

        if (fs.existsSync(filePath) && fs.statSync(filePath).size >= PBF_MIN_SIZE) {
          console.log("PBF file successfully downloaded.")
          break;
        }
        retries++;
        try {
          fs.unlinkSync(filePath);
        } catch {
          // Just removing bad file. Ignore possible errors...
        }
        console.log("Problem on PBF download! Retrying...")
      }

      // Last check for file
      if (!fs.existsSync(filePath) || fs.statSync(filePath).size <= PBF_MIN_SIZE) {
        reject(new Error("Couldn't download a valid PDF file..."));
        return; // Break the execution, because the OSM data is invalid!
      }

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

    // Be aware that stderr and stdout of the subprocess have some latency!
    // The exact error might not be there where the logs have been stopped, but a bit further.
    matcherProcess.stderr.on("data", (data) => {
      lastError = data.toString("utf8");
      console.log("Matcher error:", lastError);
    });

    matcherProcess.stdout.on("data", (data) => {
      console.log("Matcher output:", data.toString("utf8"));
    });

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
