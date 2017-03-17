FROM node:7

RUN apt-get update && DEBIAN_FRONTEND=noninteractive apt-get install -y unzip

ENV WORK /opt/jore

# Create app directory
RUN mkdir -p ${WORK}
WORKDIR ${WORK}

# Install app dependencies
COPY package.json ${WORK}
RUN npm install

# Copy app source
COPY . ${WORK}

EXPOSE 5000

# Fetch and import data
CMD curl http://dev.hsl.fi/infopoiminta/latest/all.zip > all.zip && \
  unzip all.zip -d ${WORK}/data && \
  npm run import
