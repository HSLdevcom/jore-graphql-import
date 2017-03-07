const fs = require("fs");
var path = require("path");
var readline = require("readline");
var iconv = require("iconv-lite");

const whitespaceTest = /^\s+$/;

function parseLine(line, fields) {
  const stop = {};
  let index = 1;
  fields.forEach(({ length, name, type }) => {
    if (name) {
      const value = line.substring(index, index + length).trim();
      if (type === "decimal") {
        stop[name] = parseFloat(value);
      } else if (type === "date") {
        if (value.length !== 8) {
          console.log(line);
        }
        stop[
          name
        ] = `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}`;
      } else {
        stop[name] = value;
      }
    }
    index = index + length;
  });
  return stop;
}

function parseDat(filename, fields, knex, tableName, trx) {
  let i = 0;
  const promises = []
  let results = []

  return new Promise(resolve => {
    const lineReader = readline.createInterface({
      input: fs
        .createReadStream(filename)
        .pipe(iconv.decodeStream("ISO-8859-15"))
    });

    lineReader.on("line", line => {
      if (!whitespaceTest.test(line)) {
        results.push(parseLine(line, fields))
        if (++i % 2000 === 0) {
          promises.push(knex(tableName).transacting(trx).insert(results));
          results = []
          console.log(`${filename} ${i}`);
        }
      }
    });

    lineReader.on("close", line => {
      promises.push(knex(tableName).transacting(trx).insert(results));
      console.log(`${filename} ${i}`);
      resolve(Promise.all(promises));
    });
  });
}

module.exports = parseDat;
