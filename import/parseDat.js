const fs = require("fs");
var path = require("path");
var readline = require("readline");
var iconv = require("iconv-lite");

const whitespaceTest = /^\s+$/;

function parseLine(line, fields, knex, st) {
  const stop = {};
  let index = 1;
  fields.forEach(({ length, name, type }) => {
    if (name) {
      const value = line.substring(index, index + length).trim();
      if (value.length === 0 ) {
        stop[name] = null
      } else if (type === "decimal") {
        stop[name] = parseFloat(value);
      } else if (type === "integer") {
        stop[name] = parseInt(value, 10);
        if (Number.isNaN(stop[name])) {
          console.log(name)
          console.log(line);
        }
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
  if (stop.lat && stop.lon) {
    stop.point = st.geomFromText(`Point(${stop.lon} ${stop.lat})`, 4326)
  }
  if (stop.x && stop.y) {
    stop.point = knex.raw(`ST_Transform(ST_GeomFromText('Point(${stop.x} ${stop.y})',2392),4326)`)
  }
  return stop;
}

function parseDat(filename, fields, knex, tableName, trx, st) {
  let i = 0;
  let results = []

  return new Promise(resolve => {
    const lineReader = readline.createInterface({
      input: fs
        .createReadStream(filename)
        .pipe(iconv.decodeStream("ISO-8859-15"))
    });

    lineReader.on("line", line => {
      if (!whitespaceTest.test(line)) {
        results.push(parseLine(line, fields, knex, st))
        if (++i % 2000 === 0) {
          lineReader.pause()
          knex
            .withSchema('jore')
            .transacting(trx)
            .insert(results)
            .into(tableName)
            .then(() => lineReader.resume());
          results = []
          if (i % 10000 === 0) console.log(`${filename} ${i}`);
        }
      }
    });

    lineReader.on("close", line => {
      console.log(`${filename} ${i}`);
      console.log("loaded " + tableName);
      resolve(knex.withSchema('jore').transacting(trx).insert(results).into(tableName));
    });
  });
}

module.exports = parseDat;
