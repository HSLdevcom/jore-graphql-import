import { find, compact } from "lodash";
import pMap from "p-map";
import { INTERMEDIATE_SCHEMA } from "../constants";

export async function createTables(schema, config, knex) {
  const createdTables = await pMap(
    Object.entries(config),
    async ([tableName, { fields }]) => {
      const tableExists = await knex.schema.withSchema(schema).hasTable(tableName);

      if (tableExists) {
        return "";
      }

      await knex.schema.withSchema(schema).createTable(tableName, (table) => {
        fields.forEach(
          ({
            length,
            name,
            type,
            unique,
            primary,
            index,
            typeOptions,
            notNullable,
            defaultTo,
          }) => {
            if (name && type) {
              let column; // eslint-disable-line no-unused-vars
              if (type === "string") {
                column = table.string(name, length);
              } else if (type === "decimal") {
                column = table.decimal(name, 9, 6);
              } else {
                column = table[type](name, typeOptions);
              }
              if (primary) {
                if (Array.isArray(primary)) {
                  column = column.primary(primary);
                } else {
                  column = column.primary();
                }
              }
              if (unique) {
                column = column.unique();
              }
              if (index) {
                column = column.index();
              }
              if (notNullable) {
                column = column.notNullable();
              }
              if (defaultTo) {
                column = column.defaultTo(defaultTo);
              }
            }
          },
        );
        if (
          (find(fields, { name: "lat" }) && find(fields, { name: "lon" })) ||
          (find(fields, { name: "x" }) && find(fields, { name: "y" }))
        ) {
          table.specificType("point", "geometry(point, 4326)");
          table.index("point", `${tableName}_points_gix`, "GIST");
        }

        table.timestamp("date_imported").defaultTo(knex.fn.now());
      });

      return tableName;
    },
  );

  return compact(createdTables);
}

export async function createPrimaryKeys(schema, config, knex) {
  return pMap(Object.entries(config), ([tableName, { primary }]) => {
    return knex.schema.withSchema(schema).table(tableName, (table) => {
      if (primary) {
        table.unique(primary).primary(primary);
      }
    });
  });
}

export async function createForeignKeys(schema, config, knex) {
  return pMap(Object.entries(config), ([tableName, { fields }]) => {
    return knex.schema.withSchema(schema).table(tableName, (table) => {
      fields.forEach(({ name, type, foreign }) => {
        if (name && type && foreign) {
          table
            .foreign(name)
            .references(foreign.split(".")[1])
            .inTable(`${schema}.${foreign.split(".")[0]}`);
        }
      });
    });
  });
}
