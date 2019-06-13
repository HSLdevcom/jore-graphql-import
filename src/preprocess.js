import throughConcurrent from "through2-concurrent";

const isWhitespaceOnly = /^\s*$/;

function createLinebreaksReplacer() {
  let lines = [];

  return (line, lineLength) => {
    lines.push(line);

    const currentLength = lines.join("\n").length;
    let output = "";

    if (currentLength > lineLength) {
      output = `${lines.join("\n")}\n`;
      console.log(`Did not replace linebreak(s):\n${output}`);
      lines = [];
    }
    if (currentLength === lineLength) {
      output = `${lines.join("  ")}\n`;
      if (lines.length > 1) console.log(`Replaced linebreak(s):\n${output}`);
      lines = [];
    }

    return output;
  };
}

function replaceGeometryIndexes() {
  let index = 1;
  let previous;

  return (line) => {
    const lineId = line.substr(0, 24);
    index = lineId === previous ? index + 1 : 1;
    const indexPadded = `${"0".repeat(4 - index.toString().length)}${index}`;
    const lineIndexed = `${line.substr(0, 32)}${indexPadded}${line.slice(36)}`;

    if (index === 1 && line !== lineIndexed) {
      console.log("Replacing geometry indices...");
    }

    previous = lineId;
    return lineIndexed;
  };
}

export function processLine(tableName) {
  const geometryReplacer = replaceGeometryIndexes();
  const lineBreaksReplacer = createLinebreaksReplacer();

  let maxLength = 0;

  return throughConcurrent.obj({ maxConcurrency: 50 }, function createLine(
    chunk,
    enc,
    cb,
  ) {
    const str = enc === "buffer" ? chunk.toString("utf8") : chunk;

    if (str && !isWhitespaceOnly.test(str)) {
      if (str.length > maxLength) {
        maxLength = str.length;
      }

      const linebreaksReplacedStr = lineBreaksReplacer(str, maxLength);

      if (linebreaksReplacedStr) {
        let resultLine = linebreaksReplacedStr;

        if (tableName === "point_geometry") {
          resultLine = geometryReplacer(linebreaksReplacedStr);
        }

        this.push(resultLine);
      }
    }

    cb();
  });
}
