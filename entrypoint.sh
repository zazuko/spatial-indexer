#!/bin/sh

EXTRA_ARGS=""

if [ -n "${SRS_URI}" ]; then
  echo "SRS_URI set to '${SRS_URI}'"
  EXTRA_ARGS="--srs ${SRS_URI}"
fi

exec \
  "${JAVA_HOME}/bin/java" \
  ${JAVA_OPTS} \
  -cp /app/spatialindexer.jar \
  com.zazuko.spatialindexer.SpatialIndexer \
  --dataset "${DATASET_PATH}" \
  --index "${SPATIAL_INDEX_FILE_PATH}" \
  ${EXTRA_ARGS} \
  ${@}
