---
"spatial-indexer": minor
---

Upgrade Apache Jena from 5.6.0 to 6.1.0.

Jena 6 refuses to read the version `2.0.0` spatial index files that Jena 5.6.0
produced (`Spatial index version 2.0.0 is no longer supported`), so an index
built with the previous release made a current `ghcr.io/zazuko/fuseki-geosparql`
instance fail to start. The tool now writes version `3.0.0` index files.

Existing `spatial.index` files have to be regenerated with this version.

The jar is now assembled with `maven-shade-plugin` instead of
`maven-assembly-plugin`, so that the `META-INF/services` entries of the
individual Jena modules are merged instead of overwriting each other. Without
that merge, Jena 6 cannot initialize its subsystems at runtime.
