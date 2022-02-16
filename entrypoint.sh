#!/bin/sh

# manage SRS URI option
EXTRA_ARGS=""
if [ -n "${SRS_URI}" ]; then
  echo "SRS_URI set to '${SRS_URI}'"
  EXTRA_ARGS="--srs ${SRS_URI}"
fi

# run the spatial indexer tool
exec \
  java \
  ${JAVA_OPTS} \
  -jar /app/spatialindexer.jar \
  --dataset "${DATASET_PATH}" \
  --index "${SPATIAL_INDEX_FILE_PATH}" \
  ${EXTRA_ARGS} \
  ${@}
