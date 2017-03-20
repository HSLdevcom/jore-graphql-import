module.exports = {
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
      { length: 1, name: "is_next_day", type: "boolean" },
      { length: 2, name: "hours", type: "integer" },
      { length: 2, name: "minutes", type: "integer" },
      { length: 1, name: "is_accessible", type: "boolean" },
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
