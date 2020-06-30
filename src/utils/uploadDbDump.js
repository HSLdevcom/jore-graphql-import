import {
  AZURE_STORAGE_ACCOUNT,
  AZURE_STORAGE_KEY,
  AZURE_UPLOAD_CONTAINER,
} from "../constants";
import { SharedKeyCredential, BlobServiceClient } from "@azure/storage-blob";
import { reportInfo, reportError } from "../monitor";
import path from "path";
import fs from "fs-extra";

export const uploadDbDump = async (filePath) => {
  const account = AZURE_STORAGE_ACCOUNT;
  const accountKey = AZURE_STORAGE_KEY;
  const containerName = AZURE_UPLOAD_CONTAINER;

  if (!account || !accountKey) {
    console.log(
      "Azure credentials not set. Set the AZURE_STORAGE_ACCOUNT and AZURE_STORAGE_KEY env variables.",
    );
    return false;
  }

  const fileExists = await fs.pathExists(filePath);

  if (!fileExists) {
    console.log("No file to upload. Exiting.");
    return false;
  }

  console.log(`Uploading DB dump ${filePath} to Azure.`);
  const fileStat = await fs.stat(filePath);

  const getFileStream = () => fs.createReadStream(filePath);

  const sharedKeyCredential = new SharedKeyCredential(account, accountKey);
  const blobServiceClient = new BlobServiceClient(
    `https://${account}.blob.core.windows.net`,
    sharedKeyCredential,
  );

  const containerClient = blobServiceClient.getContainerClient(containerName);

  const blobName = path.basename(filePath);
  const blobClient = containerClient.getBlobClient(blobName).getBlockBlobClient();

  try {
    await blobClient.upload(getFileStream, fileStat.size);
  } catch (err) {
    console.log("Dump upload unsuccessful.");
    console.error(err);
    await reportError(`Dump upload unsuccessful. Error: ${err}`);
    return false;
  }

  console.log("Dump upload successful.");
  await reportInfo(`Dump upload successful.`);
  return true;
};
