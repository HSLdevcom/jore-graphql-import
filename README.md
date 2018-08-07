# Jore GraphQL importer

Data importer for [jore-graphql](https://github.com/HSLdevcom/jore-graphql)

### Prerequisites

Start a postgis docker container using:
```
docker run --name jore-postgis -e POSTGRES_PASSWORD=mysecretpassword -d mdillon/postgis
```

### Install

Build the container:
```
docker build -t hsldevcom/jore-graphql-import .
```

### Run

Start the importer:
```
docker run --link jore-postgis -e USERNAME="ftpusername" -e PASSWORD="ftppassword" -v downloads:/tmp/build -e "PG_CONNECTION_STRING=postgres://postgres:mysecretpassword@jore-postgis:5432/postgres" hsldevcom/jore-graphql-import
```
