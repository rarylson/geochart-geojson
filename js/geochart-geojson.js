// vim: set ts=2 sw=2 et colorcolumn=100 :

/**
 * Namespace
 * @namespace
 */
var geochart_geojson = {};

(function(context) { 

context.CONSTANTS = {
  // zIndex of selected or highlighted features
  // The selected (click) and highlighted (hover) features must have a zIndex higher than
  // the other features.
  selectedZIndex: 999,
  highlightedZIndex: 1000,
  // zIndex of the tooltip
  // The tooltip must have a zIndex higher than the features and the selected and highlighted
  // features. 
  tooltipZIndex: 2000
}

/**
 * GeoChart with GeoJSON support
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
  this.feature_selected_ = null;
}

context.GeoChart.prototype.DEFAULT_OPTIONS = {
  mapsOptions: null,
  mapsBackground: "none",
  mapsControl: false,
  featuresStyle: {
    fillColor: "#f5f5f5",
    strokeColor: "#dddddd",
    fillOpacity: 1,
    strokeWeight: 1
  },
  featuresHighlightedStyle: {
    strokeWeight: 3,
    strokeOpacity: 1,
  },
  featuresGradientColors: ["#efe6dc", "#109618"],
  featuresGradientStrokeColors: ["#d7cfc6", "0e8716"],
  tooltip: {
    borderStyle: "solid",
    borderWidth: "1px",
    borderColor: "#cccccc",
    backgroundColor: "#ffffff",
    padding: "4px",
    textStyle: {
      color: "#000000",
      fontFamily: "Arial",
      fontSize: "13px",
      margin: "2px"
    }
  },
  tooltipOffset: 12
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

context.GeoChart.prototype.draw = function(data, options={}) {
  this.data_ = data;
  // FIXME This doesn't run a deep copy.
  // See: https://stackoverflow.com/questions/27936772/how-to-deep-merge-instead-of-shallow-merge
  this.options_ = Object.assign({}, context.GeoChart.prototype.DEFAULT_OPTIONS, options);

  var this_ = this;

  // Create the Google Maps object
  var maps_options = this.getMapsOptions_();
  // TODO We could implement custom zooming when mapsBackground = "none" using custom
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
          feature.setProperty("data-id", id);
          feature.setProperty("data-label", data.getColumnLabel(1));
          feature.setProperty("data-value", value);
        }
        this_.min_ = min;
        this_.max_ = max;
       
        // Create the tooltip
        google.maps.event.addListener(this_.map_, "tooltip-ready", function() {
          
          // Trigger the ready event
          // See: https://developers.google.com/chart/interactive/docs/dev/events#the-ready-event
          google.visualization.events.trigger(this_, "ready", null);
        });
        this_.tooltip_ = new context.Tooltip(this_);
      }
  );

  // Define the feature styles
  this.map_.data.setStyle(function(feature) {
    // Default style
    var style = Object.assign(
        {}, {cursor: "default"},
        this_.DEFAULT_OPTIONS.featuresStyle);
    
    // Feature with data style
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
        fillColor: "rgb(" + fill_color_arr[0] + ", " + fill_color_arr[1] + ", " +
            fill_color_arr[2] + ")",
        strokeColor: "rgb(" + stroke_color_arr[0] + ", " + stroke_color_arr[1] + ", " +
            stroke_color_arr[2] + ")"
      });

      // Selected feature style
      if (feature.getProperty("data-selected") === true) {
        style = Object.assign(
            style, this_.DEFAULT_OPTIONS.featuresHighlightedStyle,
            {zIndex: context.CONSTANTS.selectedZIndex}
        );
      }
    }

    return style;
  });

  // Mouse event handlers

  this.map_.data.addListener("mouseover", function(event) {
    var highlighted_style = Object.assign(
        {}, this_.DEFAULT_OPTIONS.featuresHighlightedStyle,
        {zIndex: context.CONSTANTS.highlightedZIndex});

    if (event.feature !== this_.feature_selected_) {    
        this_.map_.data.revertStyle();
        this_.map_.data.overrideStyle(event.feature, highlighted_style);
    }
    if (event.feature.getProperty("data-value") !== undefined) {
      this_.tooltip_.drawTooltip(event.feature, event.latLng);
    }
  });

  this.map_.data.addListener("mouseout", function(event) {
    if (event.feature !== this_.feature_selected_) {    
        this_.map_.data.revertStyle();
    }
  });

  this.map_.data.addListener("click", function(event) {
    this_.map_.data.revertStyle();
    if (event.feature !== this_.feature_selected_) {
      if (event.feature.getProperty("data-value") !== undefined) {
        this_.selectFeature_(event.feature);
      } else {
        this_.unselectFeature_(event.feature);
      }
    }
  });

  this.map_.addListener("click", function(event) {
    this_.map_.data.revertStyle();
    this_.unselectFeature_(event.feature);
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
  if (! this.feature_selected_) {
    return [];
  } else {
    return [{row: this.feature_selected_.getProperty("data-row"), column: null}];
  }
}

context.GeoChart.prototype.setSelection = function(selection) {
  var id = "";
  var feature = null;

  // Implemented only for zero and single row selections
  if (! selection.length) {
    this.unselectFeature_();
  } else if (selection.length === 1) {
      id = this.data_.getValue(selection[0].row, 0);
      feature = this.map_.data.getFeatureById(id);
      this.selectFeature_(feature);
  }
}

context.GeoChart.prototype.selectFeature_ = function(feature) {
  this.unselectFeature_();
  this.feature_selected_ = feature;
  this.feature_selected_.setProperty("data-selected", true);
}

context.GeoChart.prototype.unselectFeature_ = function() {
  if (this.feature_selected_) {
    this.feature_selected_.removeProperty("data-selected");
    this.feature_selected_ = null;
  }
}

/**
 * Tooltip for GeoChart GeoJSON
 * @class
 *
 * It's an overlay layer to be placed on a Google Maps map.
 * 
 * @param {object} geoChart - The GeoChart GeoJSON object where the tooltip will be placed.
 */
context.Tooltip = function(geoChart) {
  this.geo_chart_ = geoChart;

  this.div_ = null;
  this.id_span_ = null;
  this.label_span_ = null;
  this.value_span_ = null;

  this.LatLng = null;

  this.setMap(geoChart.map_);
}

context.Tooltip.prototype = new google.maps.OverlayView();

context.Tooltip.prototype.onAdd = function() {
  // Create the main div
  var div = document.createElement("div");
  var div_style = {};
  div_style = Object.assign(
      {}, {position: "absolute", visibility: "hidden"},
      this.geo_chart_.options_.tooltip,
      {zIndex: context.CONSTANTS.tooltipZIndex});
  delete div_style.textStyle;
  Object.assign(div.style, div_style);

  var p_style = Object.assign({}, this.geo_chart_.options_.tooltip.textStyle);

  // Create the first inner paragraph
  var p1 = document.createElement("p");
  Object.assign(p1.style, p_style);
  var id_span = document.createElement("span");
  id_span.style.fontWeight = "bold";
  p1.appendChild(id_span);
  div.appendChild(p1);

  // Create the second inner paragraph
  var p2 = document.createElement("p");
  Object.assign(p2.style, p_style);
  var label_span = document.createElement("span");
  var value_span = document.createElement("span");
  value_span.style.fontWeight = "bold";
  p2.appendChild(label_span);
  p2.appendChild(document.createTextNode(": "));
  p2.appendChild(value_span);
  div.appendChild(p2);
   
  this.div_ = div;
  this.id_span_ = id_span;
  this.label_span_ = label_span;
  this.value_span_ = value_span;

  this.getPanes().overlayLayer.appendChild(div);
}

context.Tooltip.prototype.draw = function() {
  // Do not draw nothing at first
  // Only trigger an event
  google.maps.event.trigger(this.map_, 'tooltip-ready');
}

context.Tooltip.prototype.drawTooltip = function(feature, latLng) {
  // Calculate positioning
  var s = this.geo_chart_.options_.tooltipOffset;
  var px = this.getProjection().fromLatLngToDivPixel(latLng);
  var w = this.div_.offsetWidth;
  var h = this.div_.offsetHeight;
  var top = 0;
  var left = 0;

  // Start with div up and left
  top = px.y - s - h;
  left = px.x - s - w;
  // Change div side if necessary
  if (top < 0) {
    top = px.y + s;
  }
  if (left < 0) {
    left = px.x + s;
  }

  // Set text and positioning
  this.id_span_.innerText = feature.getId();
  this.label_span_.innerText = feature.getProperty("data-label");
  this.value_span_.innerText = feature.getProperty("data-value");
  this.div_.style.top = top + 'px';
  this.div_.style.left = left + 'px';
  this.div_.style.visibility = "visible";
}

context.Tooltip.prototype.undrawTooltip = function() {
  this.div_.style.visibility = "hidden";
}

})(geochart_geojson);
