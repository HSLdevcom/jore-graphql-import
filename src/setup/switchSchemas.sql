DO
$$
    BEGIN
        DROP SCHEMA IF EXISTS jore CASCADE;
        ALTER SCHEMA jore_new RENAME TO jore;
    END
$$;
