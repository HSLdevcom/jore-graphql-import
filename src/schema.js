import { INTERMEDIATE_SCHEMA } from "./constants.js";

const schema = {
  stop: {
    filename: "pysakki.dat",
    fields: [
      {
        length: 7,
        name: "stop_id",
        type: "string",
        unique: true,
        primary: true,
        index: true,
        notNullable: true,
      },
      { length: 7 },
      { length: 7 },
      {
        length: 8,
        name: "lat",
        type: "decimal",
        index: true,
        notNullable: true,
      },
      {
        length: 8,
        name: "lon",
        type: "decimal",
        index: true,
        notNullable: true,
      },
      {
        length: 20,
        name: "name_fi",
        type: "string",
        notNullable: true,
      },
      {
        length: 20,
        name: "name_se",
        type: "string",
      },
      {
        length: 20,
        name: "address_fi",
        type: "string",
        // TODO: Add when data conforms notNullable: true,
      },
      {
        length: 20,
        name: "address_se",
        type: "string",
        // TODO: Add when data conforms notNullable: true,
      },
      { length: 3, name: "platform", type: "string" },
      { length: 7 },
      { length: 7 },
      { length: 20 },
      { length: 20 },
      { length: 2 },
      {
        length: 6,
        name: "short_id",
        type: "string",
        index: true,
        notNullable: true,
      },
      { length: 8 },
      { length: 8 },
      { length: 1 },
      { length: 1 },
      { length: 15, name: "heading", type: "string" },
      { length: 3, name: "stop_radius", type: "integer" },
      {
        length: 7,
        name: "terminal_id",
        type: "string",
        index: true,
        foreign: "terminal.terminal_id",
      },
      {
        length: 6,
        name: "stop_area_id",
        type: "string",
        index: true,
        foreign: "stop_area.stop_area_id",
      },
      {
        length: 1,
        name: "poster_count",
        type: "integer",
      },
      {
        length: 1,
        name: "driveby_timetable",
        type: "integer",
      },
      {
        length: 2,
        name: "stop_type",
        type: "string",
      },
      {
        length: 20,
        name: "distribution_area",
        type: "string",
      },
      {
        length: 3,
        name: "distribution_order",
        type: "integer",
      },
      {
        length: 2,
        name: "stop_zone",
        type: "string",
      },
      {
        length: 2,
        name: "stop_tariff",
        type: "string",
      },
    ],
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
        index: true,
        notNullable: true,
      },
      {
        length: 40,
        name: "name_fi",
        type: "string",
        notNullable: true,
      },
      {
        length: 40,
        name: "name_se",
        type: "string",
      },
      { length: 14 },
      { length: 8, name: "lat", type: "decimal" },
      { length: 8, name: "lon", type: "decimal" },
    ],
  },
  terminal_group: {
    filename: "terminaaliryhma.dat",
    fields: [
      {
        length: 7,
        name: "terminal_id_from",
        type: "string",
        index: true,
        foreign: "terminal.terminal_id",
        notNullable: true,
      },
      {
        length: 7,
        name: "terminal_id_to",
        type: "string",
        index: true,
        foreign: "terminal.terminal_id",
        notNullable: true,
      },
    ],
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
        index: true,
        notNullable: true,
      },
      {
        length: 40,
        name: "name_fi",
        type: "string",
        notNullable: true,
      },
      {
        length: 40,
        name: "name_se",
        type: "string",
      },
      { length: 14 },
      { length: 9, name: "lat", type: "decimal" },
      { length: 9, name: "lon", type: "decimal" },
    ],
  },
  line: {
    filename: "linjannimet2.dat",
    fields: [
      {
        length: 6,
        name: "line_id",
        type: "string",
        index: true,
        notNullable: true,
      },
      {
        length: 60,
        name: "name_fi",
        type: "string",
        notNullable: true,
      },
      {
        length: 60,
        name: "name_se",
        type: "string",
      },
      {
        length: 30,
        name: "origin_fi",
        type: "string",
        notNullable: true,
      },
      {
        length: 30,
        name: "origin_se",
        type: "string",
      },
      {
        length: 30,
        name: "destination_fi",
        type: "string",
      },
      {
        length: 30,
        name: "destination_se",
        type: "string",
      },
      {
        length: 8,
        name: "date_begin",
        type: "date",
        notNullable: true,
      },
      {
        length: 8,
        name: "date_end",
        type: "date",
        notNullable: true,
      },
      {
        length: 6,
        name: "line_id_parsed",
        type: "string",
      },
      {
        length: 1,
        name: "trunk_route",
        type: "string",
      },
    ],
    primary: ["line_id", "date_begin", "date_end"],
  },
  route: {
    filename: "linja3.dat",
    fields: [
      // position 2
      {
        length: 6,
        name: "route_id",
        type: "string",
        index: true,
        notNullable: true,
      },
      // position 8
      {
        length: 8,
        name: "date_begin",
        type: "date",
        notNullable: true,
      },
      // position 16
      {
        length: 8,
        name: "date_end",
        type: "date",
        notNullable: true,
      },
      // position 24
      {
        length: 1,
        name: "direction",
        type: "enu",
        index: true,
        typeOptions: ["1", "2"],
        notNullable: true,
      },
      // position 25
      {
        length: 60,
        name: "name_fi",
        type: "string",
        notNullable: true,
      },
      // position 85
      {
        length: 60,
        name: "name_se",
        type: "string",
      },
      // position 145
      {
        length: 2,
        name: "type",
        type: "string",
        index: true,
        notNullable: true,
      },
      // position 147
      {
        length: 20,
        name: "origin_fi",
        type: "string",
        notNullable: true,
      },
      // position 167
      {
        length: 20,
        name: "origin_se",
        type: "string",
      },
      // position 187
      {
        length: 7,
        name: "originstop_id",
        type: "string",
        foreign: "stop.stop_id",
        notNullable: true,
      },
      // position 194
      {
        length: 5,
        name: "route_length",
        type: "integer",
        notNullable: true,
      },
      // position 199
      {
        length: 20,
        name: "destination_fi",
        type: "string",
        notNullable: true,
      },
      // position 219
      {
        length: 20,
        name: "destination_se",
        type: "string",
      },
      // position 239
      {
        length: 7,
        name: "destinationstop_id",
        type: "string",
        foreign: "stop.stop_id",
        notNullable: true,
      },
      // position 246
      { length: 20 },
      // position 266
      { length: 20 },
      // position 286
      {
        length: 6,
        name: "line_id",
        type: "string",
        notNullable: true,
      },
      // position 292
      { length: 8 },
      // position 300
      {
        length: 6,
        name: "route_id_parsed",
        type: "string",
        index: true,
        notNullable: true,
      },
      // position 306
      {
        length: 6,
        name: "operator_id",
        type: "string",
      },
      // position 312
      {
        length: 40,
        name: "operator_name",
        type: "string",
      },
      // position 352
      {
        length: 6,
        name: "subcontractor_id",
        type: "string",
      },
      // position 358
      {
        length: 40,
        name: "subcontractor_name",
        type: "string",
      },
      // position 398
    ],
    primary: ["route_id", "direction", "date_begin", "date_end"],
  },
  route_segment: {
    filename: "reitti.dat",
    fields: [
      {
        length: 7,
        name: "stop_id",
        type: "string",
        foreign: "stop.stop_id",
        index: true,
        notNullable: true,
      },
      { length: 7, name: "next_stop_id", type: "string" },
      {
        length: 6,
        name: "route_id",
        type: "string",
        index: true,
        notNullable: true,
      },
      {
        length: 1,
        name: "direction",
        type: "enu",
        typeOptions: ["1", "2"],
        notNullable: true,
      },
      {
        length: 8,
        name: "date_begin",
        type: "date",
        index: true,
        notNullable: true,
      },
      {
        length: 8,
        name: "date_end",
        type: "date",
        index: true,
        notNullable: true,
      },
      { length: 20 },
      {
        length: 3,
        name: "duration",
        type: "integer",
        notNullable: true,
      },
      {
        length: 3,
        name: "stop_index",
        type: "integer",
        index: true,
        notNullable: true,
      },
      {
        length: 6,
        name: "distance_from_previous",
        type: "integer",
        notNullable: true,
      },
      {
        length: 6,
        name: "distance_from_start",
        type: "integer",
        notNullable: true,
      },
      {
        length: 1,
        name: "pickup_dropoff_type",
        type: "integer",
      },
      { length: 2 },
      { length: 20, name: "destination_fi", type: "string" },
      { length: 20, name: "destination_se", type: "string" },
      { length: 20, name: "via_fi", type: "string" },
      { length: 20, name: "via_se", type: "string" },
      {
        length: 1,
        name: "timing_stop_type",
        type: "integer",
        notNullable: true,
      },
      { length: 8 },
    ],
    primary: ["route_id", "direction", "date_begin", "date_end", "stop_index"],
  },
  point_geometry: {
    filename: "reittimuoto.dat",
    fields: [
      {
        length: 6,
        name: "route_id",
        type: "string",
        index: true,
        notNullable: true,
      },
      {
        length: 1,
        name: "direction",
        type: "enu",
        typeOptions: ["1", "2"],
        notNullable: true,
      },
      {
        length: 8,
        name: "date_begin",
        type: "date",
        notNullable: true,
      },
      {
        length: 8,
        name: "date_end",
        type: "date",
        notNullable: true,
      },
      {
        length: 7,
        name: "node_id",
        type: "string",
        index: true,
        notNullable: true,
      },
      {
        length: 1,
        name: "node_type",
        type: "string",
        index: true,
        notNullable: true,
      },
      {
        length: 4,
        name: "index",
        type: "integer",
        index: true,
        notNullable: true,
      },
      {
        length: 7,
        name: "y",
        type: "integer",
        notNullable: true,
      },
      {
        length: 7,
        name: "x",
        type: "integer",
        notNullable: true,
      },
    ],
    // primary: ["route_id", "direction", "date_begin", "date_end", "index"]
  },
  departure: {
    filename: "aikat.dat",
    fields: [
      {
        length: 7,
        name: "stop_id",
        type: "string",
        foreign: "stop.stop_id",
        index: true,
        notNullable: true,
      },
      {
        length: 6,
        name: "route_id",
        type: "string",
        index: true,
        notNullable: true,
      },
      {
        length: 1,
        name: "direction",
        type: "enu",
        typeOptions: ["1", "2"],
        notNullable: true,
      },
      {
        length: 2,
        name: "day_type",
        type: "string",
        notNullable: true,
      },
      {
        length: 4,
        name: "departure_id",
        type: "integer",
        notNullable: true,
      },
      {
        length: 1,
        name: "is_next_day",
        type: "boolean",
        notNullable: true,
      },
      {
        length: 2,
        name: "hours",
        type: "integer",
        notNullable: true,
      },
      {
        length: 2,
        name: "minutes",
        type: "integer",
        notNullable: true,
      },
      {
        length: 1,
        name: "is_accessible",
        type: "boolean",
        notNullable: true,
      },
      {
        length: 8,
        name: "date_begin",
        type: "date",
        notNullable: true,
      },
      {
        length: 8,
        name: "date_end",
        type: "date",
        notNullable: true,
      },
      {
        length: 1,
        name: "stop_role",
        type: "integer",
        notNullable: true,
      },
      { length: 1, name: "vehicle", type: "string" },
      { length: 4, name: "note", type: "string" },
      {
        length: 1,
        name: "arrival_is_next_day",
        type: "boolean",
        notNullable: true,
      },
      {
        length: 2,
        name: "arrival_hours",
        type: "integer",
        notNullable: true,
      },
      {
        length: 2,
        name: "arrival_minutes",
        type: "integer",
        notNullable: true,
      },
      {
        length: 2,
        name: "extra_departure",
        type: "string",
        defaultTo: "N",
      },
      {
        length: 2,
        name: "terminal_time",
        type: "integer",
      },
      {
        length: 2,
        name: "recovery_time",
        type: "integer",
      },
      {
        length: 2,
        name: "equipment_type",
        type: "string",
      },
      {
        length: 2,
        name: "equipment_required",
        type: "integer",
      },
      {
        length: 12,
        name: "bid_target_id",
        type: "string",
      },
      {
        length: 6,
        name: "operator_id",
        type: "string",
      },
      {
        length: 20,
        name: "available_operators",
        type: "string",
      },
      {
        length: 1,
        name: "trunk_color_required",
        type: "integer",
      },
    ],
    // This is a bit silly, I know, but it's the only way to uniquely identify a departure.
    primary: [
      "route_id",
      "direction",
      "date_begin",
      "date_end",
      "hours",
      "minutes",
      "stop_id",
      "day_type",
      "extra_departure",
    ],
  },
  note: {
    filename: "linteks.dat",
    fields: [
      {
        length: 6,
        name: "line_id",
        type: "string",
        notNullable: true,
      },
      { length: 8 },
      { length: 8 },
      {
        length: 4,
        name: "note_id",
        type: "integer",
        notNullable: true,
      },
      {
        length: 6,
        name: "note_type",
        type: "string",
        notNullable: true,
      },
      {
        length: 200,
        name: "note_text",
        type: "string",
        notNullable: true,
      },
      {
        length: 8,
        name: "date_begin",
        type: "date",
      },
      {
        length: 8,
        name: "date_end",
        type: "date",
      },
    ],
  },
  geometry: {
    fields: [
      {
        length: 6,
        name: "route_id",
        type: "string",
        index: true,
        notNullable: true,
      },
      {
        length: 1,
        name: "direction",
        type: "enu",
        typeOptions: ["1", "2"],
        notNullable: true,
      },
      {
        length: 8,
        name: "date_begin",
        type: "date",
        index: true,
        notNullable: true,
      },
      {
        length: 8,
        name: "date_end",
        type: "date",
        index: true,
        notNullable: true,
      },
      {
        name: "mode",
        type: "specificType",
        typeOptions: `${INTERMEDIATE_SCHEMA}.mode`,
      },
      {
        name: "geom",
        type: "specificType",
        typeOptions: "geometry(LineString,4326)",
        notNullable: true,
      },
      { name: "outliers", type: "integer" }, // TODO: remove
      { name: "min_likelihood", type: "float" }, // TODO: remove
      { name: "confidence", type: "float" },
    ],
    primary: ["route_id", "direction", "date_begin", "date_end"],
  },
  restroom: {
    filename: "taukotila.dat",
    fields: [
      {
        length: 100,
        name: "name_fi",
        type: "string",
        index: true,
      },
      {
        length: 100,
        name: "address_fi",
        type: "string",
      },
      {
        length: 21,
        name: "type",
        type: "string",
      },
      {
        length: 9,
        name: "lat",
        type: "decimal",
      },
      {
        length: 9,
        name: "lon",
        type: "decimal",
      },
      {
        length: 20,
        name: "mode",
        type: "string",
      },
    ],
  },
  /*equipment: {
    filename: "kalusto.dat",
    fields: [
      {
        length: 1,
        name: "class",
        type: "string",
      },
      {
        length: 7,
        name: "registry_nr",
        type: "string",
        primary: true,
        notNullable: true,
      },
      {
        length: 5,
        name: "vehicle_id",
        type: "string",
        index: true,
        notNullable: true,
      },
      {
        length: 2,
        name: "age",
        type: "string",
      },
      {
        length: 10,
        name: "type",
        type: "string",
      },
      {
        length: 1,
        name: "multi_axle",
        type: "integer",
      },
      {
        length: 20,
        name: "exterior_color",
        type: "string",
      },
      {
        length: 6,
        name: "operator_id",
        type: "string",
      },
      {
        length: 2,
        name: "emission_class",
        type: "string",
      },
      {
        length: 30,
        name: "emission_desc",
        type: "string",
      },
    ],
  },
  exception_days_calendar: {
    filename: "epvkal.dat",
    fields: [
      {
        length: 8,
        name: "date_in_effect",
        type: "date",
        primary: true,
        notNullable: true,
      },
      {
        length: 2,
        name: "exception_day_type",
        type: "string",
        notNullable: true,
      },
      {
        length: 2,
        name: "day_type",
        type: "string",
        notNullable: true,
      },
      {
        length: 1,
        name: "exclusive",
        type: "integer",
      },
    ],
  },
  exception_days: {
    filename: "eritpv.dat",
    fields: [
      {
        length: 2,
        name: "exception_day_type",
        type: "string",
        primary: true,
        notNullable: true,
      },
      {
        length: 50,
        name: "description",
        type: "string",
      },
    ],
  },
  replacement_days_calendar: {
    filename: "kpvkal.dat",
    fields: [
      {
        length: 8,
        name: "date_in_effect",
        type: "date",
        primary: true,
        notNullable: true,
      },
      {
        length: 2,
        name: "replacing_day_type",
        type: "string",
        notNullable: true,
      },
      {
        length: 2,
        name: "scope",
        type: "string",
      },
      {
        length: 2,
        name: "day_type",
        type: "string",
        notNullable: true,
      },
      {
        length: 4,
        name: "time_begin",
        type: "string",
      },
      {
        length: 4,
        name: "time_end",
        type: "string",
      },
    ],
  },*/
};
export default schema;
