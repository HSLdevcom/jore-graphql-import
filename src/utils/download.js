import http from "http";
import fs from "fs-extra";

export const download = (url, dest) => {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    http
      .get(url, (response) => {
        response.pipe(file);
        file.on("finish", () => {
          file.close(resolve); // close() is async, call cb after close completes.
        });
      })
      .on("error", (err) => {
        // Handle errors
        fs.unlinkSync(dest); // Delete the file async. (But we don't check the result)
        reject(err);
      });
  });
};
