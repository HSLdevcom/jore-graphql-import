import schema from "./schema";
import { pick, compact, difference } from "lodash";

const tableNames = Object.keys(schema);
const [...argSelections] = process.argv.slice(2);

const omitNames = argSelections
  .filter((tn) => tn.startsWith("exclude:"))
  .map((tn) => tn.replace("exclude:", ""));

const pickNames = difference(
  argSelections.filter((tn) => !tn.startsWith("exclude:")),
  omitNames,
);

const selectedWithArgs =
  pickNames.length === 0
    ? tableNames.filter((tn) => !omitNames.includes(tn))
    : tableNames.filter((tn) => pickNames.includes(tn));

const selectedOptions = tableNames.reduce((tableOptions, tableName) => {
  tableOptions[tableName] = selectedWithArgs.includes(tableName);
  return tableOptions;
}, {});

export const getSelectedTables = () => {
  const selectedTables = Object.entries(selectedOptions)
    .filter(([, isSelected]) => isSelected)
    .map(([tableName]) => tableName);

  const selectedSchema =
    selectedTables.length !== 0
      ? Object.values(pick(schema, selectedTables))
      : Object.values(schema);

  const selectedFiles = compact(selectedSchema.map(({ filename }) => filename));

  return { selectedTables, selectedFiles, selectedSchema };
};

export const setTableOption = (tableName, isEnabled = true) => {
  if (tableName in selectedOptions) {
    selectedOptions[tableName] = !!isEnabled;
  }

  return selectedOptions;
};

export const getSelectedTableStatus = () => {
  return selectedOptions;
};
