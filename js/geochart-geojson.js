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
 * - https://developers.google.com/chart/interactive/docs/gallery/geochart
 * - https://developers.google.com/chart/interactive/docs/datatables_dataviews
 * - https://developers.google.com/chart/interactive/docs/reference
 * - https://developers.google.com/maps/documentation/javascript/
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
  // Feature selected by the user
  this.featureSelected_ = null;
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

  var this_ = this;

  // Create the Google Maps object
  var maps_options = this.getMapsOptions_();
  // TODO We could implement custom zooming when mapsBackground = 'none' using custom
  // projections.
  // See: https://groups.google.com/forum/#!topic/google-maps-js-api-v3/AbOHZlLQLCg
  this.map_ = new google.maps.Map(this.container, maps_options);

  // Load the GeoJSON data 
  this.map_.data.loadGeoJson(
      this.options_.geoJson, this.options_.geoJsonOptions,
      function(features) {
        var min = Number.MAX_VALUE;
        var max = -Number.MAX_VALUE;

        // Populate the feature "data-" properties
        for (var row = 0; row < data.getNumberOfRows(); row++) {
          var id = data.getValue(row, 0);
          var value = data.getValue(row, 1);
          var feature = this_.map_.data.getFeatureById(id);          

          // Keep track of min and max values
          if (value < min) {
            min = value;
          }
          if (value > max) {
            max = value;
          }
          feature.setProperty("data-row", row);
          feature.setProperty("data-value", value);
        }
        this_.min_ = min;
        this_.max_ = max;
      }
  );

  // Define the feature styles
  this.map_.data.setStyle(function(feature) {
    var style = Object.assign({}, this_.DEFAULT_OPTIONS.featuresStyle);
    
    // Colorize the features with data (using the gradient colors)
    if (feature.getProperty("data-value") !== undefined) {
      var fill_color_arr = [];
      var stroke_color_arr = [];

      var gradient_colors_arr = [
          this_.getColorArray_(this_.DEFAULT_OPTIONS.featuresGradientColors[0]),
          this_.getColorArray_(this_.DEFAULT_OPTIONS.featuresGradientColors[1])
      ];
      var gradient_stroke_colors_arr = [
          this_.getColorArray_(this_.DEFAULT_OPTIONS.featuresGradientStrokeColors[0]),
          this_.getColorArray_(this_.DEFAULT_OPTIONS.featuresGradientStrokeColors[1])
      ];
      var relative_value = this_.getRelativeValue_(feature.getProperty("data-value"));

      for (var i = 0; i < 3; i++) {
        fill_color_arr[i] = 
            (gradient_colors_arr[1][i] - gradient_colors_arr[0][i]) * relative_value +
            gradient_colors_arr[0][i];
        stroke_color_arr[i] = 
            ((gradient_stroke_colors_arr[1][i] - gradient_stroke_colors_arr[0][i]) *
            relative_value) + gradient_stroke_colors_arr[0][i];
      }

      style = Object.assign(style, {
        fillColor: 'rgb(' + fill_color_arr[0] + ',' + fill_color_arr[1] + ',' +
            fill_color_arr[2] + ')',
        strokeColor: 'rgb(' + stroke_color_arr[0] + ',' + stroke_color_arr[1] + ',' +
            stroke_color_arr[2] + ')'
      });
    }

    return style;
  });

}

// Based on: https://stackoverflow.com/questions/5623838/rgb-to-hex-and-hex-to-rgb
context.GeoChart.prototype.getColorArray_ = function(color) {
  var short_regex = /^#?([\da-f])([\da-f])([\da-f])$/i;
  var regex = /^#?([\da-f]{2})([\da-f]{2})([\da-f]{2})$/i;

  var color_array = null;

  color = color.replace(short_regex, function(m, r, g, b) {
    return "#" + r + r + g + g + b + b;
  });
  var result = regex.exec(color);
  if (! result) {
    throw "Invalid color string";
  }
  color_array = [parseInt(result[1], 16), parseInt(result[2], 16), parseInt(result[3], 16)];

  return color_array;
}

context.GeoChart.prototype.getRelativeValue_ = function(value) {
  return (value - this.min_) / (this.max_ - this.min_);
}

// Entry selected by the user
// See: https://developers.google.com/chart/interactive/docs/reference#getselection
context.GeoChart.prototype.getSelection = function() {
  if (! this.featureSelected_) {
    return [];
  } else {
    return [{row: this.featureSelected_.getProperty("data-row"), column: null}];
  }
}

context.GeoChart.prototype.setSelection = function(selection) {
  // Implemented only for a single row selection
  if (Array.isArray(selection) && selection.row && selection.length === 1) {
    var id = this.data_.getValue(selection[0].row, 0);
    this.featureSelected_ = this.map_.data.getFeatureById(id);
  }
}

})(geochart_geojson);
