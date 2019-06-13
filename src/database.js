import schema from "./schema";
import { getKnex } from "./knex";
import { parseLine } from "./parseLine";
import { map, collect } from "etl";
import throughConcurrent from "through2-concurrent";

const { knex } = getKnex();
const SCHEMA = "jore";

const queueQuery = (queue, queryPromise) => {
  queue.push(queryPromise);
};

const createInsertQuery = (tableName, data, onBeforeQuery) =>
  new Promise((resolve, reject) => {
    onBeforeQuery();
    const tableId = `${SCHEMA}.${tableName}`;

    knex
      .transaction((trx) => knex.batchInsert(tableId, data, 1000).transacting(trx))
      .then(resolve)
      .catch(reject);
  });

const createLineParser = (tableName) => {
  const { fields, lineSchema = fields } = schema[tableName] || {};
  let linesReceived = false;

  return throughConcurrent.obj({ maxConcurrency: 50 }, (line, enc, cb) => {
    if (!line) {
      // line === null marks the end of the file. End the import stream
      // to flush any items left in the collect buffer.
      return cb(null, null);
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
        const parsedLine = parseLine(line, lineSchema);
        // Write the line to the relevant import stream.
        return cb(null, parsedLine);
      } catch (err) {
        return cb(err);
      }
    }

    return cb();
  });
};

export const createImportStreamForTable = (tableName, queue) => {
  const lineParser = createLineParser(tableName);
  let chunkIndex = 0;

  lineParser.pipe(collect(1000, 500)).pipe(
    map((itemData) =>
      queueQuery(
        queue,
        createInsertQuery(tableName, itemData, () => {
          console.log(
            `${chunkIndex}. Importing ${itemData.length} lines to ${tableName}`,
          );
          chunkIndex++;
        }),
      ),
    ),
  );

  return lineParser;
};
