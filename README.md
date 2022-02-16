# Spatial Indexer

This project is using Apache Jena library to generate a spatial index file from a TDB2 dataset.
Generating the spatial index file before starting a Fuseki instance with GeoSPARQL support can save some precious time when starting the Fuseki instance.

If you want to play with Fuseki with GeoSPARQL support, you may be interested in: https://github.com/zazuko/fuseki-geosparql.

## Build

Build the package using the following command:

```sh
mvn clean package
```

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
