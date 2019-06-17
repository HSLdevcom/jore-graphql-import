# FROM hsldevcom/jore-geometry-match

FROM node:12

### RUN THE APP

WORKDIR ${WORK}
RUN cd ${WORK}

# Install app dependencies
COPY package.json ${WORK}
COPY yarn.lock ${WORK}

# Copy the env file for production
COPY .env.production ${WORK}/.env

RUN yarn install

# Copy app source
COPY . ${WORK}
CMD yarn run start:production
