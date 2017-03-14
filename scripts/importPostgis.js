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
  stop: {
    filename: "pysakki.dat",
    fields: [
      {
        length: 7,
        name: "stop_id",
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
      { length: 6, name: "short_id", type: "string" },
      { length: 8 },
      { length: 8 },
      { length: 1 },
      { length: 15, name: "heading", type: "string" },
      { length: 1 },
      { length: 3 },
      {
        length: 7,
        name: "terminal_id",
        type: "string",
        foreign: "terminal.terminal_id"
      },
      {
        length: 7,
        name: "stop_area_id",
        type: "string",
        foreign: "stop_area.stop_area_id"
      }
    ]
  },
  terminal: {
    filename: "terminaali.dat",
    fields: [
      {
        length: 7,
        name: "terminal_id",
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
  stop_area: {
    filename: "pysakkialue.dat",
    fields: [
      {
        length: 6,
        name: "stop_area_id",
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
  line: {
    filename: "linjannimet2.dat",
    fields: [
      {
        length: 6,
        name: "line_id",
        type: "string",
        index: true
      },
      { length: 60, name: "name_fi", type: "string" },
      { length: 60, name: "name_se", type: "string" },
      { length: 30, name: "origin_fi", type: "string" },
      { length: 30, name: "origin_se", type: "string" },
      { length: 30, name: "destination_fi", type: "string" },
      { length: 30, name: "destination_se", type: "string" },
      { length: 8, name: "date_begin", type: "date" },
      { length: 8, name: "date_end", type: "date" },
    ],
    primary: ["line_id", "date_begin", "date_end"]
  },
  route: {
    filename: "linja3.dat",
    fields: [
      {
        length: 6,
        name: "route_id",
        type: "string",
        index: true
      },
      { length: 8, name: "date_begin", type: "date" },
      { length: 8, name: "date_end", type: "date" },
      { length: 1, name: "direction", type: "string" },
      { length: 60, name: "name_fi", type: "string" },
      { length: 60, name: "name_se", type: "string" },
      { length: 2, name: "type", type: "string" },
      { length: 20, name: "origin_fi", type: "string" },
      { length: 20, name: "origin_se", type: "string" },
      {
        length: 7,
        name: "originstop_id",
        type: "string",
        foreign: "stop.stop_id"
      },
      { length: 5, name: "route_length", type: "integer" },
      { length: 20, name: "destination_fi", type: "string" },
      { length: 20, name: "destination_se", type: "string" },
      {
        length: 7,
        name: "destinationstop_id",
        type: "string",
        foreign: "stop.stop_id"
      }
    ],
    primary: ["route_id", "direction", "date_begin", "date_end"]
  },
  route_segment: {
    filename: "reitti.dat",
    fields: [
      { length: 7, name: "stop_id", type: "string", foreign: "stop.stop_id" },
      { length: 7 },
      {
        length: 6,
        name: "route_id",
        type: "string",
        index: true
      },
      { length: 1, name: "direction", type: "string" },
      { length: 8, name: "date_begin", type: "date" },
      { length: 8, name: "date_end", type: "date" },
      { length: 20 },
      { length: 3, name: "duration", type: "integer" },
      { length: 3, name: "stop_number", type: "integer" },
      { length: 94 },
      { length: 1, name: "timing_stop_type", type: "integer" }
    ],
    primary: ["route_id", "direction", "date_begin", "date_end", "stop_number"]
  },
  geometry: {
    filename: "reittimuoto.dat",
    fields: [
      {
        length: 6,
        name: "route_id",
        type: "string",
        index: true
      },
      { length: 1, name: "direction", type: "string" },
      { length: 8, name: "date_begin", type: "date" },
      { length: 8, name: "date_end", type: "date" },
      { length: 7 },
      { length: 1 },
      { length: 4, name: "index", type: "integer" },
      { length: 7, name: "y", type: "integer" },
      { length: 7, name: "x", type: "integer" }
    ],
    //primary: ["route_id", "direction", "date_begin", "date_end", "index"]
  },
  departure: {
    filename: "aikat.dat",
    fields: [
      {
        length: 7,
        name: "stop_id",
        type: "string",
        foreign: "stop.stop_id",
        index: true
      },
      {
        length: 6,
        name: "route_id",
        type: "string",
        index: true
      },
      { length: 1, name: "direction", type: "string" },
      { length: 2, name: "day_type", type: "string" },
      { length: 4, name: null },
      { length: 1, name: null },
      { length: 2, name: "hours", type: "integer" },
      { length: 2, name: "minutes", type: "integer" },
      { length: 1, name: "is_accessible", type: "integer" },
      { length: 8, name: "date_begin", type: "date" },
      { length: 8, name: "date_end", type: "date" },
      { length: 1, name: "stop_role", type: "integer" },
      { length: 4, name: "note", type: "string" },
      { length: 3, name: "vehicle", type: "string" }
    ]
  },
  note: {
    filename: "linteks.dat",
    fields: [
      { length: 6, name: "line_id", type: "string"},
      { length: 8 },
      { length: 8 },
      { length: 4, name: "note_id", type: "integer" },
      { length: 6, name: "note_tpe", type: "string" },
      { length: 200, name: "note_text", type: "string" },
      { length: 8, name: "date_begin", type: "date" },
      { length: 8, name: "date_end", type: "date" }
    ]
  }
};

const functions = [
  `
    create function jore.stop_departures_for_date(stop jore.stop, date date) returns setof jore.departure as $$
      select *
      from jore.departure departure
      where departure.stop_id = stop.stop_id
        and date between date_begin and date_end;
    $$ language sql stable;
  `,
  `
    create function jore.route_line(route jore.route) returns setof jore.line as $$
      select *
      from jore.line line
      where route.route_id like (line.line_id || '%')
      order by line.line_id desc
      limit 1;
    $$ language sql stable;
  `, // TODO: investigate why we have to return a setof here
  `
    create function jore.route_segment_line(route_segment jore.route_segment) returns setof jore.line as $$
      select *
      from jore.line line
      where route_segment.route_id like (line.line_id || '%')
      order by line.line_id desc
      limit 1;
    $$ language sql stable;
  `, // TODO: investigate why we have to return a setof here
  `
    create function jore.route_segment_next_stops(route_segment jore.route_segment) returns setof jore.route_segment as $$
      select *
      from jore.route_segment inner_route_segment
      where route_segment.route_id = inner_route_segment.route_id
        and route_segment.direction = inner_route_segment.direction
        and route_segment.date_begin = inner_route_segment.date_begin
        and route_segment.date_end = inner_route_segment.date_end
        and route_segment.stop_number < inner_route_segment.stop_number
    $$ language sql stable;
  `,
  `
    create function jore.route_route_segments(route jore.route) returns setof jore.route_segment as $$
      select *
      from jore.route_segment route_segment
      where route.route_id = route_segment.route_id
        and route.direction = route_segment.direction
        and route.date_begin <= route_segment.date_end
        and route.date_end >= route_segment.date_begin
    $$ language sql stable;
  `,
  `
    create function jore.route_departures(route jore.route) returns setof jore.departure as $$
      select *
      from jore.departure departure
      where route.route_id = departure.route_id
        and route.direction = departure.direction
        and route.date_begin <= departure.date_end
        and route.date_end >= departure.date_begin
    $$ language sql stable;
  `,
  `
    create type jore.departure_group as (
      stop_id       character varying(7),
      route_id      character varying(6),
      direction     character varying(1),
      day_type      character varying(2)[],
      hours         integer,
      minutes       integer,
      is_accessible integer,
      date_begin    date,
      date_end      date,
      stop_role     integer,
      note          character varying(4),
      vehicle       character varying(3)[]
    );
  `,
  `
    create function jore.route_departures_gropuped(route jore.route, date date) returns setof jore.departure_group as $$
      select departure.stop_id, departure.route_id, departure.direction, array_agg(departure.day_type),
        departure.hours, departure.minutes, departure.is_accessible, departure.date_begin, departure.date_end,
        departure.stop_role, departure.note, array_agg(departure.vehicle)
      from jore.departure departure
      where route.route_id = departure.route_id
        and route.direction = departure.direction
        and route.date_begin <= departure.date_end
        and route.date_end >= departure.date_begin
        and case when date is null then true else date between departure.date_begin and departure.date_end end
      group by (departure.stop_id, departure.route_id, departure.direction, departure.hours, departure.minutes,
        departure.is_accessible, departure.date_begin, departure.date_end, departure.stop_role, departure.note);
    $$ language sql stable;
  `,
  `
    create function jore.route_segment_departures_gropuped(route_segment jore.route_segment, date date) returns setof jore.departure_group as $$
      select departure.stop_id, departure.route_id, departure.direction, array_agg(departure.day_type),
        departure.hours, departure.minutes, departure.is_accessible, departure.date_begin, departure.date_end,
        departure.stop_role, departure.note, array_agg(departure.vehicle)
      from jore.departure departure
      where route_segment.route_id = departure.route_id
        and route_segment.direction = departure.direction
        and route_segment.date_begin <= departure.date_end
        and route_segment.date_end >= departure.date_begin
        and case when date is null then true else date between departure.date_begin and departure.date_end end
      group by (departure.stop_id, departure.route_id, departure.direction, departure.hours, departure.minutes,
        departure.is_accessible, departure.date_begin, departure.date_end, departure.stop_role, departure.note);
    $$ language sql stable;
  `,
  `
    create function jore.stop_departures_gropuped(stop jore.stop, date date) returns setof jore.departure_group as $$
      select departure.stop_id, departure.route_id, departure.direction, array_agg(departure.day_type),
        departure.hours, departure.minutes, departure.is_accessible, departure.date_begin, departure.date_end,
        departure.stop_role, departure.note, array_agg(departure.vehicle)
      from jore.departure departure
      where stop.stop_id = departure.stop_id
        and case when date is null then true else date between departure.date_begin and departure.date_end end
      group by (departure.stop_id, departure.route_id, departure.direction, departure.hours, departure.minutes,
        departure.is_accessible, departure.date_begin, departure.date_end, departure.stop_role, departure.note);
    $$ language sql stable;
  `,
  // `
  //   create function jore.line_routes(line jore.line) returns setof jore.route as $$
  //     select *
  //     from jore.route route
  //     where route.route_id like (line.line_id || '%')
  //       and not exists (
  //         select true
  //         from jore.line inner_line
  //         where inner_line.line_id like (line.line_id || '_%')
  //           and route.route_id like (inner_line.line_id || '%')
  //         limit 1
  //       );
  //   $$ language sql stable;
  // `,
  `
    create type jore.geometry_with_date as (
      geometry jsonb,
      date_begin date,
      date_end date
    );
  `,
  `
    create function jore.route_geometries(route jore.route, date date) returns setof jore.geometry_with_date as $$
      select ST_AsGeoJSON(ST_MakeLine(point order by index asc))::jsonb, date_begin, date_end
      from jore.geometry geometry
      where route.route_id = geometry.route_id
        and route.direction = geometry.direction
        and route.date_begin <= geometry.date_end
        and route.date_end >= geometry.date_begin
        and case when date is null then true else date between geometry.date_begin and geometry.date_end end
      group by (date_begin, date_end);
    $$ language sql stable;
  `,
  `
    create function jore.stops_by_bbox(
      min_lat decimal(9, 6),
      min_lon decimal(9, 6),
      max_lat decimal(9, 6),
      max_lon decimal(9, 6)
    ) returns setof jore.stop as $$
      select *
      from jore.stop stop
      where stop.lat between min_lat and max_lat
        and stop.lon between min_lon and max_lon
    $$ language sql stable;
  `,
  `
    create function jore.stop_areas_by_bbox(
    min_lat decimal(9, 6),
    min_lon decimal(9, 6),
    max_lat decimal(9, 6),
    max_lon decimal(9, 6)
  ) returns setof jore.stop_area as $$
    select *
    from jore.stop_area stop_area
    where stop_area.lat between min_lat and max_lat
      and stop_area.lon between min_lon and max_lon
  $$ language sql stable;
  `,
  `
    create function jore.terminals_by_bbox(
    min_lat decimal(9, 6),
    min_lon decimal(9, 6),
    max_lat decimal(9, 6),
    max_lon decimal(9, 6)
  ) returns setof jore.terminal as $$
    select *
    from jore.terminal terminal
    where terminal.lat between min_lat and max_lat
      and terminal.lon between min_lon and max_lon
  $$ language sql stable;
  `
];

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
  return Promise.all(functions.map(f => knex.raw(f)));
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

  trx.raw("drop schema jore cascade")
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
