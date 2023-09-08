import { SCHEMA, INTERMEDIATE_SCHEMA } from "../constants.js";

export function useIntermediateSchema(sqlString) {
  return sqlString.replace(
    new RegExp(`(${SCHEMA})(?=[.,"\\s;])`, "g"),
    INTERMEDIATE_SCHEMA,
  );
}
