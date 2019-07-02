GRANT ALL ON SCHEMA public TO CURRENT_USER;

CREATE TABLE IF NOT EXISTS public.import_status
(
    filename     VARCHAR(255) PRIMARY KEY,
    import_start TIMESTAMP NOT NULL DEFAULT now(),
    import_end   TIMESTAMP,
    success      BOOLEAN            DEFAULT FALSE,
    duration     INTEGER            DEFAULT 0
);
