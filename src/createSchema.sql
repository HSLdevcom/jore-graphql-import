drop schema if exists jore cascade;
create schema jore;

create schema if not exists jorestatic;

create type jore.mode as ENUM ('BUS', 'TRAM', 'RAIL', 'SUBWAY', 'FERRY');
