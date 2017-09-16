// vim: set ts=2 sw=2 et colorcolumn=100 :

/**
 * Namespace
 * @namespace
 */
var geochart_geojson = {};

(function(context) { 

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
context.GeoChart = function(container) {
  this.container = container;

  this.data_ = null;
  this.options_ = null;
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

context.GeoChart.prototype.DEFAULT_OPTIONS = {
  maps_background: "none",
  maps_control: false
}

// TODO Implement other `maps_background` and `maps_control` options
context.GeoChart.prototype.getMapsOptions_ = function() {
  var maps_options = this.options_.mapsOptions;

  if (this.options_.maps_background === "none") {
    maps_options["styles"] = [{
      "stylers": [{"visibility": "off"}]
    }];
    maps_options["backgroundColor"] = "none";
  } else {
    throw "Invalid `maps_background` option";
  }

  if (this.options_.maps_control === false) {
    maps_options["disableDefaultUI"] = true;
    maps_options["scrollwheel"] = false;
    maps_options["draggable"] = false;
    maps_options["disableDoubleClickZoom"] = true;
  } else {
    throw "Invalid `maps_control` option";
  }

  return maps_options;
}

context.GeoChart.prototype.draw = function(data, options) {
  this.data_ = data;
  // XXX This doesn't run a deep copy. So, if someday `DEFAULT_OPTIONS` has objects in its values,
  // the line above won't work anymore.
  // See: https://stackoverflow.com/questions/27936772/how-to-deep-merge-instead-of-shallow-merge
  var merged_options = Object.assign({}, context.GeoChart.prototype.DEFAULT_OPTIONS, options);
  this.options_ = merged_options;

  var maps_options = this.getMapsOptions_();

  // TODO We could implement custom zooming when maps_background = 'none' using custom
  // projections.
  // See: https://groups.google.com/forum/#!topic/google-maps-js-api-v3/AbOHZlLQLCg

  this.map_ = new google.maps.Map(this.container, maps_options);
  this.map_.data.loadGeoJson(this.options_.geoJson, this.options_.geoJsonOptions);
}

})(geochart_geojson);
