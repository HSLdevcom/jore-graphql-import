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

const SRC_PATH = "../data/src";

const sourcePath = filename => path.join(__dirname, SRC_PATH, filename);

const tables = {
  stops: {
    filename: "pysakki.dat",
    fields: [
      {
        length: 7,
        name: "stopId",
        type: "string",
        unique: true,
        primary: true,
        index: true
      },
      { length: 7 },
      { length: 7 },
      { length: 8, name: "lat", type: "decimal" },
      { length: 8, name: "lon", type: "decimal" },
      { length: 20, name: "name_fi", type: "string" },
      { length: 20, name: "name_se", type: "string" },
      { length: 20, name: "address_fi", type: "string" },
      { length: 20, name: "address_se", type: "string" },
      { length: 3, name: "platform", type: "string" },
      { length: 7 },
      { length: 7 },
      { length: 20 },
      { length: 20 },
      { length: 2 },
      { length: 6, name: "shortId", type: "string" },
      { length: 8 },
      { length: 8 },
      { length: 1 },
      { length: 15, name: "heading", type: "string" },
      { length: 1 },
      { length: 3 },
      {
        length: 7,
        name: "terminalId",
        type: "string",
        foreign: "terminals.terminalId"
      },
      {
        length: 7,
        name: "stopAreaId",
        type: "string",
        foreign: "stopareas.stopAreaId"
      }
    ]
  },
  terminals: {
    filename: "terminaali.dat",
    fields: [
      {
        length: 7,
        name: "terminalId",
        type: "string",
        unique: true,
        primary: true,
        index: true
      },
      { length: 40, name: "name_fi", type: "string" },
      { length: 40, name: "name_se", type: "string" },
      { length: 14 },
      { length: 8, name: "lat", type: "decimal" },
      { length: 8, name: "lon", type: "decimal" }
    ]
  },
  stopareas: {
    filename: "pysakkialue.dat",
    fields: [
      {
        length: 6,
        name: "stopAreaId",
        type: "string",
        unique: true,
        primary: true,
        index: true
      },
      { length: 40, name: "name_fi", type: "string" },
      { length: 40, name: "name_se", type: "string" },
      { length: 14 },
      { length: 8, name: "lat", type: "decimal" },
      { length: 8, name: "lon", type: "decimal" }
    ]
  },
  lines: {
    filename: "linjannimet2.dat",
    fields: [
      {
        length: 6,
        name: "lineId",
        type: "string",
        unique: true,
        primary: true,
        index: true
      },
      { length: 60, name: "name_fi", type: "string" },
      { length: 60, name: "name_se", type: "string" },
      { length: 30, name: "origin_fi", type: "string" },
      { length: 30, name: "origin_se", type: "string" },
      { length: 30, name: "destination_fi", type: "string" },
      { length: 30, name: "destination_se", type: "string" }
    ]
  },
  routes: {
    filename: "linja3.dat",
    fields: [
      {
        length: 6,
        name: "routeId",
        type: "string",
        index: true
      },
      { length: 8, name: "dateBegin", type: "date" },
      { length: 8, name: "dateEnd", type: "date" },
      { length: 1, name: "direction", type: "string" },
      { length: 60, name: "name_fi", type: "string" },
      { length: 60, name: "name_se", type: "string"  },
      { length: 2, name: "type", type: "string" },
      { length: 20, name: "origin_fi", type: "string" },
      { length: 20, name: "origin_se", type: "string" },
      { length: 7, name: "originStopId", type: "string", foreign: "stops.stopId" },
      { length: 5, name: "routeLength", type: "integer" },
      { length: 20, name: "destination_fi", type: "string" },
      { length: 20, name: "destination_se", type: "string" },
      { length: 7, name: "destinationStopId", type: "string", foreign: "stops.stopId" }
    ]
  },
  routesegments: {
    filename: "reitti.dat",
    fields: [
      { length: 7, name: "stopId", type: "string", foreign: "stops.stopId" },
      { length: 7 },
      {
        length: 6,
        name: "routeId",
        type: "string",
        index: true
      },
      { length: 1, name: "direction", type: "string" },
      { length: 8, name: "dateBegin", type: "date" },
      { length: 8, name: "dateEnd", type: "date" },
      { length: 20 },
      { length: 3, name: "duration", type: "integer" },
      { length: 3, name: "stopNumber", type: "integer" },
      { length: 94 },
      { length: 1, name: "timingStopType", type: "integer" }
    ]
  },
  geometries: {
    filename: "reittimuoto.dat",
    fields: [
      {
        length: 6,
        name: "routeId",
        type: "string",
        index: true
      },
      { length: 1, name: "direction", type: "string" },
      { length: 8, name: "beginDate", type: "date" },
      { length: 8, name: "endDate", type: "date" },
      { length: 7 },
      { length: 1 },
      { length: 4, name: "index", type: "integer" },
      { length: 7, name: "y", type: "integer" },
      { length: 7, name: "x", type: "integer" }
    ]
  },
  timetables: {
    filename: "aikat.dat",
    fields: [
      {
        length: 7,
        name: "stopId",
        type: "string",
        foreign: "stops.stopId",
        index: true
      },
      {
        length: 6,
        name: "routeId",
        type: "string",
        index: true
      },
      { length: 1, name: "direction", type: "string" },
      { length: 2, name: "dayType", type: "string" },
      { length: 4, name: null },
      { length: 1, name: null },
      { length: 2, name: "hours", type: "integer" },
      { length: 2, name: "minutes", type: "integer" },
      { length: 1, name: "isAccessible", type: "integer" },
      { length: 8, name: "dateBegin", type: "date" },
      { length: 8, name: "dateEnd", type: "date" },
      { length: 1, name: "stopRole", type: "integer" },
      { length: 4, name: "note", type: "string" },
      { length: 3, name: "vehicle", type: "string" }
    ]
  }
};

function dropTables(schema) {
  schema = schema
    .dropTableIfExists("timetables")
    .dropTableIfExists("routesegments")
    .dropTableIfExists("stops")
    .dropTableIfExists("terminals")
    .dropTableIfExists("stopareas");

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
  Object.entries(tables).forEach(function([tableName, { fields }]) {
    schema = schema.table(tableName, function(table) {
      fields.forEach(function({ name, type, foreign }) {
        if (name && type && foreign) {
          table.foreign(name).references(foreign.split('.')[1]).inTable("jore." + foreign.split('.')[0]);
        }
      });
    });
  });

  return schema;
}

knex.transaction(function(trx) {
  function loadTable(tableName) {
    return parseDat(
      sourcePath(tables[tableName].filename),
      tables[tableName].fields,
      knex, tableName, trx, st
    );
  }

  function loadData() {
    return loadTable("terminals")
      .then(() => loadTable("stopareas"))
      .then(() => loadTable("stops"))
      .then(() => Promise.all([
        loadTable("lines"),
        loadTable("routes"),
        loadTable("routesegments"),
        loadTable("geometries"),
        loadTable("timetables")
      ]))
  }

  createForeignKeys(createTables(dropTables(trx.schema.withSchema('jore'))))
    .then(loadData)
    .then(trx.commit)
    .then(res => console.log(res), (err) => {console.log(err); return trx.rollback()})
    .then(knex.destroy);
});
