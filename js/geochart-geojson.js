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

context.GeoChart.prototype.CONSTANTS = {
  // zIndex of selected or highlighted features
  // The selected (click) and highlighted (hover) features must have a zIndex higher than
  // the other features.
  selectedZIndex: 999,
  highlightedZIndex: 1000
}

context.GeoChart.prototype.DEFAULT_OPTIONS = {
  mapsBackground: "none",
  mapsControl: false,
  featuresStyle: {
    fillColor: "#f5f5f5",
    strokeColor: '#dddddd',
    fillOpacity: 1,
    strokeWeight: 1,
    cursor: "default"
  },
  featuresHighlightedStyle: {
    strokeWeight: 3,
    strokeOpacity: 1,
  },
  featuresGradientColors: ["#efe6dc", "#109618"],
  featuresGradientStrokeColors: ["#d7cfc6", "0e8716"]
}

// TODO Implement other `mapsBackground` and `mapsControl` options
context.GeoChart.prototype.getMapsOptions_ = function() {
  var maps_options = this.options_.mapsOptions;

  if (this.options_.mapsBackground === "none") {
    maps_options["styles"] = [{
      "stylers": [{"visibility": "off"}]
    }];
    maps_options["backgroundColor"] = "none";
  } else {
    throw "Invalid `mapsBackground` option";
  }

  if (this.options_.mapsControl === false) {
    maps_options["disableDefaultUI"] = true;
    maps_options["scrollwheel"] = false;
    maps_options["draggable"] = false;
    maps_options["disableDoubleClickZoom"] = true;
  } else {
    throw "Invalid `mapsControl` option";
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

  // Create the Google Maps object
  var maps_options = this.getMapsOptions_();
  // TODO We could implement custom zooming when mapsBackground = 'none' using custom
  // projections.
  // See: https://groups.google.com/forum/#!topic/google-maps-js-api-v3/AbOHZlLQLCg
  this.map_ = new google.maps.Map(this.container, maps_options);

  // Load the GeoJSON data 
  var map = this.map_;
  this.map_.data.loadGeoJson(
      this.options_.geoJson, this.options_.geoJsonOptions,
      function(features) {
        var min = Number.MAX_VALUE;
        var max = -Number.MAX_VALUE;

        for (var row = 0; row < data.getNumberOfRows(); row++) {
          var id = data.getValue(row, 0);
          var value = data.getValue(row, 1);

          // Keep track of min and max values
          if (value < min) {
            min = value;
          }
          if (value > max) {
            max = value;
          }

          // Set feature property "value" based on the data table values
          map.data.getFeatureById(id).setProperty("value", value);
        }

        this.min_ = min;
        this.max_ = max;
      }
  );      
}

})(geochart_geojson);
