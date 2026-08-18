# Spatial Indexer

This project is using Apache Jena library to generate a spatial index file from a TDB2 dataset.
Generating the spatial index file before starting a Fuseki instance with GeoSPARQL support can save some precious time when starting the Fuseki instance.

If you want to play with Fuseki with GeoSPARQL support, you may be interested in: https://github.com/zazuko/fuseki-geosparql.

## Build

Build the package using the following command:

```sh
mvn clean package
```

## Test

The integration tests generate a small RDF dataset with geometries, load it into a TDB2 dataset with the Apache Jena CLI tools, build the spatial index with this tool, and then serve the result with [Fuseki with GeoSPARQL support](https://github.com/zazuko/fuseki-geosparql) to check that it starts without error and answers GeoSPARQL queries as expected.

They need `docker`, `java` and `mvn` available, and are run with:

```sh
pnpm install
pnpm run test
```

The jar is built automatically when it is missing or out of date, and the Apache Jena CLI tools are downloaded once into `test/.cache/`.

## Run the tool

Once you built the package, you can run the spatial indexer tool by using this command:

```sh
java -jar target/spatialindexer-*-jar-with-dependencies.jar \
  --dataset /tmp/test-ds \
  --index /tmp/test-spatial.index
```

You can edit the paths with some specific values.

Supported options:

- `--dataset`, `-d`: path to the dataset (required)
- `--index`, `-i`: path to the spatial index file to generate (required)
- `--srs`, `-s`: manually set a SRS URI, by default, it will take the one that is the most present in the dataset or use CRS84 as a fallback

## Docker image

The Docker image is configurable using the following environment variables:

- `JAVA_OPTIONS`: add some Java options (default: _empty_)
- `SRS_URI`: specify a SRS URI to use (default: _empty_)
- `DATASET_PATH`: path to the dataset (default: `/databases/ds`)
- `SPATIAL_INDEX_FILE_PATH`: path to the spatial index file to generate (default: `/databases/ds/spatial.index`)

If you want to run it quickly on a dataset on your machine, go in the dataset directory, then run the following:

```sh
docker run --rm \
  -v$(pwd):/databases/ds \
  ghcr.io/zazuko/spatial-indexer:latest \
  --srs http://www.opengis.net/def/crs/OGC/1.3/CRS84
```

This will generate a `spatial.index` file in your dataset directory.

Since the container is running as `root`, you may need to change permissions for the generated spatial index file, by using something similar to:

```sh
sudo chown "${USER}" spatial.index
```

If you want to create a Docker image that uses this tool, you can do something like this:

```Dockerfile
FROM ...

# ...

# make sure you have a Java runtime somewhere in the image

# ...
COPY --from=ghcr.io/zazuko/spatial-indexer:latest /app/spatialindexer.jar .
# ...

```

Or if you want to directly fetch the `jar` file locally, you can use this command:

```sh
docker pull ghcr.io/zazuko/spatial-indexer:latest
CONTAINER_ID=$(docker create ghcr.io/zazuko/spatial-indexer:latest)
docker cp "${CONTAINER_ID}:/app/spatialindexer.jar" .
docker stop "${CONTAINER_ID}"
docker rm "${CONTAINER_ID}"
```

Make sure to use a full semver tag of the image instead of `latest` to avoid any breaking change in your workflow.
