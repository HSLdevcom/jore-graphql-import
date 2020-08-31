# Jore GraphQL importer

Data importer for [jore-graphql](https://github.com/HSLdevcom/jore-graphql)

Read more about the [JORE import process](https://github.com/HSLdevcom/hsl-map-documentation/blob/master/Process%20schema/README.md#jore-import-process).


### Prerequisites

Start a generic postgis docker (or use [hsl-jore-postgis](https://github.com/HSLdevcom/hsl-jore-postgis)) container using:
```
docker run --name jore-postgis -e POSTGRES_PASSWORD=mysecretpassword -d mdillon/postgis
```

Add `-v ./postgres-data:/var/lib/postgresql/data` to the command above to make sure that the database is persisted.
It is not needed for production as docker-compose handles volumes there.

### Install

Build the container:
```
docker build -t hsldevcom/jore-graphql-import .
```

### Run

Start the import process and a simple web UI running in http://localhost/jore-import/

If in Swarm mode, Docker environment variables are by default read from [Docker secrets](https://docs.docker.com/engine/swarm/secrets/). If no Docker secret is found, the value is read from .env file defaults instead. The default values can be overridden by passing them as command line arguments like in example below:
```
docker run --link jore-postgis -v downloads:/tmp/build \
-e USERNAME="ftpusername" \
-e PASSWORD="ftppassword" \
-e "PG_CONNECTION_STRING=postgres:postgres:mysecretpassword@jore-postgis:5432/postgres" \
-e AZURE_STORAGE_ACCOUNT="secret" \
-e AZURE_STORAGE_KEY="secret" \
-e ADMIN_PASSWORD="secret" \
-e SLACK_WEBHOOK_URL="secret" \
hsldevcom/jore-graphql-import
```
