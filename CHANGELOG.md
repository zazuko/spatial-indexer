# spatial-indexer

## 0.5.0

### Minor Changes

- 39b9342: Upgrade OpenJDK from version 21 to version 25.

  The jar is now compiled for Java 25, so images that copy
  `/app/spatialindexer.jar` out of `ghcr.io/zazuko/spatial-indexer` need a
  Java 25 (or later) runtime to run it.

### Patch Changes

- b02a02e: Fix the `JAVA_OPTIONS` environment variable of the Docker image being ignored.

  The image documents `JAVA_OPTIONS` to pass options to the JVM (for example
  `-Xmx4g` to give it more memory on a large dataset), but the entrypoint only
  read `JAVA_OPTS`, so any value set in `JAVA_OPTIONS` was silently dropped. The
  entrypoint now passes `JAVA_OPTIONS` to the JVM.

  `JAVA_OPTS` keeps working, so setups that relied on it are not affected. When
  both are set, both are passed to the JVM, and `JAVA_OPTIONS` takes precedence
  if they set the same option.

- 42f042f: Upgrade Alpine base image from 3.24.1 to 3.24.4
- 4be7f6a: Upgrade Apache Jena from 6.2.0 to 6.3.0.
- 7bc1511: Build the Docker image with Maven 3.10.0 instead of 3.9.16

## 0.4.0

### Minor Changes

- 2e68a23: Upgrade Apache Jena from 5.6.0 to 6.2.0.

  Jena 6 refuses to read the version `2.0.0` spatial index files that Jena 5.6.0
  produced (`Spatial index version 2.0.0 is no longer supported`), so an index
  built with the previous release made a current `ghcr.io/zazuko/fuseki-geosparql`
  instance fail to start. The tool now writes version `3.0.0` index files, which the
  current Fuseki image reads.

  Existing `spatial.index` files have to be regenerated with this version.

  The jar is now assembled with `maven-shade-plugin` instead of
  `maven-assembly-plugin`, so that the `META-INF/services` entries of the
  individual Jena modules are merged instead of overwriting each other. Without
  that merge, Jena 6 cannot initialize its subsystems at runtime.

## 0.3.0

### Minor Changes

- 9d4c991: Upgrade Alpine base image to 3.22.2
- 9d4c991: Upgrade OpenJDK from version 17 to version 21
- 9d4c991: Upgrade to Apache Jena 5.6
