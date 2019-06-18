import schema from "./schema";
import { parseLine } from "./parseLine";
import { map, collect } from "etl";
import throughConcurrent from "through2-concurrent";
import { upsert } from "./utils/upsert";
import { getIndexForTable } from "./utils/getIndexForTable";
import { createPrimaryKey } from "./utils/createPrimaryKey";
import { uniqBy } from "lodash";
import { getPrimaryConstraint } from "./utils/getPrimaryConstraint";
import { getKnex } from "./knex";

const { knex } = getKnex();
const NS_PER_SEC = 1e9;

const createImportQuery = (insertOptions) =>
  new Promise(async (resolve, reject) => {
    const time = process.hrtime();

    try {
      await knex.transaction((trx) => upsert({ ...insertOptions, trx }));
      resolve(time);
    } catch (err) {
      reject(err);
    }
  });

const createLineParser = (tableName) => {
  const { fields, lineSchema = fields } = schema[tableName] || {};
  let linesReceived = false;

  return throughConcurrent.obj({ maxConcurrency: 100 }, (line, enc, cb) => {
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

export const createImportStreamForTable = async (tableName, queue) => {
  const lineParser = createLineParser(tableName);
  const primaryKeys = getIndexForTable(tableName);
  const constraint = await getPrimaryConstraint(tableName);

  lineParser.pipe(collect(1000, 250)).pipe(
    map((itemData) => {
      let insertItems = itemData;

      if (primaryKeys.length !== 0) {
        insertItems = uniqBy(itemData, (item) => createPrimaryKey(item, primaryKeys));
      }

      queue.add(() =>
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
    }),
  );

  return lineParser;
};
