FROM node:6

RUN apt-get update && DEBIAN_FRONTEND=noninteractive apt-get install -y unzip

ENV WORK /opt/jore

# Create app directory
RUN mkdir -p ${WORK}
WORKDIR ${WORK}

# Install app dependencies
COPY package.json ${WORK}
RUN npm install

# Bundle app source
COPY . ${WORK}

# Fetch and import data
RUN curl http://dev.hsl.fi/infopoiminta/latest/all.zip > all.zip && \
  unzip all.zip -d ${WORK}/data/src && \
  node --max_old_space_size=4096 scripts/importPostgis.js

EXPOSE 5000

CMD node_modules/.bin/postgraphql -c $PG_CONNECTION_STRING --schema jore --disable-default-mutations --dynamic-json --cors
