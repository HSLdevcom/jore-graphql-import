const fs = require("fs")
const path = require("path");
const _ = require("lodash");

const knex = require("knex")({
  dialect: "postgres",
  client: "pg",
  connection: process.env.PG_CONNECTION_STRING
});

// install postgis functions in knex.postgis;
const st = require("knex-postgis")(knex);

const parseDat = require("./parseDat");
const tables = require('./schema');

const createSchemaSQL = fs.readFileSync(path.join(__dirname, "createSchema.sql"), "utf8");
const createFunctionsSQL = fs.readFileSync(path.join(__dirname, "createFunctions.sql"), "utf8");
const createGeometrySQL = fs.readFileSync(path.join(__dirname, "createGeometry.sql"), "utf8");

const sourcePath = filename => path.join(__dirname, "..", "data", filename);

function createTables(schema) {
  Object.entries(tables).forEach(function([tableName, { fields }]) {
    schema = schema.createTable(tableName, function(table) {
      fields.forEach(function({
        length,
        name,
        type,
        unique,
        primary,
        index,
        foreign,
        typeOptions
      }) {
        if (name && type) {
          let column;
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
        }
      });
      if (
        (_.find(fields, { name: "lat" }) && _.find(fields, { name: "lon" })) ||
        (_.find(fields, { name: "x" }) && _.find(fields, { name: "y" }))
      ) {
        table.specificType("point", "geometry(point, 4326)");
        table.index("point", `${tableName}_points_gix`, "GIST")
      }
    });
  });

  return schema;
}

function createForeignKeys(schema) {
  Object.entries(tables).forEach(function([tableName, { fields, primary }]) {
    schema = schema.table(tableName, function(table) {
      if (primary) {
        table.unique(primary).primary(primary)
      }
      fields.forEach(function({ name, type, foreign }) {
        if (name && type && foreign) {
          table
            .foreign(name)
            .references(foreign.split(".")[1])
            .inTable("jore." + foreign.split(".")[0]);
        }
      });
    });
  });

  return schema;
}

knex.transaction(async function(trx) {
  function loadTable(tableName) {
    return parseDat(
      sourcePath(tables[tableName].filename),
      tables[tableName].fields,
      knex,
      tableName,
      trx,
      st
    );
  }

  await trx.raw(createSchemaSQL)
  await createTables(trx.schema.withSchema("jore"))
  await createForeignKeys(trx.schema.withSchema("jore"))
  await trx.raw(createFunctionsSQL)
  await loadTable("terminal")
  await loadTable("stop_area")
  await loadTable("stop")
  await loadTable("terminal_group")
  await loadTable("line")
  await loadTable("route")
  await loadTable("route_segment")
  await loadTable("point_geometry")
  await loadTable("departure")
  await loadTable("note")
  await trx.raw(createGeometrySQL)
}).then(() => {
  return knex.destroy();
}).catch((err) => {
  console.error(err);
  process.exit(1);
});
