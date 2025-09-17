FROM node:20-bullseye-slim

ENV IMPORTER_DIR=/opt/jore
ENV NODE_ENV=production

RUN apt-get update \
  && apt-get install -yq curl gnupg lsb-release \
  && curl -fsSL https://www.postgresql.org/media/keys/ACCC4CF8.asc|gpg --dearmor -o /etc/apt/trusted.gpg.d/postgresql.gpg \
  && echo "deb http://apt.postgresql.org/pub/repos/apt/ `lsb_release -cs`-pgdg main" |tee  /etc/apt/sources.list.d/pgdg.list \
  && apt-get update \
  && DEBIAN_FRONTEND=noninteractive apt-get install -yq postgresql-client-14 --no-install-recommends \
  && rm -rf /var/lib/apt/lists/*

WORKDIR ${IMPORTER_DIR}

# Install app dependencies
COPY package.json yarn.lock ${IMPORTER_DIR}/

ARG BUILD_ENV=latest
COPY .env.${BUILD_ENV} ${IMPORTER_DIR}/.env

RUN yarn install && yarn cache clean

# Copy app source
COPY . ${IMPORTER_DIR}
CMD ["yarn", "run", "start"]
