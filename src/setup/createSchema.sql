drop schema if exists jore cascade;
create schema jore;
GRANT ALL ON SCHEMA jore TO postgres;
GRANT ALL ON SCHEMA public TO postgres;

create schema if not exists jorestatic;

create type jore.mode as ENUM ('BUS', 'TRAM', 'RAIL', 'SUBWAY', 'FERRY');

CREATE TABLE IF NOT EXISTS import_status
(
    filename     VARCHAR(255) PRIMARY KEY,
    import_start TIMESTAMP NOT NULL DEFAULT now(),
    import_end   TIMESTAMP,
    success      BOOLEAN            DEFAULT FALSE,
    duration     INTEGER            DEFAULT 0
);
