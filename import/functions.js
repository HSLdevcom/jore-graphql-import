module.exports = [
  `
    create function jore.stop_departures_for_date(stop jore.stop, date date) returns setof jore.departure as $$
      select *
      from jore.departure departure
      where departure.stop_id = stop.stop_id
        and date between date_begin and date_end;
    $$ language sql stable;
  `,
  `
    create function jore.stop_route_segments_for_date(stop jore.stop, date date) returns setof jore.route_segment as $$
      select *
      from jore.route_segment route_segment
      where route_segment.stop_id = stop.stop_id
        and date between route_segment.date_begin and route_segment.date_end;
    $$ language sql stable;
  `,
  `
    create function jore.route_has_regular_day_departures(route jore.route, date date) returns boolean as $$
      select exists (
          select true
          from jore.departure departure
          where route.route_id = departure.route_id
            and route.direction = departure.direction
            and route.date_begin <= departure.date_end
            and route.date_end >= departure.date_begin
            and departure.day_type in ('Ma', 'Ti', 'Ke', 'To', 'Pe', 'La', 'Su')
            and case when date is null then true else date between departure.date_begin and departure.date_end end
        )
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
    create function jore.route_departure_notes(route jore.route, date date) returns jore.note as $$
      select *
      from jore.note note
      where note.line_id in (select line_id from jore.route_line(route))
        and route.date_begin <= note.date_end
        and route.date_end >= note.date_begin
        and case when date is null then true else date between note.date_begin and note.date_end end
    $$ language sql stable;
  `,
  `
    create function jore.route_segment_departure_notes(route_segment jore.route_segment, date date) returns jore.note as $$
      select *
      from jore.note note
      where note.line_id in (select line_id from jore.route_segment_line(route_segment))
        and route_segment.date_begin <= note.date_end
        and route_segment.date_end >= note.date_begin
        and case when date is null then true else date between note.date_begin and note.date_end end
    $$ language sql stable;
  `,
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
      is_next_day   boolean,
      hours         integer,
      minutes       integer,
      is_accessible boolean,
      date_begin    date,
      date_end      date,
      stop_role     integer,
      note          character varying(4),
      vehicle       character varying(3)[]
    );
  `,
  `
    create function jore.route_departures_gropuped(route jore.route, date date) returns setof jore.departure_group as $$
      select departure.stop_id, departure.route_id, departure.direction, array_agg(departure.day_type), is_next_day,
        departure.hours, departure.minutes, departure.is_accessible, departure.date_begin, departure.date_end,
        departure.stop_role, departure.note, array_agg(departure.vehicle)
      from jore.departure departure
      where route.route_id = departure.route_id
        and route.direction = departure.direction
        and route.date_begin <= departure.date_end
        and route.date_end >= departure.date_begin
        and case when date is null then true else date between departure.date_begin and departure.date_end end
      group by (departure.stop_id, departure.route_id, departure.direction, departure.is_next_day, departure.hours, departure.minutes,
        departure.is_accessible, departure.date_begin, departure.date_end, departure.stop_role, departure.note);
    $$ language sql stable;
  `,
  `
    create function jore.route_segment_departures_gropuped(route_segment jore.route_segment, date date) returns setof jore.departure_group as $$
      select departure.stop_id, departure.route_id, departure.direction, array_agg(departure.day_type), is_next_day,
        departure.hours, departure.minutes, departure.is_accessible, departure.date_begin, departure.date_end,
        departure.stop_role, departure.note, array_agg(departure.vehicle)
      from jore.departure departure
      where route_segment.route_id = departure.route_id
        and route_segment.stop_id = departure.stop_id
        and route_segment.direction = departure.direction
        and route_segment.date_begin <= departure.date_end
        and route_segment.date_end >= departure.date_begin
        and case when date is null then true else date between departure.date_begin and departure.date_end end
      group by (departure.stop_id, departure.route_id, departure.direction, departure.is_next_day, departure.hours, departure.minutes,
        departure.is_accessible, departure.date_begin, departure.date_end, departure.stop_role, departure.note);
    $$ language sql stable;
  `,
  `
    create function jore.stop_departures_gropuped(stop jore.stop, date date) returns setof jore.departure_group as $$
      select departure.stop_id, departure.route_id, departure.direction, array_agg(departure.day_type), is_next_day,
        departure.hours, departure.minutes, departure.is_accessible, departure.date_begin, departure.date_end,
        departure.stop_role, departure.note, array_agg(departure.vehicle)
      from jore.departure departure
      where stop.stop_id = departure.stop_id
        and case when date is null then true else date between departure.date_begin and departure.date_end end
      group by (departure.stop_id, departure.route_id, departure.direction, departure.is_next_day, departure.hours, departure.minutes,
        departure.is_accessible, departure.date_begin, departure.date_end, departure.stop_role, departure.note);
    $$ language sql stable;
  `,
  `
    create function jore.line_routes(line jore.line) returns setof jore.route as $$
      select *
      from jore.route route
      where route.route_id like (line.line_id || '%')
        and not exists (
          select true
          from jore.line inner_line
          where inner_line.line_id like (line.line_id || '_%')
            and route.route_id like (inner_line.line_id || '%')
          limit 1
        );
    $$ language sql stable;
  `,
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
