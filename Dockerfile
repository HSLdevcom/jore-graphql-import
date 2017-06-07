FROM node:7

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

# Fetch and import data
CMD curl http://dev.hsl.fi/hse/netti_talvi_201705300820.zip > all.zip && \
  unzip all.zip -d ${WORK}/data && \
  sed -i '/^\r$/d' ${WORK}/data/linja3.dat && \
  sed -i 's|2001010120030816\r| 2001010120030816\r|g' ${WORK}/data/linteks.dat && \
  sed -i 's|keen./                                                           2010081620130127\r|keen./                                                             2010081620130127\r|g' ${WORK}/data/linteks.dat && \
  npm run import
