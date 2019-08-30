create schema if not exists jore;
GRANT ALL ON SCHEMA jore TO CURRENT_USER;

DO
$$
    BEGIN
        CREATE TYPE jore.MODE AS ENUM ('BUS', 'TRAM', 'RAIL', 'SUBWAY', 'FERRY');
    EXCEPTION
        WHEN duplicate_object THEN NULL;
    END
$$;
