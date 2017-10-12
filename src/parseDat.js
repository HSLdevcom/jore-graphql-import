const fs = require("fs");
const readline = require("readline");
const iconv = require("iconv-lite");

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
      } else if (type === "integer") {
        values[name] = parseInt(value, 10);
        if (Number.isNaN(values[name])) {
          console.error(`Found NaN value for ${name}. Line:`);
          console.error(line);
        }
      } else if (type === "date") {
        if (value.length !== 8) {
          console.error("Date length not 8. Line:");
          console.error(line);
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
  let results = [];

  return new Promise((resolve, reject) => {
    const lineReader = readline.createInterface({
      input: fs
        .createReadStream(filename)
        .pipe(iconv.decodeStream("ISO-8859-1")),
    });

    lineReader.on("line", (line) => {
      if (!isWhitespaceOnly.test(line)) {
        results.push(parseLine(line, fields, knex, st));

        if (results.length % 2000 === 0) {
          lineReader.pause();
          console.log(`Inserting ${results.length} lines from ${filename} to ${tableName}`);
          knex
            .withSchema("jore")
            .transacting(trx)
            .insert(results)
            .into(tableName)
            .then(() => {
              lineReader.resume();
            })
            .catch((error) => {
              reject(error);
            });
          results = [];
        }
      }
    });

    lineReader.on("close", () => {
      console.log(`Inserting ${results.length} lines from ${filename} to ${tableName}`);
      knex
        .withSchema("jore")
        .transacting(trx)
        .insert(results)
        .into(tableName)
        .then((result) => {
          resolve(result);
        })
        .catch((error) => {
          reject(error);
        });
    });
  });
}

module.exports = parseDat;
