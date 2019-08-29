
create index on jore.departure (route_id, direction) where stop_role = 1;
create index on jore.departure (route_id, direction, stop_id);

CREATE OR REPLACE FUNCTION array_sort (ANYARRAY)
  RETURNS ANYARRAY LANGUAGE SQL
  AS $$
  SELECT ARRAY(SELECT unnest($1) ORDER BY 1)
$$;

-- Creating empty table to keep postgres happy
CREATE TABLE IF NOT EXISTS jorestatic.intermediate_points (
  routes character varying[],
  lon numeric,
  lat numeric,
  angles integer[],
  length numeric,
  point geometry,
  nearbuses boolean
);

-- Creating empty table to keep postgres happy
CREATE TABLE IF NOT EXISTS jorestatic.status
(
    name varchar(128),
    target_date date,
    status text,
    created_at timestamp with time zone default CURRENT_TIMESTAMP,
    updated_at timestamp with time zone default CURRENT_TIMESTAMP
);

DO
$$
    BEGIN
        create type jore.section_intermediate as (
            routes character varying(6)[],
            lon numeric,
            lat numeric,
            angles integer[],
            length numeric
            );
    EXCEPTION
        WHEN duplicate_object THEN null;
    END
$$;


DO
$$
    BEGIN
        create type jore.section_intermediate_with_geometry as (
            routes character varying(6)[],
            lon numeric,
            lat numeric,
            angles integer[],
            length numeric,
            point geometry
            );
    EXCEPTION
        WHEN duplicate_object THEN null;
    END
$$;

CREATE OR REPLACE FUNCTION public.first_agg ( anyelement, anyelement )
RETURNS anyelement LANGUAGE SQL IMMUTABLE STRICT AS $$
        SELECT $1;
$$;

DROP AGGREGATE IF EXISTS public.FIRST(anyelement);
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

DROP AGGREGATE IF EXISTS median(numeric);
CREATE AGGREGATE median(NUMERIC) (
  SFUNC=array_append,
  STYPE=NUMERIC[],
  FINALFUNC=_final_median,
  INITCOND='{}'
);

DO
$$
    BEGIN
        create type jore.station as (
            name_fi character varying(40),
            name_se character varying(40),
            lon numeric,
            lat numeric,
            type character varying(2)
            );
    EXCEPTION
        WHEN duplicate_object THEN null;
    END
$$;

CREATE OR REPLACE FUNCTION jore.get_stations(
  date date,
  min_lat double precision,
  min_lon double precision,
  max_lat double precision,
  max_lon double precision
) RETURNS setof jore.station AS $$
(SELECT
  first(name_fi),
  first(name_se),
  first(lon),
  first(lat),
  first(type)
FROM (
  SELECT
    stop.lat as lat,
    stop.lon as lon,
    stop.name_fi as name_fi,
    stop.name_se as name_se,
    route.type as type
  FROM
    jore.stop stop,
    jore.route_segment route_segment,
    jore.route route
  WHERE
    stop.stop_id = route_segment.stop_id
    AND route_segment.route_id = route.route_id
    AND (type = '12' OR type = '06' OR type = '07' )
    AND date between route.date_begin and route.date_end
    AND ST_Intersects(stop.point, ST_MakeEnvelope(min_lon, min_lat, max_lon, max_lat, 4326))
) stations
GROUP BY name_fi)
UNION ALL
(
SELECT
  first(name_fi),
  first(name_se),
  first(lon),
  first(lat),
  first(type)
FROM (
  SELECT
    stop.lat as lat,
    stop.lon as lon,
    stop.name_fi as name_fi,
    stop.name_se as name_se,
    route.type as type,
    terminal.terminal_id as terminal_id
  FROM
    jore.stop stop,
    jore.route_segment route_segment,
    jore.route route,
    jore.terminal terminal
  WHERE
    stop.stop_id = route_segment.stop_id
    AND route_segment.route_id = route.route_id
    AND terminal.terminal_id = stop.terminal_id
    AND stop.terminal_id IS NOT NULL
    AND type = '01'
    AND date between route.date_begin and route.date_end
    AND date between route_segment.date_begin and route_segment.date_end
    AND ST_Intersects(stop.point, ST_MakeEnvelope(min_lon, min_lat, max_lon, max_lat, 4326))
) stations
GROUP BY terminal_id
)
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
        ST_LineInterpolatePoint(geom, 0.4),
        ST_LineInterpolatePoint(geom, 0.6)
      )))::INTEGER) AS angle
    FROM (
      SELECT
        ST_Intersection(buf.geom, geom.geom) as geom
      FROM (
        SELECT
          ST_Transform(ST_Buffer(
            ST_Transform(ST_SetSRID(ST_MakePoint(lon,lat),4326), 3067),
            100
          ), 4326) geom
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
    WHERE GeometryType(geom) = 'LINESTRING'
    GROUP BY angle
  ) angle
$$ language sql stable;

CREATE OR REPLACE FUNCTION jore.get_road_points_clustered(
  date date,
  nearBuses boolean
) RETURNS Table(point geometry, length float) AS $$
SELECT
  first(point) as point,
  max(length) as length
FROM (
  SELECT
    ST_ClusterDBSCAN(point, eps := 30, minpoints := 1) over () AS cid,
    point,
    length
  FROM (
    SELECT
      ST_LineInterpolatePoint(geom, 0.5) as point,
      ST_Length(geom) as length
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
          SELECT
            ST_Transform(geometry.geom, 3067) as geom
          FROM jore.geometry geometry
          LEFT JOIN jore.route route
          ON geometry.route_id = route.route_id
          WHERE
            date between geometry.date_begin and geometry.date_end
            AND geometry.route_id != '31M1'
            AND geometry.route_id != '31M2'
            AND route.route_id NOT LIKE '%X'
            AND route.route_id ~ '^[0-9]*[A-Z]\?$'
            AND route.type != '06'
            AND route.type != '12'
            AND
            CASE
              WHEN nearBuses THEN route.type = '21'
              ELSE route.type != '21'
            END
        ) route
        LEFT JOIN
        (
          SELECT
            ST_Union(ST_Buffer(ST_Transform(point, 3067), 30)) AS points
          FROM
            jore.point_geometry
          WHERE
            node_type = 'X'
        ) road_intersections
        ON ST_INTERSECTS(route.geom, road_intersections.points)
      ) unfiltered_route_sections
      INNER JOIN
      (
        SELECT
          ST_Union(ST_Transform(point, 3067)) as points
        FROM
          jore.stop
      ) stops
      ON ST_Distance(unfiltered_route_sections.geom, stops.points) < 20
    ) road_sections
    WHERE ST_Length(ST_Transform(geom, 3067)) > 40
    GROUP BY geom
  ) midpoints
  INNER JOIN
  (
    SELECT
      ST_Union(ST_Transform(point, 3067)) AS points
    FROM
      jore.point_geometry
    WHERE
      node_type = 'X'
  ) stops
  ON ST_Distance(midpoints.point, stops.points) > 30
) clustered
GROUP BY cid
$$ language sql stable;

DO
$$
    BEGIN
        create type jore.terminus as (
            line_id character varying(6),
            stop_id character varying(6),
            type character varying(6),
            lat numeric(9, 6),
            lon numeric(9, 6),
            stop_short_id character varying(6),
            stop_area_id character varying(6),
            terminal_id character varying(6),
            point geometry
            );
    EXCEPTION
        WHEN duplicate_object THEN null;
    END
$$;

create or replace function jore.get_all_terminuses(
  date date
) returns setof jore.terminus as $$
  select
    r.route_id AS line_id,
    s.stop_id AS stop_id,
    r.type AS type,
    s.lat AS lat,
    s.lon AS lon,
    s.short_id AS stop_short_id,
    s.stop_area_id AS stop_area_id,
    s.terminal_id AS terminal_id,
    s.point AS point
  from
    jore.stop s,
    jore.route r,
    jore.route_segment rs
  where
    rs.route_id = r.route_id AND
    r.route_id NOT LIKE '%X' AND
    r.route_id ~ '^[0-9]*[A-Z]\?$' AND
    rs.stop_index = '1' AND
    rs.stop_id = s.stop_id AND
    r.type != '21' AND
    date between rs.date_begin and rs.date_end
$$ language sql stable;

create or replace function jore.terminus_by_date_and_bbox(
  date date,
  min_lat double precision,
  min_lon double precision,
  max_lat double precision,
  max_lon double precision,
  nearBuses boolean
  ) returns setof jore.terminus as $$
  select
    r.route_id AS line_id,
    s.stop_id AS stop_id,
    r.type AS type,
    s.lat AS lat,
    s.lon AS lon,
    s.short_id AS stop_short_id,
    s.stop_area_id AS stop_area_id,
    s.terminal_id AS terminal_id,
    s.point AS point
  from
    jore.stop s,
    jore.route r,
    jore.route_segment rs
  where
    rs.route_id = r.route_id AND
    r.route_id NOT LIKE '%X' AND
    r.route_id ~ '^[0-9]*[A-Z]\?$' AND
    rs.stop_index = '1' AND
    rs.stop_id = s.stop_id
    AND
    CASE
      WHEN nearBuses THEN r.type = '21'
      ELSE r.type != '21'
    END
    AND date between rs.date_begin and rs.date_end AND
    s.point && ST_MakeEnvelope(min_lon, min_lat, max_lon, max_lat, 4326);
$$ language sql stable;

CREATE OR REPLACE FUNCTION jore.route_section_intermediates(
  date date,
  nearBuses boolean,
  clusterSameWithin numeric
) RETURNS setof jore.section_intermediate_with_geometry AS $$
SELECT
  routes,
  lon,
  lat,
  jore.get_route_angles_at_point(date, lat, lon) as angles,
  length,
  point
FROM (
  SELECT
    routes,
    ST_X(point)::numeric as lon,
    ST_Y(point)::numeric as lat,
    length::numeric as length,
    point
  FROM
  (
    SELECT
      ST_Transform(point, 4326) as point,
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
            ST_ClusterWithin(points_grouped_on_routes.point, clusterSameWithin)
          ) as geom_collection,
          routes,
          max(length) as length
        FROM (
          SELECT
            point,
            routes,
            length
          FROM (
            SELECT
              array_sort(array_agg(DISTINCT route_id)) AS routes,
              road_points.point AS point,
              max(road_points.length) AS length
            FROM (
              SELECT inter.*
              FROM (
                SELECT *
                FROM jore.get_road_points_clustered(date, nearBuses) road_points
              ) inter
              INNER JOIN (
                SELECT
                  ST_Union(ST_Transform(point, 3067)) as points
                FROM jore.get_all_terminuses(date)
              ) terminus_points
              ON ST_Distance(inter.point, terminus_points.points) > 100
            ) road_points
            LEFT JOIN
            (
              SELECT
                geometry.route_id,
                ST_Transform(geom, 3067) as geom
              FROM
                jore.geometry geometry,
                jore.route route
              WHERE
                geometry.route_id = route.route_id
                AND route.type != '06'
                AND route.type != '12'
                AND route.route_id NOT LIKE '%X'
                AND route.route_id ~ '^[0-9]*[A-Z]\?$'
                AND date between geometry.date_begin and geometry.date_end
                AND
                CASE
                  WHEN nearBuses THEN route.type = '21'
                  ELSE route.type != '21'
                END
            ) route
            ON ST_Distance(route.geom, road_points.point) < 20
            GROUP BY point
            ) points
          ORDER BY length DESC
        ) points_grouped_on_routes
        GROUP BY routes
      ) geom_collections
    ) geom_points
  ) clustered_points_based_on_routes
  GROUP BY point, routes, length
) intermediate_points
$$ language sql stable;

CREATE OR REPLACE FUNCTION jore.create_intermediate_points(date date) RETURNS VOID AS $$
    DECLARE
    BEGIN
        IF NOT EXISTS (SELECT * FROM jorestatic.status) THEN
            INSERT INTO jorestatic.status ("target_date", "status", "name") VALUES (date, 'EMPTY', 'config');
        END IF;

        IF EXISTS (SELECT status FROM jorestatic.status WHERE name = 'config' AND status != 'PENDING') THEN

            UPDATE jorestatic.status SET status = 'PENDING' WHERE name = 'config';

            CREATE TABLE IF NOT EXISTS jorestatic.intermediate_points_new
            (
                like jorestatic.intermediate_points including all
            );

            INSERT INTO jorestatic.intermediate_points_new
            (
                SELECT *,
                       false as nearBuses
                FROM jore.route_section_intermediates(date, false, 1000)
            )

            UNION ALL
            (
                SELECT *,
                       true as nearBuses
                FROM jore.route_section_intermediates(date, true, 200)
            );

            DROP TABLE IF EXISTS jorestatic.intermediate_points CASCADE;
            ALTER TABLE jorestatic.intermediate_points_new RENAME TO intermediate_points;

            UPDATE jorestatic.status SET status = 'READY' WHERE name = 'config';
        END IF;
    END;
$$ language plpgsql;

CREATE OR REPLACE FUNCTION jore.get_section_intermediates(
  min_lat double precision,
  min_lon double precision,
  max_lat double precision,
  max_lon double precision,
  only_near_buses boolean
) RETURNS setof jore.section_intermediate AS $$
  SELECT
    routes,
    lon,
    lat,
    angles,
    length
  FROM
    jorestatic.intermediate_points
  WHERE
    ST_Intersects(point, ST_MakeEnvelope(min_lon, min_lat, max_lon, max_lat, 4326))
    AND nearBuses = only_near_buses
$$ language sql stable;

DO
$$
    BEGIN
        create type jore.terminus_grouped as (
            lines character varying(6)[],
            lat numeric(9, 6),
            lon numeric(9, 6),
            stop_area_id character varying(6),
            terminal_id character varying(6),
            type character varying(6),
            name_fi character varying(40),
            name_se character varying(40)
            );
    EXCEPTION
        WHEN duplicate_object THEN null;
    END
$$;

create or replace function jore.get_terminus_by_date_and_bbox_grouped(
  date date,
  min_lat double precision,
  min_lon double precision,
  max_lat double precision,
  max_lon double precision,
  only_near_buses boolean
) returns setof jore.terminus_grouped as $$
SELECT
  terminus.lines,
  terminus.lat,
  terminus.lon,
  terminus.stop_area_id,
  terminus.terminal_id,
  terminus.type,
  terminal.name_fi as name_fi,
  terminal.name_se as name_se
FROM (
  SELECT
    array_agg(line_id) as lines,
    avg(lat) as lat,
    avg(lon) as lon,
    first(type) as type,
    stop_area_id,
    terminal_id
  FROM
    jore.terminus_by_date_and_bbox(date, min_lat, min_lon, max_lat, max_lon, only_near_buses)
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

create or replace function jore.departure_is_regular_day_departure(departure jore.departure) returns boolean as $$
    begin
        return departure.day_type in ('Ma', 'Ti', 'Ke', 'To', 'Pe', 'La', 'Su')
        and departure.extra_departure is distinct from 'L';
    end
$$ language plpgsql immutable;

create or replace function jore.stop_departures_for_date(stop jore.stop, date date) returns setof jore.departure as $$
  select *
  from jore.departure departure
  where departure.stop_id = stop.stop_id
    and case when date is null then true else date between date_begin and date_end end;
$$ language sql stable;

create or replace function jore.stop_route_segments_for_date(stop jore.stop, date date) returns setof jore.route_segment as $$
  select *
  from jore.route_segment route_segment
  where route_segment.stop_id = stop.stop_id
    and case when date is null then true else date between route_segment.date_begin and route_segment.date_end end;
$$ language sql stable;

create or replace function jore.route_has_regular_day_departures(route jore.route, date date) returns boolean as $$
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

create or replace function jore.route_segment_has_regular_day_departures(route_segment jore.route_segment, date date) returns boolean as $$
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

create or replace function jore.route_line(route jore.route) returns setof jore.line as $$
  select *
  from jore.line line
  where route.line_id = line.line_id
  order by line.line_id desc
  limit 1;
$$ language sql stable;
-- TODO: investigate why we have to return a setof here

create or replace function jore.route_segment_line(route_segment jore.route_segment) returns setof jore.line as $$
  select line.*
  from jore.line line
  join jore.route as route on (
    route.line_id = line.line_id
  )
  where route_segment.route_id = route.route_id
  and route.line_id = line.line_id
  order by line.line_id desc
  limit 1;
$$ language sql stable;
-- TODO: investigate why we have to return a setof here

create or replace function jore.route_segment_route(route_segment jore.route_segment, date date) returns setof jore.route as $$
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

create or replace function jore.route_departure_notes(route jore.route, date date) returns jore.note as $$
  select *
  from jore.note note
  where note.line_id in (select line_id from jore.route_line(route))
    and route.date_begin <= note.date_end
    and route.date_end >= note.date_begin
    and case when date is null then true else date between note.date_begin and note.date_end end;
$$ language sql stable;

create or replace function jore.route_segment_departure_notes(route_segment jore.route_segment, date date) returns jore.note as $$
  select *
  from jore.note note
  where note.line_id in (select line_id from jore.route_segment_line(route_segment))
    and route_segment.date_begin <= note.date_end
    and route_segment.date_end >= note.date_begin
    and case when date is null then true else date between note.date_begin and note.date_end end;
$$ language sql stable;

create or replace function jore.line_notes(line jore.line, date date) returns setof jore.note as $$
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

create or replace function jore.route_segment_next_stops(route_segment jore.route_segment) returns setof jore.route_segment as $$
  select *
  from jore.route_segment inner_route_segment
  where route_segment.route_id = inner_route_segment.route_id
    and route_segment.direction = inner_route_segment.direction
    and route_segment.date_begin = inner_route_segment.date_begin
    and route_segment.date_end = inner_route_segment.date_end
    and route_segment.stop_index < inner_route_segment.stop_index;
$$ language sql stable;

create or replace function jore.route_route_segments(route jore.route) returns setof jore.route_segment as $$
  select *
  from jore.route_segment route_segment
  where route.route_id = route_segment.route_id
    and route.direction = route_segment.direction
    and route.date_begin <= route_segment.date_end
    and route.date_end >= route_segment.date_begin;
$$ language sql stable;

create or replace function jore.route_departures(route jore.route) returns setof jore.departure as $$
  select *
  from jore.departure departure
  where route.route_id = departure.route_id
    and route.direction = departure.direction
    and route.date_begin <= departure.date_end
    and route.date_end >= departure.date_begin;
$$ language sql stable;

create or replace function jore.route_mode(route jore.route) returns jore.mode as $$
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

DO
$$
    BEGIN
        create type jore.departure_group as (
            stop_id character varying(7),
            route_id character varying(6),
            direction character varying(1),
            day_type character varying(2)[],
            is_next_day boolean,
            hours integer,
            minutes integer,
            is_accessible boolean,
            date_begin date,
            date_end date,
            stop_role integer,
            note character varying(4),
            vehicle character varying(3)[]
            );
    EXCEPTION
        WHEN duplicate_object THEN null;
    END
$$;

create or replace function jore.route_departures_gropuped(route jore.route, date date) returns setof jore.departure_group as $$
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

create or replace function jore.route_segment_departures_gropuped(route_segment jore.route_segment, date date) returns setof jore.departure_group as $$
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

create or replace function jore.stop_departures_gropuped(stop jore.stop, date date) returns setof jore.departure_group as $$
  select departure.stop_id, departure.route_id, departure.direction, array_agg(departure.day_type), is_next_day,
    departure.hours, departure.minutes, departure.is_accessible, departure.date_begin, departure.date_end,
    departure.stop_role, departure.note, array_agg(departure.vehicle)
  from jore.departure departure
  where stop.stop_id = departure.stop_id
    and case when date is null then true else date between departure.date_begin and departure.date_end end
  group by (departure.stop_id, departure.route_id, departure.direction, departure.is_next_day, departure.hours, departure.minutes,
    departure.is_accessible, departure.date_begin, departure.date_end, departure.stop_role, departure.note);
$$ language sql stable;

create or replace function jore.line_routes(line jore.line) returns setof jore.route as $$
  select *
  from jore.route route
  where route.line_id = line.line_id;
$$ language sql stable;

create or replace function jore.stop_calculated_heading(stop jore.stop) returns numeric as $$
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

create or replace function jore.route_segment_notes(route_segment jore.route_segment, date date) returns setof jore.note as $$
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

DO
$$
    BEGIN
        create type jore.geometry_with_date as (
            geometry jsonb,
            date_begin date,
            date_end date
            );
    EXCEPTION
        WHEN duplicate_object THEN null;
    END
$$;

create or replace function jore.route_geometries(route jore.route, date date) returns setof jore.geometry_with_date as $$
  select ST_AsGeoJSON(geometry.geom)::jsonb, date_begin, date_end
  from jore.geometry geometry
  where route.route_id = geometry.route_id
    and route.direction = geometry.direction
    and route.date_begin <= geometry.date_end
    and route.date_end >= geometry.date_begin
    and case when date is null then true else date between geometry.date_begin and geometry.date_end end;
$$ language sql stable;

create or replace function jore.stops_by_bbox(
  min_lat double precision,
  min_lon double precision,
  max_lat double precision,
  max_lon double precision
) returns setof jore.stop as $$
  select *
  from jore.stop stop
  where stop.point && ST_MakeEnvelope(min_lon, min_lat, max_lon, max_lat, 4326);
$$ language sql stable;

DO
$$
    BEGIN
        create type jore.stop_grouped as (
            short_id character varying(6),
            name_fi character varying(20),
            name_se character varying(20),
            lat numeric(9, 6),
            lon numeric(9, 6),
            stop_ids character varying(7)[]
            );
    EXCEPTION
        WHEN duplicate_object THEN null;
    END
$$;

create or replace function jore.stop_grouped_by_short_id_by_bbox(
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

create or replace function jore.get_stop_grouped_by_short_id_by_bbox_and_date(
  min_lat double precision,
  min_lon double precision,
  max_lat double precision,
  max_lon double precision,
  only_near_buses boolean,
  date date
) returns setof jore.stop_grouped as $$
  select stop.short_id, stop.name_fi, stop.name_se, stop.lat, stop.lon, array_agg(stop.stop_id)
  from
    jore.stop stop,
    jore.route_segment rs,
    jore.route route
  where
    stop.stop_id = rs.stop_id
    and rs.route_id = route.route_id
    and date between route.date_begin and route.date_end
    AND
    CASE
      WHEN only_near_buses THEN route.type = '21'
      ELSE route.type != '21'
    END
    AND stop.point && ST_MakeEnvelope(min_lon, min_lat, max_lon, max_lat, 4326)
    group by stop.short_id, stop.name_fi, stop.name_se, stop.lat, stop.lon;
$$ language sql stable;

create or replace function jore.get_stop_grouped_by_short_id_by_bbox(
  min_lat double precision,
  min_lon double precision,
  max_lat double precision,
  max_lon double precision,
  only_near_buses boolean
) returns setof jore.stop_grouped as $$
  select stop.short_id, stop.name_fi, stop.name_se, stop.lat, stop.lon, array_agg(stop.stop_id)
  from jore.stop stop
  where EXISTS (
      SELECT departure.stop_id
      FROM jore.departure departure
      INNER JOIN jore.route route
      ON departure.route_id = route.route_id
      WHERE stop.stop_id = departure.stop_id
      AND
      CASE
        WHEN only_near_buses THEN route.type = '21'
        ELSE route.type != '21'
      END
  )
  AND stop.point && ST_MakeEnvelope(min_lon, min_lat, max_lon, max_lat, 4326)
  group by stop.short_id, stop.name_fi, stop.name_se, stop.lat, stop.lon;
$$ language sql stable;

create or replace function jore.stop_grouped_stops(stop_grouped jore.stop_grouped) returns setof jore.stop as $$
  select stop
  from jore.stop
  where stop.stop_id = any(stop_grouped.stop_ids);
$$ language sql stable;

create or replace function jore.stop_siblings(stop jore.stop) returns setof jore.stop as $$
  select *
  from jore.stop original_stop
  where original_stop.short_id = stop.short_id
    and original_stop.name_fi = stop.name_fi
    and original_stop.name_se is not distinct from stop.name_se
    and original_stop.lat = stop.lat
    and original_stop.lon = stop.lon;
$$ language sql stable;

create or replace function jore.terminal_siblings(terminal jore.terminal) returns setof jore.terminal as $$
  select terminal_to.*
  from jore.terminal_group terminal_group
  join jore.terminal terminal_to on terminal_to.terminal_id = terminal_group.terminal_id_to
  where terminal_group.terminal_id_from = terminal.terminal_id;
$$ language sql stable;

create or replace function jore.stop_modes(stop jore.stop, date date) returns setof jore.mode as $$
  select distinct jore.route_mode(jore.route_segment_route(route_segment, date))
  from jore.stop_route_segments_for_date(stop, date) route_segment;
$$ language sql stable;

create or replace function jore.terminal_modes(terminal jore.terminal, date date) returns setof jore.mode as $$
  select distinct jore.stop_modes(stop, date)
  from jore.stop stop
  where stop.terminal_id = terminal.terminal_id;
$$ language sql stable;

create or replace function jore.stop_areas_by_bbox(
  min_lat double precision,
  min_lon double precision,
  max_lat double precision,
  max_lon double precision
) returns setof jore.stop_area as $$
  select *
  from jore.stop_area stop_area
  where stop_area.point && ST_MakeEnvelope(min_lon, min_lat, max_lon, max_lat, 4326);
$$ language sql stable;

create or replace function jore.terminals_by_bbox(
  min_lat double precision,
  min_lon double precision,
  max_lat double precision,
  max_lon double precision
) returns setof jore.terminal as $$
  select *
  from jore.terminal terminal
  where terminal.point && ST_MakeEnvelope(min_lon, min_lat, max_lon, max_lat, 4326);
$$ language sql stable;

create or replace function jore.network_by_date_as_geojson(
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

create or replace function jore.point_network_as_geojson() returns json as $$
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
