INSERT INTO jore.geometry
SELECT
  route_id,
  direction,
  date_begin,
  date_end,
  jore.route_mode((
    select route
    from jore.route route
    where geometry.route_id = route.route_id
      and geometry.direction = route.direction
      and route.date_begin <= geometry.date_end
      and route.date_end >= geometry.date_begin
  )) as mode,
  ST_MakeLine(point order by index asc) as geom,
  0 as outliers, /* TODO: remove */
  0 as min_likelihood, /* TODO: remove */
  0 as confidence
FROM jore.point_geometry geometry
GROUP BY route_id, direction, date_begin, date_end;

CREATE INDEX ON jore.geometry USING GIST (geom);
