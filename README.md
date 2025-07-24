# Jore GraphQL importer

Data importer for [jore-graphql](https://github.com/HSLdevcom/jore-graphql)

Read more about the [JORE import process](https://github.com/HSLdevcom/hsl-map-documentation/blob/master/Process%20schema/README.md#jore-import-process).

## Development

### Creating custom functions with PostGraphile
When creating a custom function (called "computed column") the naming scheme must adhere to following rules:
[PostGraphile documentation](https://www.graphile.org/postgraphile/computed-columns/)

In short:
- Must adhere to common PostGraphile function restrictions
- Name must begin with the name of the table it applies to, followed by an underscore (_)
- First parameter must be the table type
- Must NOT return VOID
- Must be marked as STABLE (or IMMUTABLE, though that tends to be less common)
- Must be defined in the same PostgreSQL schema as the table

## Prerequisites

### Starting with a new database
Start a postgres server, e.g. with docker:
```
docker run --name jore-postgis -p 5432:5432 -e POSTGRES_PASSWORD=postgres -d postgis/postgis
```
Add `-v ./postgres-data:/var/lib/postgresql/data` to the command above to make sure that the database is persisted if wanted.

### Initializing the local database
Ensure the `.env` file has the `PG_CONNECTION_STRING` variable defined and _*it is pointing to your local database*_.
Next we need to initialize the db before importing any JORE extracts:
```bash
yarn initdb
```

To use geometry matching feature, you also need to start [hsl-map-matcher](https://github.com/HSLdevcom/hsl-map-matcher).

```
docker run --name hsl-map-matcher -p 3000:3000 -d hsldevcom/hsl-map-matcher
```

## Running locally

Install dependencies and start the app:
```
yarn
yarn start
```

A web ui should be running in http://localhost:8000/


## Running on Docker

Build the container:
```
docker build -t hsldevcom/jore-graphql-import .
```


If in Swarm mode, Docker environment variables are by default read from [Docker secrets](https://docs.docker.com/engine/swarm/secrets/). If no Docker secret is found, the value is read from .env file defaults instead. The default values can be overridden by passing them as command line arguments like in example below:
```
docker run --link jore-postgis --link hsl-map-matcher -v downloads:/tmp/build \
-e USERNAME="ftpusername" \
-e PASSWORD="ftppassword" \
-e "PG_CONNECTION_STRING=postgres://postgres:mysecretpassword@jore-postgis:5432" \
-e AZURE_STORAGE_ACCOUNT="secret" \
-e AZURE_STORAGE_KEY="secret" \
-e ADMIN_PASSWORD="secret" \
-e SLACK_WEBHOOK_URL="secret" \
hsldevcom/jore-graphql-import
```

A web UI should be running in http://localhost:8000/
