#!/bin/bash
set -e

ORG=${ORG:-hsldevcom}
DOCKER_TAG=${TRAVIS_BUILD_NUMBER:-latest}
DOCKER_IMAGE=$ORG/jore-graphql-import:${DOCKER_TAG}
DOCKER_IMAGE_LATEST=$ORG/jore-graphql-import:latest

docker build -t $DOCKER_IMAGE .

docker tag $DOCKER_IMAGE $DOCKER_IMAGE_LATEST
docker push $DOCKER_IMAGE_LATEST
