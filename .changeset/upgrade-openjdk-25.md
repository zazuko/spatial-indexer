---
"spatial-indexer": minor
---

Upgrade OpenJDK from version 21 to version 25.

The jar is now compiled for Java 25, so images that copy
`/app/spatialindexer.jar` out of `ghcr.io/zazuko/spatial-indexer` need a
Java 25 (or later) runtime to run it.
