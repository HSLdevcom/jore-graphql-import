import { AZURE_STORAGE_ACCOUNT, AZURE_STORAGE_KEY } from "../constants";
import { SharedKeyCredential, BlobServiceClient } from "@azure/storage-blob";
import path from "path";
import fs from "fs-extra";

export const uploadDbDump = async (filePath) => {
  // Enter your storage account name and shared key
  const account = AZURE_STORAGE_ACCOUNT;
  const accountKey = AZURE_STORAGE_KEY;

  const fileExists = await fs.pathExists(filePath);

  if (!fileExists) {
    console.log("No file to upload. Exiting.");
    return false;
  }

  console.log(`Uploading DB dump ${filePath} to Azure.`);
  const fileStat = await fs.stat(filePath);

  const FOUR_MEGABYTES = 4 * 1024 * 1024;
  const getFileStream = () =>
    fs.createReadStream(filePath, { highWaterMark: FOUR_MEGABYTES });

  // Use SharedKeyCredential with storage account and account key
  // SharedKeyCredential is only available in Node.js runtime, not in browsers
  const sharedKeyCredential = new SharedKeyCredential(account, accountKey);
  const blobServiceClient = new BlobServiceClient(
    `https://${account}.blob.core.windows.net`,
    sharedKeyCredential,
  );

  const containerName = "joredumps";
  const containerClient = blobServiceClient.getContainerClient(containerName);

  const blobName = path.basename(filePath);
  const blobClient = containerClient.getBlobClient(blobName).getBlockBlobClient();

  try {
    await blobClient.upload(getFileStream, fileStat.size);
  } catch (err) {
    console.log("Dump upload unsuccessful.");
    console.error(err);
    return false;
  }

  console.log("Dump upload successful.");
  return true;
};
