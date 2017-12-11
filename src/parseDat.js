const fs = require("fs");
const readline = require("readline");

const isWhitespaceOnly = /^\s*$/;

function parseLine(line, fields, knex, st) {
  const values = {};
  let index = 1;
  fields.forEach(({ length, name, type }) => {
    if (name) {
      const value = line.substring(index, index + length).trim();
      if (value.length === 0) {
        values[name] = null;
      } else if (type === "decimal") {
        values[name] = parseFloat(value);
        if (Number.isNaN(values[name])) {
          throw new Error(`Failed to parse value for field ${name}. Line:\n${line}`);
        }
      } else if (type === "integer") {
        values[name] = parseInt(value, 10);
        if (Number.isNaN(values[name])) {
          throw new Error(`Failed to parse value for field ${name}. Line:\n${line}`);
        }
      } else if (type === "date") {
        if (value.length !== 8) {
          throw new Error(`Invalid value ${value} for field ${name}. Line:\n${line}`);
        }
        values[name] = `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}`;
      } else {
        values[name] = value;
      }
    }
    index += length;
  });
  if (values.lat && values.lon) {
    values.point = st.geomFromText(`Point(${values.lon} ${values.lat})`, 4326);
  }
  if (values.x && values.y) {
    values.point = knex.raw(`ST_Transform(ST_GeomFromText('Point(${values.x} ${values.y})',2392),4326)`);
  }
  return values;
}

function parseDat(filename, fields, knex, tableName, trx, st) {
  const insertLines = async (lines) => {
    console.log(`Inserting ${lines.length} lines from ${filename} to ${tableName}`);
    await knex.withSchema("jore").transacting(trx).insert(lines).into(tableName);
  };

  return new Promise((resolve, reject) => {
    const lines = [];
    const lineReader = readline.createInterface({ input: fs.createReadStream(filename) });

    lineReader.on("line", async (line) => {
      try {
        if (!isWhitespaceOnly.test(line)) {
          lines.push(parseLine(line, fields, knex, st));
        }
        if (lines.length >= 2000) {
          lineReader.pause();
          await insertLines(lines.splice(0));
          lineReader.resume();
        }
      } catch (error) {
        reject(error);
      }
    });

    lineReader.on("close", async () => {
      try {
        await insertLines(lines);
        resolve();
      } catch (error) {
        reject(error);
      }
    });
  });
}

module.exports = parseDat;
