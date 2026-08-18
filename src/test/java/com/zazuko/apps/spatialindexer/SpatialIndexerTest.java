package com.zazuko.apps.spatialindexer;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.io.File;
import java.io.StringReader;
import java.nio.file.Path;
import java.util.Collection;
import java.util.List;

import org.apache.commons.cli.CommandLine;
import org.apache.commons.cli.DefaultParser;
import org.apache.commons.cli.MissingOptionException;
import org.apache.jena.geosparql.spatial.SpatialIndex;
import org.apache.jena.geosparql.spatial.index.compat.SpatialIndexIo;
import org.apache.jena.graph.Node;
import org.apache.jena.graph.NodeFactory;
import org.apache.jena.query.Dataset;
import org.apache.jena.riot.Lang;
import org.apache.jena.riot.RDFDataMgr;
import org.apache.jena.sparql.core.Quad;
import org.apache.jena.system.Txn;
import org.apache.jena.tdb2.TDB2Factory;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.locationtech.jts.geom.Envelope;

/**
 * Tests for the spatial indexer.
 *
 * The heavier end-to-end checks, which make sure the generated index is actually
 * accepted by a Fuseki instance, live in the Node test suite under {@code test/}.
 */
public class SpatialIndexerTest {
  private static final String CRS84 = "http://www.opengis.net/def/crs/OGC/1.3/CRS84";
  private static final String EPSG_4326 = "http://www.opengis.net/def/crs/EPSG/0/4326";

  /** An envelope covering the whole world, to select everything in the index. */
  private static final Envelope EVERYWHERE = new Envelope(-180, 180, -90, 90);

  /** Two Swiss cities, far enough apart to be told apart by a bounding box. */
  private static final String CITIES = """
      @prefix geo: <http://www.opengis.net/ont/geosparql#> .
      @prefix ex:  <https://example.org/> .

      ex:zurich geo:hasGeometry ex:zurich-geometry .
      ex:zurich-geometry geo:asWKT
        "<%1$s> POINT(8.5417 47.3769)"^^geo:wktLiteral .

      ex:geneva geo:hasGeometry ex:geneva-geometry .
      ex:geneva-geometry geo:asWKT
        "<%1$s> POINT(6.1432 46.2044)"^^geo:wktLiteral .
      """.formatted(CRS84);

  private static final Node ZURICH = NodeFactory.createURI("https://example.org/zurich");
  private static final Node GENEVA = NodeFactory.createURI("https://example.org/geneva");

  /** Create a TDB2 dataset and load some Turtle into its default graph. */
  private static Dataset datasetWith(Path location, String turtle) {
    final Dataset dataset = TDB2Factory.connectDataset(location.toString());
    Txn.executeWrite(dataset,
        () -> RDFDataMgr.read(dataset.getDefaultModel(), new StringReader(turtle), null, Lang.TURTLE));
    return dataset;
  }

  /** A test body that gets a dataset to work with. */
  @FunctionalInterface
  private interface DatasetConsumer {
    void accept(Dataset dataset) throws Exception;
  }

  /**
   * Run a test body against a TDB2 dataset and close it afterwards.
   *
   * {@link Dataset} is not {@link AutoCloseable}, so this stands in for
   * try-with-resources.
   *
   * @param turtle data to load into the default graph, or null for an empty dataset
   */
  private static void withDataset(Path location, String turtle, DatasetConsumer body)
      throws Exception {
    final Dataset dataset = turtle == null
        ? TDB2Factory.connectDataset(location.toString())
        : datasetWith(location, turtle);
    try {
      body.accept(dataset);
    } finally {
      dataset.close();
    }
  }

  /** Build an index for a dataset and read it back from disk. */
  private static SpatialIndex buildAndLoad(Dataset dataset, File indexFile, String srsUri)
      throws Exception {
    SpatialIndexer.buildSpatialIndex(dataset, indexFile, srsUri);
    return SpatialIndexIo.load(indexFile.toPath());
  }

  @Nested
  @DisplayName("command line options")
  class OptionParsing {
    private CommandLine parse(String... args) throws Exception {
      return new DefaultParser().parse(SpatialIndexer.configParameters(), args);
    }

    @Test
    void acceptsLongOptions() throws Exception {
      final CommandLine line = parse("--dataset", "/tmp/ds", "--index", "/tmp/spatial.index", "--srs", CRS84);

      assertEquals("/tmp/ds", line.getOptionValue("dataset"));
      assertEquals("/tmp/spatial.index", line.getOptionValue("index"));
      assertEquals(CRS84, line.getOptionValue("srs"));
    }

    @Test
    void acceptsShortOptions() throws Exception {
      final CommandLine line = parse("-d", "/tmp/ds", "-i", "/tmp/spatial.index", "-s", CRS84);

      assertEquals("/tmp/ds", line.getOptionValue("dataset"));
      assertEquals("/tmp/spatial.index", line.getOptionValue("index"));
      assertEquals(CRS84, line.getOptionValue("srs"));
    }

    @Test
    void treatsSrsAsOptional() throws Exception {
      final CommandLine line = parse("--dataset", "/tmp/ds", "--index", "/tmp/spatial.index");

      assertFalse(line.hasOption("srs"));
      // main() hands this straight to buildSpatialIndex, where null means "detect it".
      assertNull(line.getOptionValue("srs"));
    }

    @Test
    void requiresTheDataset() {
      assertThrows(MissingOptionException.class, () -> parse("--index", "/tmp/spatial.index"));
    }

    @Test
    void requiresTheIndexFile() {
      assertThrows(MissingOptionException.class, () -> parse("--dataset", "/tmp/ds"));
    }
  }

  @Nested
  @DisplayName("building the spatial index")
  class IndexBuilding {
    @Test
    void writesAnIndexHoldingEveryGeometry(@TempDir Path tmp) throws Exception {
      final File indexFile = tmp.resolve("spatial.index").toFile();

      withDataset(tmp.resolve("ds"), CITIES, dataset -> {
        final SpatialIndex index = buildAndLoad(dataset, indexFile, CRS84);

        assertTrue(indexFile.length() > 0, "the spatial index file is empty");
        assertFalse(index.isEmpty(), "the spatial index holds no geometry");
        assertEquals(2, index.getSize());
      });
    }

    @Test
    void findsIndexedFeaturesByBoundingBox(@TempDir Path tmp) throws Exception {
      final File indexFile = tmp.resolve("spatial.index").toFile();

      withDataset(tmp.resolve("ds"), CITIES, dataset -> {
        final SpatialIndex index = buildAndLoad(dataset, indexFile, CRS84);

        final Collection<Node> everything = index.query(EVERYWHERE, Quad.defaultGraphIRI);
        assertTrue(everything.containsAll(List.of(ZURICH, GENEVA)));

        // A box over north-eastern Switzerland: Zurich is inside, Geneva is not.
        final Collection<Node> aroundZurich =
            index.query(new Envelope(8.0, 9.0, 47.0, 48.0), Quad.defaultGraphIRI);
        assertEquals(List.of(ZURICH), List.copyOf(aroundZurich));

        // Somewhere in the Atlantic, where the fixture has nothing.
        assertTrue(index.query(new Envelope(-30, -20, 0, 10), Quad.defaultGraphIRI).isEmpty());
      });
    }

    @Test
    void usesTheGivenSrsUri(@TempDir Path tmp) throws Exception {
      withDataset(tmp.resolve("ds"), CITIES, dataset -> {
        // The data is CRS84, but an explicit SRS URI has to win over what is in there.
        final SpatialIndex index =
            buildAndLoad(dataset, tmp.resolve("spatial.index").toFile(), EPSG_4326);

        assertEquals(EPSG_4326, index.getSrsInfo().getSrsURI());
      });
    }

    @Test
    void detectsTheSrsUriFromTheData(@TempDir Path tmp) throws Exception {
      // EPSG:4326 rather than CRS84, so that detecting it cannot be confused with
      // falling back to the hard coded default.
      final String data = CITIES.replace(CRS84, EPSG_4326);

      withDataset(tmp.resolve("ds"), data, dataset -> {
        final SpatialIndex index =
            buildAndLoad(dataset, tmp.resolve("spatial.index").toFile(), null);

        assertEquals(EPSG_4326, index.getSrsInfo().getSrsURI());
      });
    }

    @Test
    void fallsBackToCrs84WhenThereIsNothingToDetect(@TempDir Path tmp) throws Exception {
      withDataset(tmp.resolve("ds"), null, dataset -> {
        final SpatialIndex index =
            buildAndLoad(dataset, tmp.resolve("spatial.index").toFile(), null);

        // A dataset without geometries still has to produce a usable, empty index
        // rather than failing the run.
        assertEquals(CRS84, index.getSrsInfo().getSrsURI());
        assertTrue(index.isEmpty());
        assertEquals(0, index.getSize());
      });
    }

    @Test
    void indexesGeometriesInNamedGraphs(@TempDir Path tmp) throws Exception {
      final String graph = "https://example.org/graph/cities";

      withDataset(tmp.resolve("ds"), null, dataset -> {
        Txn.executeWrite(dataset, () -> RDFDataMgr.read(dataset.getNamedModel(graph),
            new StringReader(CITIES), null, Lang.TURTLE));

        final SpatialIndex index =
            buildAndLoad(dataset, tmp.resolve("spatial.index").toFile(), CRS84);

        // This is the layout the Fuseki image uses, where the dataset is served with
        // tdb2:unionDefaultGraph and the data lives in a named graph.
        assertEquals(2, index.getSize());
        assertTrue(index.query(EVERYWHERE, NodeFactory.createURI(graph)).contains(ZURICH));
      });
    }
  }
}
