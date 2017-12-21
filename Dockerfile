FROM node:8

RUN apt-get update && DEBIAN_FRONTEND=noninteractive apt-get install -y unzip

ENV WORK /opt/jore

# Create app directory
RUN mkdir -p ${WORK}
WORKDIR ${WORK}

# Install app dependencies
COPY package.json ${WORK}
COPY yarn.lock ${WORK}
RUN yarn install

# Copy app source
COPY . ${WORK}

RUN yarn lint

# Fetch and import data
CMD curl http://dev.hsl.fi/hse/netti_talvi.zip > all.zip && \
  unzip all.zip -d ${WORK}/data && \
  yarn start
