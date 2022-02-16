# syntax=docker/dockerfile:1.2

# manage base versions
ARG ALPINE_VERSION="3.15"
ARG MAVEN_VERSION="3.8.4"
ARG OPENJDK_VERSION="17"


##################################
# Build the Spatial Indexer tool #
##################################
FROM --platform=${BUILDPLATFORM} "docker.io/library/maven:${MAVEN_VERSION}-openjdk-${OPENJDK_VERSION}-slim" AS builder

WORKDIR /build
COPY ./src ./src
COPY ./pom.xml ./pom.xml
RUN --mount=type=cache,target=/root/.m2,rw mvn clean compile package \
  && mv target/spatialindexer-*-jar-with-dependencies.jar spatialindexer.jar \
  && mvn clean


############################
# Build final Docker image #
############################
FROM --platform=${TARGETPLATFORM} "docker.io/library/alpine:${ALPINE_VERSION}"
ARG OPENJDK_VERSION

WORKDIR /app
RUN apk add --no-cache "openjdk${OPENJDK_VERSION}"

WORKDIR /app

COPY --from=builder /build/spatialindexer.jar .
COPY entrypoint.sh .
RUN chmod +x entrypoint.sh

# default environment variables
ENV \
  JAVA_OPTIONS="" \
  SRS_URI="" \
  DATASET_PATH="/databases/ds" \
  SPATIAL_INDEX_FILE_PATH="/databases/ds/spatial.index"

RUN mkdir -p "/databases/ds"

ENTRYPOINT [ "/app/entrypoint.sh" ]
CMD []
