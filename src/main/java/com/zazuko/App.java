package com.zazuko;

import java.io.File;

import org.apache.jena.geosparql.configuration.GeoSPARQLConfig;
import org.apache.jena.geosparql.spatial.SpatialIndexException;
import org.apache.jena.geosparql.configuration.SrsException;
import org.apache.jena.query.Dataset;
import org.apache.jena.tdb2.TDB2Factory;

public class App {
  public static void main(String[] args) {
    File file = new File("/tmp/test-spatial.index");
    Dataset dataset = TDB2Factory.connectDataset("/tmp/foo");

    try {
      try {
        GeoSPARQLConfig.setupSpatialIndex(dataset, file);
      } catch (SrsException _e) {
        GeoSPARQLConfig.setupSpatialIndex(dataset, "http://www.opengis.net/def/crs/OGC/1.3/CRS84", file);
      }
    } catch (SpatialIndexException e) {
      System.out.println(e);
      System.out.println("ko");
    }
  }
}
