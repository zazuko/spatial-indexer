#!/bin/sh

# fix permissions on the dataset path
if [ -d "${DATASET_PATH}" ]; then
  chown -R 1000:1000 "${DATASET_PATH}"
fi

# fix permission on the spatial index file directory
SIF_DIR=$(dirname "${SPATIAL_INDEX_FILE_PATH}")
if [ -d "${SIF_DIR}" ]; then
  chown -R 1000:1000 "${SIF_DIR}"
fi

# fix permissions on the spatial index file
if [ -f "${SPATIAL_INDEX_FILE_PATH}" ]; then
  chown 1000:1000 "${SPATIAL_INDEX_FILE_PATH}"
fi

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
