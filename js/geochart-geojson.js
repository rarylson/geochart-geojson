// vim: set ts=2 sw=2 et colorcolumn=100 :

/**
 * Namespace
 * @namespace
 */
var geochart_geojson = {};

/**
 * Create a GeoChart with GeoJSON support
 * @class
 *
 * These charts are very similar to the Google Charts geochart, but with GeoJSON support.
 * 
 * Code based on many Google Charts and Google Maps API guides and references.
 * 
 * See:
 * 
 * - https://developers.google.com/chart/interactive/docs/dev/
 * - https://developers.google.com/maps/documentation/javascript/
 * - https://developers.google.com/chart/interactive/docs/gallery/geochart
 * 
 * @param {object} container - The HTML container for the chart.
 */
geochart_geojson.GeoChart = function(container) {
  this.container = container;

  this.data_table_ = null;
  // The inner Google Maps map object
  // This object will hold the GeoJSON map (in its overlay layer), the tooltip overlay and the
  // legend control.
  // Optionally, it will also handle the underlying map layer (map, satellite or simple map) and
  // the map control (zoom, map drag). These features are disabled by default, so the 
  this.maps_map_ = null;
  this.tooltip_ = null;
  this.legend_ = null;
  // Min and max values of the DataTable rows
  // Used in the gradient color generation.
  this.min_ = 0;
  this.max_ = 0;
  // DataTable row selected by the user
  this.selection_ = null;
}

geochart_geojson.GeoChart.prototype.DEFAULT_OPTIONS = {
  //maps_background: "none",
}

geochart_geojson.GeoChart.prototype.draw = function(data, options) {
  //
}
