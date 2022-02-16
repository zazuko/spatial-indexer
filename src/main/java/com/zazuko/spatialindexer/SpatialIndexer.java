package com.zazuko.spatialindexer;

import java.io.File;

import org.apache.commons.cli.CommandLine;
import org.apache.commons.cli.CommandLineParser;
import org.apache.commons.cli.DefaultParser;
import org.apache.commons.cli.Option;
import org.apache.commons.cli.Options;
import org.apache.commons.cli.ParseException;
import org.apache.jena.geosparql.configuration.GeoSPARQLConfig;
import org.apache.jena.geosparql.spatial.SpatialIndexException;
import org.apache.jena.geosparql.configuration.SrsException;
import org.apache.jena.query.Dataset;
import org.apache.jena.tdb2.TDB2Factory;

public class SpatialIndexer {
  private static final int EXIT_FAILURE = 1;

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

  /**
   * Manage supported options.
   *
   * @return Options
   */
  private static final Options configParameters() {
    final Option dataset = Option
        .builder("d")
        .longOpt("dataset")
        .desc("Path to a TDB2 dataset")
        .hasArg(true)
        .required(true)
        .argName("dataset")
        .build();

    final Option spatialIndexFile = Option
        .builder("i")
        .longOpt("index")
        .desc("Path to the spatial index file")
        .hasArg(true)
        .required(true)
        .argName("index")
        .build();

    final Option srsUri = Option
        .builder("s")
        .longOpt("srs")
        .desc("SRS URI")
        .hasArg(true)
        .required(false)
        .argName("srs")
        .build();

    final Options options = new Options();
    options
        .addOption(dataset)
        .addOption(spatialIndexFile)
        .addOption(srsUri);

    return options;
  }

  public static void main(String[] args) {
    final Options options = configParameters();
    final CommandLineParser parser = new DefaultParser();
    CommandLine line;

    try {
      line = parser.parse(options, args);
    } catch (ParseException e) {
      System.err.println(e);
      System.exit(EXIT_FAILURE);
      return;
    }

    final String datasetPath = line.getOptionValue("dataset");
    final String spatialIndexFilePath = line.getOptionValue("index");

    final File spatialIndexFile = new File(spatialIndexFilePath);
    final Dataset dataset = TDB2Factory.connectDataset(datasetPath);

    try {
      if (line.hasOption("srs")) {
        final String srsUri = line.getOptionValue("srs");
        GeoSPARQLConfig.setupSpatialIndex(dataset, srsUri, spatialIndexFile);
      } else {
        setupSpatialIndexWithoutSrsUri(dataset, spatialIndexFile);
      }
    } catch (SpatialIndexException e) {
      System.err.println(e);
      System.exit(EXIT_FAILURE);
    }
  }
}
