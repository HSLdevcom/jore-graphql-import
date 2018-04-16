
create index on jore.departure (route_id, direction) where stop_role = 1;
create index on jore.departure (route_id, direction, stop_id);

CREATE OR REPLACE FUNCTION array_sort (ANYARRAY)
  RETURNS ANYARRAY LANGUAGE SQL
  AS $$
  SELECT ARRAY(SELECT unnest($1) ORDER BY 1)
$$;

create type jore.section_intermediate as (
  routes character varying(6)[],
  lon numeric,
  lat numeric,
  angles integer[],
  length numeric
);

CREATE OR REPLACE FUNCTION public.first_agg ( anyelement, anyelement )
RETURNS anyelement LANGUAGE SQL IMMUTABLE STRICT AS $$
        SELECT $1;
$$;
 
CREATE AGGREGATE public.FIRST (
        sfunc    = public.first_agg,
        basetype = anyelement,
        stype    = anyelement
);

CREATE OR REPLACE FUNCTION _final_median(NUMERIC[])
   RETURNS NUMERIC AS
$$
   SELECT AVG(val)
   FROM (
     SELECT val
     FROM unnest($1) val
     ORDER BY 1
     LIMIT  2 - MOD(array_upper($1, 1), 2)
     OFFSET CEIL(array_upper($1, 1) / 2.0) - 1
   ) sub;
$$
LANGUAGE 'sql' IMMUTABLE;
 
CREATE AGGREGATE median(NUMERIC) (
  SFUNC=array_append,
  STYPE=NUMERIC[],
  FINALFUNC=_final_median,
  INITCOND='{}'
);

create type jore.terminal_name as (
  terminal_id character varying(7),
  name_fi character varying(40),
  name_se character varying(40),
  lon numeric,
  lat numeric,
  type character varying(2)
);

CREATE OR REPLACE FUNCTION jore.get_terminalnames(
  date date,
  min_lat double precision,
  min_lon double precision,
  max_lat double precision,
  max_lon double precision
) RETURNS setof jore.terminal_name AS $$
SELECT
  terminal_id,
  first(name_fi),
  first(name_se),
  first(lon),
  first(lat),
  first(type)
FROM (
  SELECT
    terminal.terminal_id as terminal_id,
    terminal.lat as lat,
    terminal.lon as lon,
    stop.name_fi as name_fi,
    stop.name_se as name_se,
    route.type as type
  FROM
    jore.terminal terminal,
    jore.stop stop,
    jore.route_segment segment,
    jore.route route
  WHERE terminal.terminal_id = stop.terminal_id
  AND stop.stop_id = segment.stop_id
  AND segment.route_id = route.route_id
  AND (route.type = '12' OR route.type = '06')
  AND ST_Intersects(terminal.point, ST_MakeEnvelope(min_lon, min_lat, max_lon, max_lat, 4326))
  AND date between route.date_begin and route.date_end 
) terminals
GROUP BY terminals.terminal_id
$$ language sql stable;

CREATE OR REPLACE FUNCTION jore.get_route_angles_at_point(
  date date,
  lat double precision,
  lon double precision
) RETURNS INTEGER[] AS $$
  SELECT
    array_agg(angle) as angles
  FROM (
    SELECT
      (Floor(degrees(ST_Azimuth(
        ST_LineInterpolatePoint(geom, 0),
        ST_LineInterpolatePoint(geom, 1)
      )))::INTEGER) AS angle
    FROM (
      SELECT
        ST_Intersection(buf.geom, geom.geom) as geom
      FROM (
        SELECT
          ST_Buffer(
            ST_SetSRID(ST_MakePoint(lon,lat),4326),
            0.001
          ) geom
      ) as buf
      LEFT JOIN (
        SELECT
          geom,
          route_id
        FROM jore.geometry
        WHERE 
          date between date_begin and date_end
      ) as geom
      ON ST_Intersects(buf.geom, geom.geom)
      GROUP BY buf.geom, geom.geom
    ) sections
    GROUP BY angle
  ) angle
$$ language sql stable;

CREATE OR REPLACE FUNCTION jore.get_road_points_clustered_on_distance(
  date date,
  min_lat double precision,
  min_lon double precision,
  max_lat double precision,
  max_lon double precision,
  cluster_distance decimal
) RETURNS Table(point geometry, length float) AS $$
SELECT
  ST_LineInterpolatePoint(geom, 0.5) as point,
  ST_Length(ST_Transform(geom, 3067)) as length
FROM (
  SELECT
    geom
  FROM (
    SELECT
      (ST_DUMP(
        ST_SPLIT(
          route.geom, road_intersections.points
        )
      )).geom AS geom
    FROM
    (
      SELECT geometry.geom
      FROM jore.geometry geometry
      LEFT JOIN jore.route route
      ON geometry.route_id = route.route_id
      WHERE 
        date between geometry.date_begin and geometry.date_end
        AND (geometry.route_id != '31M1' AND geometry.route_id != '31M2')
        AND route.type != '21'
        AND route.type != '06'
        AND route.type != '12'
        AND ST_Intersects(geometry.geom, ST_MakeEnvelope(min_lon, min_lat, max_lon, max_lat, 4326))
    ) route
    LEFT JOIN
    (
      SELECT
        ST_Union(point) AS points
      FROM
        jore.point_geometry
      WHERE
        node_type = 'X'
        AND ST_Intersects(point, ST_MakeEnvelope(min_lon, min_lat, max_lon, max_lat, 4326))
    ) road_intersections
    ON ST_INTERSECTS(route.geom, road_intersections.points)
  ) unfiltered_route_sections
  INNER JOIN
  (
    SELECT
      ST_Union(point) as points
    FROM
      jore.stop
    WHERE
      ST_Intersects(point, ST_MakeEnvelope(min_lon, min_lat, max_lon, max_lat, 4326))
  ) stops
  ON ST_Distance(unfiltered_route_sections.geom, stops.points) < 0.0002
) road_sections
WHERE ST_Length(ST_Transform(geom, 3067)) > 50
GROUP BY geom
$$ language sql stable;

CREATE OR REPLACE FUNCTION jore.route_section_intermediates(
  date date,
  min_lat double precision,
  min_lon double precision,
  max_lat double precision,
  max_lon double precision
) RETURNS setof jore.section_intermediate AS $$
SELECT
  routes,
  lon,
  lat,
  jore.get_route_angles_at_point(date, lat, lon) as angles,
  length
FROM (
  SELECT
    routes,
    ST_X(point)::numeric as lon,
    ST_Y(point)::numeric as lat,
    length::numeric as length
  FROM
  (
    SELECT
      point,
      routes,
      length
    FROM (
      SELECT
        ST_GeometryN(
          geom_collection,
          1
        ) as point,
        routes,
        length
      FROM (
        SELECT
          unnest(
            ST_ClusterWithin(points_grouped_on_routes.point, 0.01)
          ) as geom_collection,
          routes,
          max(length) as length
        FROM (
          SELECT *
          FROM (
            SELECT
              array_sort(array_agg(DISTINCT route_id)) AS routes,
              road_points.point AS point,
              max(road_points.length) AS length
            FROM jore.get_road_points_clustered_on_distance(date, min_lat, min_lon, max_lat, max_lon, 0.001) road_points
            LEFT JOIN
            (
              SELECT
                geometry.route_id,
                geom
              FROM 
                jore.geometry geometry,
                jore.route route
              WHERE
                geometry.route_id = route.route_id
                AND route.type != '21'
                AND route.type != '06'
                AND route.type != '12'
                AND date between geometry.date_begin and geometry.date_end
                AND ST_Intersects(geom, ST_MakeEnvelope(min_lon, min_lat, max_lon, max_lat, 4326))
            ) route
            ON ST_Distance(route.geom, road_points.point) < 0.0002
            GROUP BY point
            ) points
          ORDER BY length DESC
        ) points_grouped_on_routes
        GROUP BY routes
      ) geom_collections
    ) geom_points
  ) clustered_points_based_on_routes
  WHERE ST_Intersects(point, ST_MakeEnvelope(min_lon, min_lat, max_lon, max_lat, 4326))
  GROUP BY point, routes, length
) intermediate_points
$$ language sql stable;

create type jore.terminus as (
  line_id character varying(6),
  stop_id character varying(6),
  lat numeric(9,6),
  lon numeric(9,6),
  stop_short_id character varying(6),
  stop_area_id character varying(6),
  terminal_id character varying(6)
);

create type jore.terminus_grouped as (
  lines character varying(6)[],
  lat numeric(9,6),
  lon numeric(9,6),
  stop_area_id character varying(6),
  terminal_id character varying(6),
  name_fi character varying(40),
  name_se character varying(40)
);

create or replace function jore.terminus_by_date_and_bbox(
  date date,
  min_lat double precision,
  min_lon double precision,
  max_lat double precision,
  max_lon double precision
  ) returns setof jore.terminus as $$
  select 
    r.route_id AS line_id,
    s.stop_id AS stop_id,
    s.lat AS lat,
    s.lon AS lon,
    s.short_id AS stop_short_id,
    s.stop_area_id AS stop_area_id,
    s.terminal_id AS terminal_id
  from
    jore.stop s,
    jore.route r,
    jore.route_segment rs
  where
    rs.route_id = r.route_id AND
    rs.stop_index = '1' AND
    rs.stop_id = s.stop_id AND
    r.type != '21' AND
    date between rs.date_begin and rs.date_end AND
    s.point && ST_MakeEnvelope(min_lon, min_lat, max_lon, max_lat, 4326);

$$ language sql stable;

create or replace function jore.terminus_by_date_and_bbox_grouped(
  date date,
  min_lat double precision,
  min_lon double precision,
  max_lat double precision,
  max_lon double precision
) returns setof jore.terminus_grouped as $$
SELECT
  terminus.lines,
  terminus.lat,
  terminus.lon,
  terminus.stop_area_id,
  terminus.terminal_id,
  terminal.name_fi as name_fi,
  terminal.name_se as name_se
FROM (
  SELECT
    array_agg(line_id) as lines,
    avg(lat) as lat,
    avg(lon) as lon,
    stop_area_id,
    terminal_id
  FROM
    jore.terminus_by_date_and_bbox(date, min_lat, min_lon, max_lat, max_lon)
  GROUP BY stop_area_id, terminal_id
) terminus
LEFT JOIN (
  SELECT
    terminal_id,
    name_fi,
    name_se
  FROM
    jore.terminal
) terminal
ON terminus.terminal_id = terminal.terminal_id
$$ language sql stable;

create function jore.departure_is_regular_day_departure(departure jore.departure) returns boolean as $$
    begin
        return departure.day_type in ('Ma', 'Ti', 'Ke', 'To', 'Pe', 'La', 'Su')
        and departure.extra_departure is distinct from 'L';
    end
$$ language plpgsql immutable;

create function jore.stop_departures_for_date(stop jore.stop, date date) returns setof jore.departure as $$
  select *
  from jore.departure departure
  where departure.stop_id = stop.stop_id
    and case when date is null then true else date between date_begin and date_end end;
$$ language sql stable;

create function jore.stop_route_segments_for_date(stop jore.stop, date date) returns setof jore.route_segment as $$
  select *
  from jore.route_segment route_segment
  where route_segment.stop_id = stop.stop_id
    and case when date is null then true else date between route_segment.date_begin and route_segment.date_end end;
$$ language sql stable;

create function jore.route_has_regular_day_departures(route jore.route, date date) returns boolean as $$
  select exists (
      select true
      from jore.departure departure
      where route.route_id = departure.route_id
        and route.direction = departure.direction
        and route.date_begin <= departure.date_end
        and route.date_end >= departure.date_begin
        and departure.stop_role = 1
        and jore.departure_is_regular_day_departure(departure)
        and case when date is null then true else date between departure.date_begin and departure.date_end end
    );
$$ language sql stable;

create function jore.route_segment_has_regular_day_departures(route_segment jore.route_segment, date date) returns boolean as $$
  select exists (
      select true
      from jore.departure departure
      where route_segment.route_id = departure.route_id
        and route_segment.direction = departure.direction
        and route_segment.date_begin <= departure.date_end
        and route_segment.date_end >= departure.date_begin
        and route_segment.stop_id = departure.stop_id
        and jore.departure_is_regular_day_departure(departure)
        and case when date is null then true else date between departure.date_begin and departure.date_end end
    );
$$ language sql stable;

create function jore.route_line(route jore.route) returns setof jore.line as $$
  select *
  from jore.line line
  where route.route_id like (line.line_id || '%')
  order by line.line_id desc
  limit 1;
$$ language sql stable;
-- TODO: investigate why we have to return a setof here

create function jore.route_segment_line(route_segment jore.route_segment) returns setof jore.line as $$
  select *
  from jore.line line
  where route_segment.route_id like (line.line_id || '%')
  order by line.line_id desc
  limit 1;
$$ language sql stable;
-- TODO: investigate why we have to return a setof here

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
-- TODO: investigate why we have to return a setof here

create function jore.route_departure_notes(route jore.route, date date) returns jore.note as $$
  select *
  from jore.note note
  where note.line_id in (select line_id from jore.route_line(route))
    and route.date_begin <= note.date_end
    and route.date_end >= note.date_begin
    and case when date is null then true else date between note.date_begin and note.date_end end;
$$ language sql stable;

create function jore.route_segment_departure_notes(route_segment jore.route_segment, date date) returns jore.note as $$
  select *
  from jore.note note
  where note.line_id in (select line_id from jore.route_segment_line(route_segment))
    and route_segment.date_begin <= note.date_end
    and route_segment.date_end >= note.date_begin
    and case when date is null then true else date between note.date_begin and note.date_end end;
$$ language sql stable;

create function jore.line_notes(line jore.line, date date) returns setof jore.note as $$
  select *
  from jore.note note
  where line.line_id = note.line_id
    and (
      (note.date_begin is null or note.date_begin <= line.date_end)
      and (note.date_end is null or note.date_end >= line.date_begin)
      and case when date is null then true else (
          (note.date_begin is null or note.date_begin <= date)
          and (note.date_end is null or note.date_end >= date)
      ) end
    )
$$ language sql stable;

create function jore.route_segment_next_stops(route_segment jore.route_segment) returns setof jore.route_segment as $$
  select *
  from jore.route_segment inner_route_segment
  where route_segment.route_id = inner_route_segment.route_id
    and route_segment.direction = inner_route_segment.direction
    and route_segment.date_begin = inner_route_segment.date_begin
    and route_segment.date_end = inner_route_segment.date_end
    and route_segment.stop_index < inner_route_segment.stop_index;
$$ language sql stable;

create function jore.route_route_segments(route jore.route) returns setof jore.route_segment as $$
  select *
  from jore.route_segment route_segment
  where route.route_id = route_segment.route_id
    and route.direction = route_segment.direction
    and route.date_begin <= route_segment.date_end
    and route.date_end >= route_segment.date_begin;
$$ language sql stable;

create function jore.route_departures(route jore.route) returns setof jore.departure as $$
  select *
  from jore.departure departure
  where route.route_id = departure.route_id
    and route.direction = departure.direction
    and route.date_begin <= departure.date_end
    and route.date_end >= departure.date_begin;
$$ language sql stable;

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
    end;
$$ language sql immutable;

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

create function jore.route_segment_notes(route_segment jore.route_segment, date date) returns setof jore.note as $$
  select note
  from jore.note note
  where note.line_id = (select line_id from jore.route_segment_line(route_segment))
    and (note.date_begin is null or note.date_begin <= route_segment.date_end)
    and (note.date_end is null or note.date_end >= route_segment.date_begin)
    and case when date is null then true else (
      (note.date_begin is null or note.date_begin <= date)
      and (note.date_end is null or note.date_end >= date)
   ) end;
$$ language sql stable;

create type jore.geometry_with_date as (
  geometry jsonb,
  date_begin date,
  date_end date
);

create function jore.route_geometries(route jore.route, date date) returns setof jore.geometry_with_date as $$
  select ST_AsGeoJSON(geometry.geom)::jsonb, date_begin, date_end
  from jore.geometry geometry
  where route.route_id = geometry.route_id
    and route.direction = geometry.direction
    and route.date_begin <= geometry.date_end
    and route.date_end >= geometry.date_begin
    and case when date is null then true else date between geometry.date_begin and geometry.date_end end;
$$ language sql stable;

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

create type jore.stop_grouped as (
  short_id     character varying(6),
  name_fi      character varying(20),
  name_se      character varying(20),
  lat          numeric(9,6),
  lon          numeric(9,6),
  stop_ids     character varying(7)[]
);

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

create or replace function jore.regular_stop_grouped_by_short_id_by_bbox(
  min_lat double precision,
  min_lon double precision,
  max_lat double precision,
  max_lon double precision
) returns setof jore.stop_grouped as $$
  select stop.short_id, stop.name_fi, stop.name_se, stop.lat, stop.lon, array_agg(stop.stop_id)
  from jore.stop stop
  where EXISTS (
      SELECT departure.stop_id
      FROM jore.departure departure
      INNER JOIN jore.route route
      ON departure.route_id = route.route_id
      WHERE stop.stop_id = departure.stop_id
      AND route.type != '21'
  )
  AND stop.point && ST_MakeEnvelope(min_lon, min_lat, max_lon, max_lat, 4326)
  group by stop.short_id, stop.name_fi, stop.name_se, stop.lat, stop.lon;
$$ language sql stable;

create function jore.stop_grouped_stops(stop_grouped jore.stop_grouped) returns setof jore.stop as $$
  select stop
  from jore.stop
  where stop.stop_id = any(stop_grouped.stop_ids);
$$ language sql stable;

create function jore.stop_siblings(stop jore.stop) returns setof jore.stop as $$
  select *
  from jore.stop original_stop
  where original_stop.short_id = stop.short_id
    and original_stop.name_fi = stop.name_fi
    and original_stop.name_se is not distinct from stop.name_se
    and original_stop.lat = stop.lat
    and original_stop.lon = stop.lon;
$$ language sql stable;

create function jore.terminal_siblings(terminal jore.terminal) returns setof jore.terminal as $$
  select terminal_to.*
  from jore.terminal_group terminal_group
  join jore.terminal terminal_to on terminal_to.terminal_id = terminal_group.terminal_id_to
  where terminal_group.terminal_id_from = terminal.terminal_id;
$$ language sql stable;

create or replace function jore.stop_modes(stop jore.stop, date date) returns setof jore.mode as $$
  select distinct jore.route_mode(jore.route_segment_route(route_segment, date))
  from jore.stop_route_segments_for_date(stop, date) route_segment;
$$ language sql stable;

create function jore.terminal_modes(terminal jore.terminal, date date) returns setof jore.mode as $$
  select distinct jore.stop_modes(stop, date)
  from jore.stop stop
  where stop.terminal_id = terminal.terminal_id;
$$ language sql stable;

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
          ST_AsGeoJSON(geom)::jsonb as geometry,
          json_build_object(
            'route_id', route_id,
            'direction', direction,
            'date_begin', date_begin,
            'date_end', date_end,
            'mode', mode
          ) as properties
        from jore.geometry geometry
        where date between geometry.date_begin and geometry.date_end
        and case when
          min_lat is null or
          max_lat is null or
          min_lon is null or
          max_lon is null
        then
          true
        else
          geometry.geom &&
          ST_MakeEnvelope(min_lon, min_lat, max_lon, max_lat, 4326)
        end and exists (
          select 1
          from jore.departure departure
          where departure.route_id = geometry.route_id
            and departure.direction = geometry.direction
            and jore.departure_is_regular_day_departure(departure)
            and date between departure.date_begin and departure.date_end
          )
      ) as f
    ) as fc
$$ language sql stable;

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
