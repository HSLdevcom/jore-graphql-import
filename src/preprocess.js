/* eslint-disable no-await-in-loop */
const fs = require("fs");
const path = require("path");
const readline = require("readline");
const schema = require("./schema");

const isWhitespaceOnly = /^\s*$/;

function processLines(filename, callback) {
  return new Promise((resolve, reject) => {
    const filePath = path.join(__dirname, "..", "data", filename);
    const tempPath = `${filePath}.tmp`;

    const lineReader = readline.createInterface({ input: fs.createReadStream(filePath) });
    const outStream = fs.createWriteStream(tempPath);

    lineReader.on("line", (line) => {
      if (!isWhitespaceOnly.test(line)) {
        callback(line, outStream);
      }
    });

    lineReader.on("close", () => {
      outStream.end();
      fs.rename(tempPath, filePath, error => (error ? reject(error) : resolve()));
    });
  });
}

function readLineLength(filename) {
  return new Promise((resolve) => {
    let maxLength = 0;
    const filePath = path.join(__dirname, "..", "data", filename);
    const lineReader = readline.createInterface({ input: fs.createReadStream(filePath) });

    lineReader.on("line", (line) => {
      if (line.length > maxLength) maxLength = line.length;
    });
    lineReader.on("close", () => {
      resolve(maxLength);
    });
  });
}

async function replaceLinebreaks() {
  const filenames = Object.values(schema)
    .map(table => table.filename)
    .filter(filename => !!filename);

  for (let i = 0; i < filenames.length; i += 1) {
    const lineLength = await readLineLength(filenames[i]);

    let lines = [];
    const callback = (line, stream) => {
      lines = [...lines, line];
      const currentLength = lines.join("\r\n").length;

      if (currentLength > lineLength) {
        throw new Error(`Failed to replace linebreak(s):\n${lines.join("\n")}`);
      }
      if (currentLength === lineLength) {
        const output = lines.join("  ");
        stream.write(`${output}\n`);
        if (lines.length > 1) console.log(`Replaced linebreak(s):\n${output}`);
        lines = [];
      }
    };

    await processLines(filenames[i], callback);
  }
}

async function replaceGeometryIndexes() {
  let index = 1;
  let previous;

  const callback = (line, stream) => {
    const lineId = line.substr(0, 24);
    index = (lineId === previous) ? (index + 1) : 1;
    const indexPadded = `${"0".repeat(4 - index.toString().length)}${index}`;
    const lineIndexed = `${line.substr(0, 32)}${indexPadded}${line.slice(36)}`;
    stream.write(`${lineIndexed}\r\n`);

    if (line !== lineIndexed) {
      console.log(`Replaced invalid geometry index: ${lineId}`);
    }
    previous = lineId;
  };

  await processLines("reittimuoto.dat", callback);
}

replaceLinebreaks()
  .then(() => replaceGeometryIndexes())
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
