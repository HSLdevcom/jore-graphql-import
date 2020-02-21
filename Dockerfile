FROM nikolaik/python-nodejs:python2.7-nodejs12

ENV IMPORTER_DIR /opt/jore
ENV MATCHER_DIR=${IMPORTER_DIR}/geometry-matcher
ENV PG_CONNECTION_STRING="postgres://postgres:mysecretpassword@jore-postgis:5432/postgres"

RUN curl -sS https://dl.yarnpkg.com/debian/pubkey.gpg | apt-key add - && \
  apt-get update && \
  apt-get -y install git build-essential software-properties-common curl && \
  # Needs new versions from the Buster repo, otherwise the matcher won't work
  apt-add-repository 'deb http://ftp.us.debian.org/debian buster main contrib non-free' && \
  apt-get update && \
  apt-get -y install protobuf-compiler python-dev \
    libprotobuf-dev make swig g++ libreadosm-dev libboost-graph-dev libproj-dev \
    libgoogle-perftools-dev osmctools unzip zip wget postgresql-client && \
  rm -rf /var/lib/apt/lists/*

RUN pip install imposm.parser && \
  pip install argh && \
  pip install pyproj && \
  pip install psycopg2

COPY geometry-matcher ${MATCHER_DIR}
RUN cd $MATCHER_DIR && make -C pymapmatch

WORKDIR ${IMPORTER_DIR}

# Install app dependencies
COPY package.json ${IMPORTER_DIR}
COPY yarn.lock ${IMPORTER_DIR}

ARG BUILD_ENV=latest
COPY .env.${BUILD_ENV} ${IMPORTER_DIR}/.env

RUN yarn install

# Copy app source
COPY . ${IMPORTER_DIR}
CMD yarn run start:production
