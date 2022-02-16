package com.zazuko;

import java.io.File;

import org.apache.jena.geosparql.configuration.GeoSPARQLConfig;
import org.apache.jena.geosparql.spatial.SpatialIndexException;
import org.apache.jena.geosparql.configuration.SrsException;
import org.apache.jena.query.Dataset;
import org.apache.jena.tdb2.TDB2Factory;

public class SpatialIndexer {
  private static final int EXIT_ERROR = 1;

  /**
   * Setup Spatial Index using Dataset and most frequent SRS URI in Dataset.
   * When no SRS URI can be found, CRS84 will be used instead.
   * Spatial Index written to file once created.
   *
   * @param dataset
   * @param spatialIndexFile
   * @throws SpatialIndexException
   */
  private static final void setupSpatialIndexWithoutSrsUri(Dataset dataset, File spatialIndexFile)
      throws SpatialIndexException {
    try {
      GeoSPARQLConfig.setupSpatialIndex(dataset, spatialIndexFile);
    } catch (SrsException _e) {
      GeoSPARQLConfig.setupSpatialIndex(dataset, "http://www.opengis.net/def/crs/OGC/1.3/CRS84", spatialIndexFile);
    }
  }

  public static void main(String[] args) {
    File file = new File("/tmp/test-spatial.index");
    Dataset dataset = TDB2Factory.connectDataset("/tmp/foo");

    try {
      setupSpatialIndexWithoutSrsUri(dataset, file);
    } catch (SpatialIndexException e) {
      System.err.println(e);
      System.exit(EXIT_ERROR);
    }
  }
}
