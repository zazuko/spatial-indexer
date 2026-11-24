#!/bin/sh

# Manage SRS URI option
EXTRA_ARGS=""
if [ -n "${SRS_URI}" ]; then
  echo "SRS_URI set to '${SRS_URI}'"
  EXTRA_ARGS="--srs ${SRS_URI}"
fi

# Run the spatial indexer tool
#
# `JAVA_OPTIONS` is the documented variable. `JAVA_OPTS` is still honored, as it
# was the only one that used to be read. `JAVA_OPTIONS` comes last so that it
# wins when both set the same JVM option.
exec \
  java \
  ${JAVA_OPTS} \
  ${JAVA_OPTIONS} \
  -jar /app/spatialindexer.jar \
  --dataset "${DATASET_PATH}" \
  --index "${SPATIAL_INDEX_FILE_PATH}" \
  ${EXTRA_ARGS} \
  ${@}
