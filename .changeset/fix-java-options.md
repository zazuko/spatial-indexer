---
"spatial-indexer": patch
---

Fix the `JAVA_OPTIONS` environment variable of the Docker image being ignored.

The image documents `JAVA_OPTIONS` to pass options to the JVM (for example
`-Xmx4g` to give it more memory on a large dataset), but the entrypoint only
read `JAVA_OPTS`, so any value set in `JAVA_OPTIONS` was silently dropped. The
entrypoint now passes `JAVA_OPTIONS` to the JVM.

`JAVA_OPTS` keeps working, so setups that relied on it are not affected. When
both are set, both are passed to the JVM, and `JAVA_OPTIONS` takes precedence
if they set the same option.
