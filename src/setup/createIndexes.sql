create index on jore.departure (route_id, direction) where stop_role = 1;
create index on jore.departure (route_id, direction, stop_id);
