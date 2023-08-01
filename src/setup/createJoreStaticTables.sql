
-- jorestatic-tables. They are related to map generation, but it simplifies database setup if they are defined here.

CREATE TABLE IF NOT EXISTS jorestatic.intermediate_points
(
    routes    character varying[],
    lon       numeric,
    lat       numeric,
    angles    integer[],
    length    numeric,
    point     geometry,
    nearbuses boolean,
    tag       date
);

CREATE TABLE IF NOT EXISTS jorestatic.intermediate_points_status
(
    "name" varchar(255) NOT NULL,
    target_date date NOT NULL,
    status text NULL,
    created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT intermediate_points_status_pkey PRIMARY KEY (name),
    CONSTRAINT intermediate_points_status_status_check CHECK ((status = ANY (ARRAY['READY'::text, 'PENDING'::text, 'ERROR'::text, 'EMPTY'::text])))
);
