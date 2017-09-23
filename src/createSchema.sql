drop schema if exists jore cascade;
create schema jore;

create type jore.mode as ENUM ('BUS', 'TRAM', 'RAIL', 'SUBWAY', 'FERRY');
