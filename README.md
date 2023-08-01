# Jore GraphQL importer

Data importer for [jore-graphql](https://github.com/HSLdevcom/jore-graphql)

Read more about the [JORE import process](https://github.com/HSLdevcom/hsl-map-documentation/blob/master/Process%20schema/README.md#jore-import-process).


### Prerequisites

Start a postgres server, e.g. with docker:
```
docker run --name jore-postgis -e POSTGRES_PASSWORD=mysecretpassword -d postgis/postgis
```

Add `-v ./postgres-data:/var/lib/postgresql/data` to the command above to make sure that the database is persisted if wanted.


### Install

Build the container:
```
docker build -t hsldevcom/jore-graphql-import .
```

### Run

Start the import process and a simple web UI running in http://localhost:8000/

If in Swarm mode, Docker environment variables are by default read from [Docker secrets](https://docs.docker.com/engine/swarm/secrets/). If no Docker secret is found, the value is read from .env file defaults instead. The default values can be overridden by passing them as command line arguments like in example below:
```
docker run --link jore-postgis -v downloads:/tmp/build \
-e USERNAME="ftpusername" \
-e PASSWORD="ftppassword" \
-e "PG_CONNECTION_STRING=postgres://postgres:mysecretpassword@jore-postgis:5432" \
-e AZURE_STORAGE_ACCOUNT="secret" \
-e AZURE_STORAGE_KEY="secret" \
-e ADMIN_PASSWORD="secret" \
-e SLACK_WEBHOOK_URL="secret" \
hsldevcom/jore-graphql-import
```
