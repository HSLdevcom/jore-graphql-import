import { Client } from "basic-ftp/dist/index";
import { orderBy, get } from "lodash";
import path from "path";
import fs from "fs-extra";
import { getLatestImportedFile } from "../importStatus";
import {
  FTP_USERNAME,
  FTP_PASSWORD,
  FTP_HOST,
  FTP_PORT,
  FTP_PATH,
  DEBUG,
} from "../constants";

const cwd = process.cwd();

export async function fetchExportFromFTP() {
  if (!FTP_PASSWORD || !FTP_USERNAME || !FTP_HOST) {
    return null;
  }

  let latestImported = null;

  // Skip latest file check if we're debugging.
  if (DEBUG !== "true") {
    latestImported = await getLatestImportedFile();
  }

  const client = new Client();

  await client.access({
    host: FTP_HOST,
    user: FTP_USERNAME,
    password: FTP_PASSWORD,
    port: FTP_PORT,
    secure: false,
  });

  await client.cd(FTP_PATH);
  const files = await client.list();

  const zips = files.filter(({ name }) => name.endsWith(".zip"));
  const newestFile = orderBy(zips, "name", "desc")[0];
  const newestExportName = get(newestFile, "name", "");

  if (!newestExportName) {
    return null;
  }

  console.log(`Newest export is ${newestExportName}`);
  console.log(`Latest imported export is ${get(latestImported, "filename")}`);

  // If there is no record of a previously improted file, or if the previously
  // imported file is different than the latest or if the previous import failed
  // => download and import the archive.
  if (
    !latestImported ||
    newestExportName !== get(latestImported, "filename") ||
    (!latestImported.success && latestImported.import_end !== null)
  ) {
    // The archive will be downloaded to `downloads`.
    await fs.ensureDir(path.join(cwd, "downloads"));

    const downloadPath = path.join(cwd, "downloads", newestExportName);
    const fileExists = await fs.pathExists(downloadPath);

    // Download it if it doesn't already exist. It may exist if the import
    // failed previously.
    if (!fileExists) {
      console.log(`Downloading ${newestExportName}`);
      const writeStream = fs.createWriteStream(downloadPath);
      await client.download(writeStream, newestExportName);
      client.close();
    } else {
      console.log(`Export ${newestExportName} already downloaded.`);
    }

    return downloadPath;
  }

  return null;
}
