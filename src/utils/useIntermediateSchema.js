import { SCHEMA, INTERMEDIATE_SCHEMA } from "../constants";

export function useIntermediateSchema(sqlString) {
  return sqlString.replace(
    new RegExp(`(${SCHEMA})(?=[.,"\\s;])`, "g"),
    INTERMEDIATE_SCHEMA,
  );
}
