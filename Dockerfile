FROM node:18-buster-slim

ENV IMPORTER_DIR /opt/jore
ENV PG_CONNECTION_STRING="postgres://postgres:password@postgres:5432/postgres"
ENV NODE_ENV production
ENV NODE_OPTIONS "--max-old-space-size=8196"

WORKDIR ${IMPORTER_DIR}

# Install app dependencies
COPY package.json yarn.lock ${IMPORTER_DIR}/

ARG BUILD_ENV=latest
COPY .env.${BUILD_ENV} ${IMPORTER_DIR}/.env

RUN yarn install && yarn cache clean

# Copy app source
COPY . ${IMPORTER_DIR}
CMD yarn run start
