const fs = require("fs");
const path = require("path");
const readline = require("readline");

const isWhitespaceOnly = /^\s*$/;
const filePath = path.join(__dirname, "..", "data", "reittimuoto.dat");
const bufferPath = `${filePath}.tmp`;

let previous;
let index = 1;
let count = 0;

const outStream = fs.createWriteStream(bufferPath);
const lineReader = readline.createInterface({ input: fs.createReadStream(filePath) });

lineReader.on("line", (line) => {
  if (isWhitespaceOnly.test(line)) {
    return;
  }

  const lineId = line.substr(0, 24);
  index = (lineId === previous) ? (index + 1) : 1;
  const indexPadded = `${"0".repeat(4 - index.toString().length)}${index}`;
  const lineIndexed = `${line.substr(0, 32)}${indexPadded}${line.slice(36)}`;
  outStream.write(`${lineIndexed}\r\n`);

  if (line !== lineIndexed) {
    count += 1;
  }
  previous = lineId;
});

lineReader.on("close", () => {
  outStream.end();
  fs.rename(bufferPath, filePath, (error) => {
    if (error) {
      console.error(error);
      process.exit(1);
    }
    console.log(`Replaced ${count} invalid indexes`);
  });
});
