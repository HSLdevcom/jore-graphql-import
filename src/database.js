import { Transform } from "stream";

import { uniqBy } from "lodash-es";

import schema from "./schema.js";
import { parseLine } from "./parseLine.js";
import { upsert } from "./utils/upsert.js";
import { getIndexForTable } from "./utils/getIndexForTable.js";
import { createPrimaryKey } from "./utils/createPrimaryKey.js";
import { getPrimaryConstraint } from "./utils/getPrimaryConstraint.js";
import { getKnex } from "./knex.js";

const { knex } = getKnex();
const NS_PER_SEC = 1e9;

const createImportQuery = (insertOptions) =>
  new Promise((resolve, reject) => {
    const time = process.hrtime();
    knex
      .transaction((trx) => upsert({ ...insertOptions, trx }))
      .then(() => {
        resolve(time);
      })
      .catch((err) => reject(err));
  });

const hasProhibitedNulls = (parsedLine, lineSchema) => {
  let notAllowedNulls = false;
  const notNullableKeys = [];
  lineSchema.forEach((field) => {
    if (field.notNullable) {
      notNullableKeys.push(field.name);
    }
  });

  notNullableKeys.forEach((key) => {
    const value = parsedLine[key];
    if (value === null) {
      notAllowedNulls = true;
    }
  });

  return notAllowedNulls;
};

const createLineParser = (tableName) => {
  const { fields, lineSchema = fields } = schema[tableName] || {};
  let linesReceived = false;

  return new Transform({
    objectMode: true,
    transform(chunk, encoding, callback) {
      if (!chunk) {
        // line === null marks the end of the file. End the import stream
        // to flush any items left in the collect buffer.
        return callback(null, null);
      }

      if (lineSchema) {
        // This function runs on each line which would be too much to log.
        // When receiving the first line of a table, log it and mark it as logged.
        if (!linesReceived) {
          console.log(`Importing ${tableName}...`);
          linesReceived = true;
        }

        try {
          // Parse the line and return it into the stream
          const parsedLine = parseLine(chunk, lineSchema);
          const notAllowedNulls = hasProhibitedNulls(parsedLine, lineSchema);
          if (!notAllowedNulls) {
            return callback(null, parsedLine);
          }
        } catch (err) {
          return callback(err);
        }
      }

      return callback();
    },
  });
};

export const createImportStreamForTable = async (tableName, resolveFileImport, queue) => {
  const lineParser = createLineParser(tableName);
  const primaryKeys = getIndexForTable(tableName);
  const constraint = await getPrimaryConstraint(tableName);

  let rowsCache = [];
  const batchSize = 1000;

  const insertRows = async (rows) => {
    let insertItems = rows;

    // Remove duplicates, there might be some
    if (primaryKeys.length !== 0) {
      insertItems = uniqBy(insertItems, (item) => createPrimaryKey(item, primaryKeys));
    }

    // Add insert task to queue
    return queue.add(() =>
      createImportQuery({
        tableName,
        data: insertItems,
        indices: primaryKeys,
        constraint,
      }).then((time) => {
        const [execS, execNs] = process.hrtime(time);
        const ms = (execS * NS_PER_SEC + execNs) / 1000000;
        console.log(`Records of ${tableName} imported in ${ms} ms`);
      }),
    );
  };

  lineParser
    .on("data", (data) => {
      // Add to cache
      rowsCache.push(data);

      if (rowsCache.length === batchSize) {
        // Cache is full, insert
        insertRows(rowsCache);
        // Clear the cache for new rows
        rowsCache = [];
      }
    })
    .on("end", async () => {
      // Insert last rows, wait for
      insertRows(rowsCache).then(() => {
        console.log(`${tableName} imported!`);
        // The file is completed. Note that there still could be pending transactions
        // if the last insert was faster than previous ones.
        // Remember to check it with await queue.onEmpty() at some point.
        resolveFileImport();
      });
    });

  return lineParser;
};
