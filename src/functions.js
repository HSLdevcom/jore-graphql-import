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
    create function jore.route_segment_has_regular_day_departures(route_segment jore.route_segment, date date) returns boolean as $$
      select exists (
          select true
          from jore.departure departure
          where route_segment.route_id = departure.route_id
            and route_segment.direction = departure.direction
            and route_segment.date_begin <= departure.date_end
            and route_segment.date_end >= departure.date_begin
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
    create function jore.route_segment_route(route_segment jore.route_segment, date date) returns setof jore.route as $$
      select *
      from jore.route route
      where route_segment.route_id = route.route_id
        and route_segment.direction = route.direction
        and route.date_begin <= route_segment.date_end
        and route.date_end >= route_segment.date_begin
        and case when date is null then true else date between route.date_begin and route.date_end end
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
        and route_segment.stop_index < inner_route_segment.stop_index
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
    create function jore.route_mode(route jore.route) returns jore.mode as $$
      select
        case when route is null then null else
          case route.type
            when '02' then 'TRAM'::jore.mode
            when '06' then 'SUBWAY'::jore.mode
            when '07' then 'FERRY'::jore.mode
            when '12' then 'RAIL'::jore.mode
            when '13' then 'RAIL'::jore.mode
            else 'BUS'::jore.mode
          end
        end
    $$ language sql immutable;
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
    create function jore.stop_calculated_heading(stop jore.stop) returns numeric as $$
      -- https://en.wikipedia.org/wiki/Mean_of_circular_quantities
      select mod(cast(degrees(atan2(avg(sin(heading)), avg(cos(heading)))) + 360 as numeric), 360)
        from (
          select st_azimuth(outer_geometry.point, inner_geometry.point) as heading
            from jore.point_geometry as outer_geometry
            join jore.point_geometry as inner_geometry
              on inner_geometry.index = (outer_geometry.index + 1)
                and inner_geometry.route_id = outer_geometry.route_id
                and inner_geometry.direction = outer_geometry.direction
                and inner_geometry.date_begin = outer_geometry.date_begin
                and inner_geometry.date_end = outer_geometry.date_end
            where outer_geometry.node_id = stop.stop_id
              and outer_geometry.node_type = 'P'
        ) as headings;
    $$ language sql stable;
  `,
  `
    create function jore.route_segment_notes(route_segment jore.route_segment, date date) returns setof jore.note as $$
      select note
      from jore.note note
      where note.line_id = (select line_id from jore.route_segment_line(route_segment))
        and (note.date_begin is null or note.date_begin <= route_segment.date_end)
        and (note.date_end is null or note.date_end >= route_segment.date_begin)
        and case when date is null then true else (
          (note.date_begin is null or note.date_begin <= date)
          and (note.date_end is null or note.date_end >= date)
       ) end
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
      select ST_AsGeoJSON(geometry.geom)::jsonb, date_begin, date_end
      from jore.geometry geometry
      where route.route_id = geometry.route_id
        and route.direction = geometry.direction
        and route.date_begin <= geometry.date_end
        and route.date_end >= geometry.date_begin
        and case when date is null then true else date between geometry.date_begin and geometry.date_end end
    $$ language sql stable;
  `,
  `
    create function jore.stops_by_bbox(
      min_lat double precision,
      min_lon double precision,
      max_lat double precision,
      max_lon double precision
    ) returns setof jore.stop as $$
      select *
      from jore.stop stop
      where stop.point && ST_MakeEnvelope(min_lon, min_lat, max_lon, max_lat, 4326);
    $$ language sql stable;
  `,
  `
    create type jore.stop_grouped as (
      short_id     character varying(6),
      name_fi      character varying(20),
      name_se      character varying(20),
      lat          numeric(9,6),
      lon          numeric(9,6),
      stop_ids     character varying(7)[]
    );
  `,
  `
    create function jore.stop_grouped_by_short_id_by_bbox(
      min_lat double precision,
      min_lon double precision,
      max_lat double precision,
      max_lon double precision
    ) returns setof jore.stop_grouped as $$
      select stop.short_id, stop.name_fi, stop.name_se, stop.lat, stop.lon, array_agg(stop.stop_id)
      from jore.stop stop
      where stop.point && ST_MakeEnvelope(min_lon, min_lat, max_lon, max_lat, 4326)
      group by stop.short_id, stop.name_fi, stop.name_se, stop.lat, stop.lon;
    $$ language sql stable;
  `,
  `
    create function jore.stop_grouped_stops(stop_grouped jore.stop_grouped) returns setof jore.stop as $$
      select stop
      from jore.stop
      where stop.stop_id = any(stop_grouped.stop_ids);
    $$ language sql stable;
  `,
  `
    create function jore.stop_siblings(stop jore.stop) returns setof jore.stop as $$
      select *
      from jore.stop original_stop
      where original_stop.short_id = stop.short_id
        and original_stop.name_fi = stop.name_fi
        and original_stop.name_se = stop.name_se
        and original_stop.lat = stop.lat
        and original_stop.lon = stop.lon
    $$ language sql stable;
  `,
  `
    create function jore.terminal_siblings(terminal jore.terminal) returns setof jore.terminal as $$
      select terminal_to.*
      from jore.terminal_group terminal_group
      join jore.terminal terminal_to on terminal_to.terminal_id = terminal_group.terminal_id_to
      where terminal_group.terminal_id_from = terminal.terminal_id
    $$ language sql stable;
  `,
  `
    create function jore.stop_modes(stop jore.stop, date date) returns setof jore.mode as $$
      select distinct jore.route_mode(route)
      from jore.route route
      where route in (
        select jore.route_segment_route(route_segment, date)
        from jore.stop_route_segments_for_date(stop, date) route_segment
      )
    $$ language sql stable;
  `,
  `
    create function jore.terminal_modes(terminal jore.terminal, date date) returns setof jore.mode as $$
      select distinct jore.stop_modes(stop, date)
      from jore.stop stop
      where stop.terminal_id = terminal.terminal_id
    $$ language sql stable;
  `,
  `
    create function jore.stop_areas_by_bbox(
      min_lat double precision,
      min_lon double precision,
      max_lat double precision,
      max_lon double precision
    ) returns setof jore.stop_area as $$
      select *
      from jore.stop_area stop_area
      where stop_area.point && ST_MakeEnvelope(min_lon, min_lat, max_lon, max_lat, 4326);
    $$ language sql stable;
  `,
  `
    create function jore.terminals_by_bbox(
      min_lat double precision,
      min_lon double precision,
      max_lat double precision,
      max_lon double precision
    ) returns setof jore.terminal as $$
      select *
      from jore.terminal terminal
      where terminal.point && ST_MakeEnvelope(min_lon, min_lat, max_lon, max_lat, 4326);
    $$ language sql stable;
  `,
  `
    create function jore.network_by_date_as_geojson(
      date date,
      min_lat double precision,
      min_lon double precision,
      max_lat double precision,
      max_lon double precision
    ) returns json as $$
      select row_to_json(fc)
      from (
        select 'FeatureCollection' as type, array_to_json(array_agg(f)) as features
          from (
            select
              'Feature' as type,
              ST_AsGeoJSON(geometry.geometry)::jsonb as geometry,
              json_build_object(
                'route_id', route_id,
                'direction', direction,
                'date_begin', date_begin,
                'date_end', date_end,
                'mode', jore.route_mode((
                  select route
                  from jore.route route
                  where geometry.route_id = route.route_id
                    and geometry.direction = route.direction
                    and date between route.date_begin and route.date_end
                ))
              ) as properties
            from (
              select
                case when
                  min_lat is null or
                  max_lat is null or
                  min_lon is null or
                  max_lon is null
                then
                  geom
                else
                  geom &&
                  ST_MakeEnvelope(min_lon, min_lat, max_lon, max_lat, 4326)
                end as geometry,
                route_id, direction, date_begin, date_end
              from jore.geometry
              where date between date_begin and date_end
            ) as geometry
            where not ST_IsEmpty(geometry) and exists (
              select 1
              from jore.departure departure
              where departure.route_id = geometry.route_id
                and departure.direction = geometry.direction
                and departure.day_type in ('Ma', 'Ti', 'Ke', 'To', 'Pe', 'La', 'Su')
                and date between departure.date_begin and departure.date_end
            )
          ) as f
        ) as fc
    $$ language sql stable;
  `,
  `
    create function jore.point_network_as_geojson() returns json as $$
      select row_to_json(fc)
      from (
        select 'FeatureCollection' as type, array_to_json(array_agg(f)) as features
          from (
            select
              'Feature' as type,
              ST_AsGeoJSON(geometry.geometry)::jsonb as geometry,
              json_build_object(
                'route_id', route_id,
                'direction', direction,
                'date_begin', date_begin,
                'date_end', date_end,
                'mode', jore.route_mode((
                  select route
                  from jore.route route
                  where geometry.route_id = route.route_id
                    and geometry.direction = route.direction
                    and route.date_begin <= geometry.date_end
                    and route.date_end >= geometry.date_begin
                ))
              ) as properties
            from (
              select
                ST_MakeLine(point order by index asc) as geometry,
                route_id, direction, date_begin, date_end
              from jore.point_geometry
              group by route_id, direction, date_begin, date_end
            ) as geometry
          ) as f
        ) as fc
    $$ language sql stable;
  `
];
