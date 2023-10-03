import { get, uniq } from "lodash-es";
import schema from "../schema.js";

export function getIndexForTable(tableName) {
  const tableSchema = get(schema, tableName, false);
  const compoundPrimary = get(tableSchema, "primary", []);

  const indices = get(tableSchema, "fields", []).reduceRight((indexNames, field) => {
    const name = get(field, "name", "");

    if (compoundPrimary.indexOf(name) !== -1) {
      return indexNames;
    }

    // If this field is an unique index, we're interested in it. Do not add
    // non-unique indices here.
    if (name && get(field, "primary", false)) {
      indexNames.push(name);
    }

    return indexNames;
  }, []);

  return uniq([...indices, ...compoundPrimary]);
}
