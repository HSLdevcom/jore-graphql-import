FROM node:12

ENV WORK /opt/jore

RUN apt-get update && \
  apt-get -y install git build-essential protobuf-compiler swig \
  libprotobuf-dev python-dev libreadosm-dev libboost-graph-dev \
  libproj-dev libgoogle-perftools-dev osmctools && \
  rm -rf /var/lib/apt/lists/*

RUN wget https://bootstrap.pypa.io/get-pip.py && \
  python get-pip.py && \
  pip install imposm.parser && \
  pip install argh && \
  pip install pyproj && \
  pip install psycopg2

WORKDIR ${WORK}
# Install app dependencies
COPY package.json ${WORK}
COPY yarn.lock ${WORK}

# Copy the env file for production
COPY .env.production ${WORK}/.env

RUN yarn install

# Copy app source
COPY . ${WORK}
CMD yarn run start:production
