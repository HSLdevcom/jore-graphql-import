FROM node:12-buster-slim

ENV IMPORTER_DIR /opt/jore
ENV MATCHER_DIR=${IMPORTER_DIR}/geometry-matcher
ENV PG_CONNECTION_STRING="postgres://postgres:password@postgres:5432/postgres"
ENV NODE_ENV production
ENV NODE_OPTIONS "--max-old-space-size=8196"

RUN apt-get update && \
  apt-get -y install python git build-essential software-properties-common curl protobuf-compiler python-dev \
    libprotobuf-dev make swig g++ libreadosm-dev libboost-graph-dev libproj-dev \
    libgoogle-perftools-dev osmctools unzip zip wget postgresql-client --no-install-recommends && \
  rm -rf /var/lib/apt/lists/*

RUN curl https://bootstrap.pypa.io/pip/2.7/get-pip.py --output get-pip.py && python get-pip.py

RUN pip install imposm.parser && \
  pip install argh && \
  pip install pyproj && \
  pip install psycopg2-binary

COPY geometry-matcher ${MATCHER_DIR}
RUN cd $MATCHER_DIR && make -C pymapmatch

WORKDIR ${IMPORTER_DIR}

# Install app dependencies
COPY package.json yarn.lock ${IMPORTER_DIR}/

ARG BUILD_ENV=latest
COPY .env.${BUILD_ENV} ${IMPORTER_DIR}/.env

RUN yarn install && yarn cache clean

# Copy app source
COPY . ${IMPORTER_DIR}
CMD yarn run start:production
