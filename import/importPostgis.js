const knex = require("knex")({
  dialect: "postgres",
  client: "pg",
  connection: process.env.PG_CONNECTION_STRING
});

// install postgis functions in knex.postgis;
const st = require("knex-postgis")(knex);

const _ = require("lodash");
const path = require("path");

const parseDat = require("./parseDat");

const sourcePath = filename => path.join(__dirname, "data", filename);

const tables = require('./schema');
const functions = require('./functions');

function dropTables(schema) {
  schema = schema
    .dropTableIfExists("departure")
    .dropTableIfExists("route_segment")
    .dropTableIfExists("stop")
    .dropTableIfExists("terminal")
    .dropTableIfExists("stop_area")
    .dropTableIfExists("line");

  Object.keys(tables).forEach(function(tableName) {
    schema = schema.dropTableIfExists(tableName);
  });

  return schema;
}

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
        foreign
      }) {
        if (name && type) {
          let column;
          if (type === "string") {
            column = table.string(name, length);
          } else if (type === "decimal") {
            column = table.decimal(name, 9, 6);
          } else {
            column = table[type](name);
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

function createFunctions(knex) {
  return functions.reduce((promise, f) => promise.then(() => knex.raw(f)), Promise.resolve());
}

knex.transaction(function(trx) {
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

  function loadData() {
    return loadTable("terminal")
      .then(() => loadTable("stop_area"))
      .then(() => loadTable("stop"))
      .then(() =>
        Promise.all([
          loadTable("line"),
          loadTable("route"),
          loadTable("route_segment"),
          loadTable("geometry"),
          loadTable("departure"),
          loadTable("note")
        ]));
  }

  trx.raw("drop schema if exists jore cascade")
    .then(() => trx.raw("create schema jore"))
    .then(() => createTables(trx.schema.withSchema("jore")))
    .then(() => createForeignKeys(trx.schema.withSchema("jore")))
    .then(() => createFunctions(trx))
    .then(loadData)
    .then(trx.commit)
    .then(
      res => console.log(res),
      err => {
        console.log(err);
        return trx.rollback();
      }
    )
    .then(knex.destroy);
});
