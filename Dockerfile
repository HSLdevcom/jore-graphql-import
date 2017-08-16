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
CMD curl http://dev.hsl.fi/hse/netti_kesa.zip > all.zip && \
  unzip all.zip -d ${WORK}/data && \
  sed -i '/^\r$/d' ${WORK}/data/linja3.dat && \
  sed -i 's|Kultareuna                            66|  Kultareuna                              66|g' ${WORK}/data/pysakkialue.dat && \
  sed -i 's|Ala-Malmin tori                       66|  Ala-Malmin tori                         66|g' ${WORK}/data/pysakkialue.dat && \
  npm run import
