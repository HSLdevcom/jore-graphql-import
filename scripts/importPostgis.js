const knex = require('knex')({ dialect: 'postgres' });

// install postgis functions in knex.postgis;
const st = require('knex-postgis')(knex);

const _ = require('lodash');

const tables = {
  stops: {
    filename: 'pysakki.dat',
    fields: [
      {
        length: 7,
        name: 'stopId',
        type: 'string',
        unique: true,
        primary: true,
        index: true
      },
      { length: 7 },
      { length: 7 },
      { length: 8, name: 'lat', type: 'decimal' },
      { length: 8, name: 'lon', type: 'decimal' },
      { length: 20, name: 'name_fi', type: 'string' },
      { length: 20, name: 'name_se', type: 'string' },
      { length: 20, name: 'address_fi', type: 'string' },
      { length: 20, name: 'address_se', type: 'string' },
      { length: 3, name: 'platform', type: 'string' },
      { length: 7 },
      { length: 7 },
      { length: 20 },
      { length: 20 },
      { length: 2 },
      { length: 6, name: 'shortId', type: 'string' },
      { length: 8 },
      { length: 8 },
      { length: 1 },
      { length: 15, name: 'heading', type: 'string' },
      { length: 3 },
      {
        length: 7,
        name: 'terminalId',
        type: 'string',
        references: 'terminals.terminalId'
      },
      {
        length: 7,
        name: 'stopAreaId',
        type: 'string',
        references: 'stopAreas.stopAreaId'
      }
    ]
  },
  terminals: {
    filename: 'terminaali.dat',
    fields: [
      {
        length: 7,
        name: 'terminalId',
        type: 'string',
        unique: true,
        primary: true,
        index: true
      },
      { length: 40, name: 'name_fi', type: 'string' },
      { length: 40, name: 'name_se', type: 'string' },
      { length: 14 },
      { length: 8, name: 'lat', type: 'decimal' },
      { length: 8, name: 'lon', type: 'decimal' }
    ]
  },
  stopAreas: {
    filename: 'pysakkialue.dat',
    fields: [
      {
        length: 6,
        name: 'stopAreaId',
        type: 'string',
        unique: true,
        primary: true,
        index: true
      },
      { length: 40, name: 'name_fi', type: 'string' },
      { length: 40, name: 'name_se', type: 'string' },
      { length: 14 },
      { length: 8, name: 'lat', type: 'decimal' },
      { length: 8, name: 'lon', type: 'decimal' }
    ]
  },
  lines: {
    filename: 'linjanimet2.dat',
    fields: [
      {
        length: 6,
        name: 'lineId',
        type: 'string',
        unique: true,
        primary: true,
        index: true
      },
      { length: 60, name: 'name_fi', type: 'string' },
      { length: 60, name: 'name_se', type: 'string' },
      { length: 30, name: 'origin_fi', type: 'string' },
      { length: 30, name: 'origin_se', type: 'string' },
      { length: 30, name: 'destination_fi', type: 'string' },
      { length: 30, name: 'destination_se', type: 'string' }
    ]
  },
  routes: {
    filename: 'linja3',
    fields: [
      {
        length: 6,
        name: 'routeId',
        type: 'string',
        primary: ['routeId', 'dateBegin', 'dateEnd', 'direction'],
        index: true
      },
      { length: 8, name: 'dateBegin', type: 'date' },
      { length: 8, name: 'dateEnd', type: 'date' },
      { length: 1, name: 'direction', type: 'string' },
      { length: 60 },
      { length: 60 },
      { length: 2, name: 'type', type: 'string' },
      { length: 20 },
      { length: 20 },
      { length: 7 },
      { length: 5 },
      { length: 20, name: 'destination_fi', type: 'string' },
      { length: 20, name: 'destination_se', type: 'string' }
    ]
  },
  routeSegments: {
    filename: 'reitti.dat',
    fields: [
      { length: 7, name: 'stopId', type: 'string', references: 'stops.stopId' },
      { length: 7 },
      {
        length: 6,
        name: 'routeId',
        type: 'string',
        primary: ['routeId', 'dateBegin', 'dateEnd', 'direction'],
        index: true
      },
      { length: 1, name: 'direction', type: 'string' },
      { length: 8, name: 'dateBegin', type: 'date' },
      { length: 8, name: 'dateEnd', type: 'date' },
      { length: 20 },
      { length: 3, name: 'duration', type: 'integer' },
      { length: 3, name: 'stopNumber', type: 'integer' },
      { length: 94 },
      { length: 1, name: 'timingStopType', type: 'integer' }
    ]
  },
  geometries: {
    filename: 'reittimuoto.dat',
    fields: [
      {
        length: 6,
        name: 'routeId',
        type: 'string',
        primary: ['routeId', 'dateBegin', 'dateEnd', 'direction'],
        index: true
      },
      { length: 1, name: 'direction', type: 'string' },
      { length: 8, name: 'beginDate', type: 'date' },
      { length: 8, name: 'endDate', type: 'date' },
      { length: 7 },
      { length: 1 },
      { length: 4 },
      { length: 7, name: 'lon', type: 'integer' },
      { length: 7, name: 'lat', type: 'integer' }
    ]
  },
  timetables: {
    filename: 'aikat.dat',
    fields: [
      { length: 7, name: 'stopId', type: 'string', references: 'stops.stopId' },
      {
        length: 6,
        name: 'routeId',
        type: 'string',
        primary: ['routeId', 'dateBegin', 'dateEnd', 'direction'],
        index: true
      },
      { length: 1, name: 'direction', type: 'string' },
      { length: 2, name: 'dayType', type: 'string' },
      { length: 4, name: null },
      { length: 1, name: null },
      { length: 2, name: 'hours', type: 'integer' },
      { length: 2, name: 'minutes', type: 'integer' },
      { length: 1, name: 'isAccessible', type: 'integer' },
      { length: 8, name: 'dateBegin', type: 'date' },
      { length: 8, name: 'dateEnd', type: 'date' }
    ]
  }
};

let schema = knex.schema;

Object.entries(tables).forEach(function([tableName, { fields }]) {
  schema = schema
    .dropTableIfExists(tableName)
    .createTable(tableName, function(table) {
      fields.forEach(function({
        length,
        name,
        type,
        unique,
        primary,
        index,
        references
      }) {
        if (name && type) {
          let column;
          if (type === 'string') {
            column = table.string(name, length);
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
          if (references) {
            column = column.references(references);
          }
        }
      });
      if (_.find(fields, { name: 'lat' }) && _.find(fields, { name: 'lon' })) {
        table.specificType('point', 'geometry(point, 4326)');
      }
    });
});

console.log(schema.toString());
