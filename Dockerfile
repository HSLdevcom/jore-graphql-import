FROM hsldevcom/infodevops-docker-base-images:1.1.0-24-node AS production

SHELL ["/bin/bash", "-o", "pipefail", "-c"]

ENV IMPORTER_DIR=/opt/jore
ENV NODE_ENV=production

# pg_dump / pg_restore for the DB dump backup and restore
RUN apt-get update \
  && DEBIAN_FRONTEND=noninteractive apt-get install -yq curl gnupg lsb-release --no-install-recommends \
  && curl -fsSL https://www.postgresql.org/media/keys/ACCC4CF8.asc | gpg --dearmor -o /etc/apt/trusted.gpg.d/postgresql.gpg \
  && echo "deb http://apt.postgresql.org/pub/repos/apt/ $(lsb_release -cs)-pgdg main" > /etc/apt/sources.list.d/pgdg.list \
  && apt-get update \
  && DEBIAN_FRONTEND=noninteractive apt-get install -yq postgresql-client-14 --no-install-recommends \
  && rm -rf /var/lib/apt/lists/*

RUN mkdir -p ${IMPORTER_DIR} && chown node:node ${IMPORTER_DIR}
WORKDIR ${IMPORTER_DIR}
USER node

# Install app dependencies
COPY --chown=node:node package.json package-lock.json ${IMPORTER_DIR}/
RUN npm ci --omit=dev && npm cache clean --force

ARG BUILD_ENV=latest
COPY --chown=node:node .env.${BUILD_ENV} ${IMPORTER_DIR}/.env

# Copy app source
COPY --chown=node:node . ${IMPORTER_DIR}

EXPOSE 3002

CMD ["node", "-r", "dotenv/config", "src/index.js"]
