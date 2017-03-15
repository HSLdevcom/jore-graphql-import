# Jore GraphQL importer and server

### Prerequisites

Start a postgis docker container using:
```
docker run --name jore-postgis -e POSTGRES_PASSWORD=mysecretpassword -d mdillon/postgis
```

### Install

Build the two containers:
```
docker build -t hsldevcom/jore-import import/
docker build -t hsldevcom/jore-postgraphql postgraphql/
```

### Run

Start the importer:
```
docker run --link jore-postgis -e "PG_CONNECTION_STRING=postgres://postgres:mysecretpassword@jore-postgis:5432/postgres" hsldevcom/jore-import
```

Start the server:
```
docker run --link jore-postgis -e "PG_CONNECTION_STRING=postgres://postgres:mysecretpassword@jore-postgis:5432/postgres" -P hsldevcom/jore-postgraphql
```
