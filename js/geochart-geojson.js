// vim: set ts=2 sw=2 et colorcolumn=80 :

/**
 * Package "geochart_geojson"
 *
 * Provides GeoChart with GeoJSON support.
 *
 * Contains the GeoChart class with its subcomponent classes.
 */
var geochart_geojson = {};

(function(context) {

"use strict";

// Constants

// zIndex constants
// The selected (click) and highlighted (hover) features must have a zIndex
// higher than the other features. The tooltip must have a zIndex higher than
// the features and the selected and highlighted features.
var SELECTED_Z_INDEX = 999;
var HIGHLIGHTED_Z_INDEX = 1000;
var TOOLTIP_Z_INDEX = 2000;
// Color axis constants
var COLOR_AXIS_INDICATOR_SIZE = "12px";
var COLOR_AXIS_INDICATOR_TOP_OFFSET = -8;
var COLOR_AXIS_INDICATOR_LEFT_OFFSET = -6;


/**
 * GeoChart with GeoJSON support
 *
 * These charts are very similar to the Google Charts geochart, but with
 * GeoJSON support.
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
 * Params:
 *
 * - container: The HTML container for the chart.
 */
var GeoChart = function(container) {
  this.container = container;

  this.data_ = null;
  this.options_ = null;
  // The inner Google Maps map object
  // This object will hold the GeoJSON map (in its overlay layer), the tooltip
  // overlay and the color axis.
  // Optionally, it will also handle the underlying map layer (map, satellite
  // or simple map) and the map control (zoom, map drag). These features are
  // disabled by default.
  this.maps_map_ = null;
  this.tooltip_ = null;
  this.color_axis_ = null;
  // Min and max values of the DataTable rows
  this.min_ = 0;
  this.max_ = 0;
  // Feature selected by the user
  this.feature_selected_ = null;
};

// Default GeoChart options
// TODO Document each option.
// TODO Use an API more similar to the original Google Charts.
GeoChart.prototype.DEFAULT_OPTIONS = {
  mapsOptions: null,
  mapsBackground: "none",
  mapsControl: false,
  featuresStyle: {
    fillColor: "#f5f5f5",
    strokeColor: "#cccccc",
    fillOpacity: 1,
    strokeWeight: 1,
    strokeOpacity: 0.5
  },
  featuresHighlightedStyle: {
    strokeWeight: 2,
    strokeOpacity: 1
  },
  featuresGradientColors: ["#efe6dc", "#109618"],
  featuresGradientStrokeColors: ["#cccccc", "#888888"],
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
  tooltipOffset: 12,
  colorAxis: {
    width: "250px",
    height: "13px",
    textStyle: {
      color: "#000000",
      fontFamily: "Arial",
      fontSize: "14px"
    }
  },
  colorAxisPosition: "LEFT_BOTTOM"
};

// TODO Implement other `mapsBackground` and `mapsControl` options
GeoChart.prototype.getMapsOptions_ = function() {
  var maps_options = this.options_.mapsOptions;

  if (this.options_.mapsBackground === "none") {
    maps_options.styles = [{
      "stylers": [{"visibility": "off"}]
    }];
    maps_options.backgroundColor = "none";
  } else {
    throw new Error("Invalid `mapsBackground` option");
  }

  if (this.options_.mapsControl === false) {
    maps_options.disableDefaultUI = true;
    maps_options.scrollwheel = false;
    maps_options.draggable = false;
    maps_options.disableDoubleClickZoom = true;
  } else {
    throw new Error("Invalid `mapsControl` option");
  }

  return maps_options;
};

GeoChart.prototype.draw = function(data, options={}) {
  this.data_ = data;
  // FIXME This doesn't run a deep copy.
  // See: https://stackoverflow.com/questions/27936772/how-to-deep-merge-
  //          instead-of-shallow-merge
  this.options_ = Object.assign(
      {}, context.GeoChart.prototype.DEFAULT_OPTIONS, options);

  // Create the Google Maps object
  var maps_options = this.getMapsOptions_();
  // TODO We could implement custom zooming when mapsBackground = "none" using
  // custom projections.
  // See: https://groups.google.com/forum/#!topic/google-maps-js-api-
  //          v3/AbOHZlLQLCg
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
          var feature = this.map_.data.getFeatureById(id);

          // Also keep track of min and max values
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
        this.min_ = min;
        this.max_ = max;

        // Create the color axis
        this.color_axis_ = new ColorAxis(this);
        this.map_.controls[
            google.maps.ControlPosition[this.options_.colorAxisPosition]].push(
                this.color_axis_.getContainer());

        // Create the tooltip
        this.tooltip_ = new Tooltip(this);

        // Trigger the ready event
        // See: https://developers.google.com/chart/interactive/docs/dev/
        //          events#the-ready-event
        google.visualization.events.trigger(this, "ready", null);
      }.bind(this)
  );

  // Define the feature styles
  this.map_.data.setStyle(function(feature) {
    // Default style
    var style = Object.assign(
        {}, {cursor: "default"},
        this.options_.featuresStyle);

    // Feature with data style
    // Colorize the features with data (using the gradient colors)
    if (feature.getProperty("data-value") !== undefined) {
      var fill_color_arr = [];
      var stroke_color_arr = [];

      var gradient_colors_arr = [
          this.getColorArray_(this.options_.featuresGradientColors[0]),
          this.getColorArray_(this.options_.featuresGradientColors[1])
      ];
      var gradient_stroke_colors_arr = [
          this.getColorArray_(this.options_.featuresGradientStrokeColors[0]),
          this.getColorArray_(this.options_.featuresGradientStrokeColors[1])
      ];
      var relative_value = this.getRelativeValue_(
          feature.getProperty("data-value"));

      for (var i = 0; i < 3; i++) {
        fill_color_arr[i] = Math.round(
            ((gradient_colors_arr[1][i] - gradient_colors_arr[0][i]) *
            relative_value) + gradient_colors_arr[0][i]);
        stroke_color_arr[i] = Math.round(
            ((gradient_stroke_colors_arr[1][i] -
            gradient_stroke_colors_arr[0][i]) *
            relative_value) + gradient_stroke_colors_arr[0][i]);
      }

      style = Object.assign(style, {
        fillColor: this.getColorArrayStr_(fill_color_arr),
        strokeColor: this.getColorArrayStr_(stroke_color_arr)
      });

      // Selected feature style
      if (feature.getProperty("data-selected") === true) {
        style = Object.assign(
            style, this.options_.featuresHighlightedStyle,
            {zIndex: SELECTED_Z_INDEX}
        );
      }
    }

    return style;
  }.bind(this));

  // Mouse event handlers

  this.map_.data.addListener("mouseover", function(event) {
    var highlighted_style = Object.assign(
        {}, this.options_.featuresHighlightedStyle,
        {zIndex: HIGHLIGHTED_Z_INDEX});

    if (event.feature !== this.feature_selected_) {
      this.map_.data.revertStyle();
      this.map_.data.overrideStyle(event.feature, highlighted_style);
    }
    if (event.feature.getProperty("data-value") !== undefined) {
      this.color_axis_.drawIndicator(event.feature);
    }
  }.bind(this));

  this.map_.data.addListener("mouseout", function(event) {
    if (event.feature !== this.feature_selected_) {
      this.map_.data.revertStyle();
    }
    this.tooltip_.undrawTooltip();
    this.color_axis_.undrawIndicator();
  }.bind(this));

  this.map_.data.addListener("mousemove", function(event) {
    if (event.feature.getProperty("data-value") !== undefined) {
      this.tooltip_.drawTooltip(event.feature, event.latLng);
    }
  }.bind(this));

  this.map_.data.addListener("click", function(event) {
    this.map_.data.revertStyle();
    if (event.feature !== this.feature_selected_) {
      if (event.feature.getProperty("data-value") !== undefined) {
        this.selectFeature_(event.feature);
      } else {
        this.unselectFeature_();
      }
    }
  }.bind(this));

  this.map_.addListener("click", function(event) {
    this.map_.data.revertStyle();
    this.unselectFeature_();
  }.bind(this));

};

// Based on: https://stackoverflow.com/questions/5623838/rgb-to-hex-and-hex-
//              to-rgb
GeoChart.prototype.getColorArray_ = function(color) {
  var short_regex = /^#?([\da-f])([\da-f])([\da-f])$/i;
  var regex = /^#?([\da-f]{2})([\da-f]{2})([\da-f]{2})$/i;

  var color_array = null;

  color = color.replace(short_regex, function(m, r, g, b) {
    return "#" + r + r + g + g + b + b;
  });
  var result = regex.exec(color);
  if (! result) {
    throw new Error("Invalid color string");
  }
  color_array = [
    parseInt(result[1], 16),
    parseInt(result[2], 16),
    parseInt(result[3], 16)
  ];

  return color_array;
};

GeoChart.prototype.getColorArrayStr_ = function(color_array) {
  return "rgb(" + color_array[0] + ", " + color_array[1] + ", " +
      color_array[2] + ")";
};

GeoChart.prototype.getRelativeValue_ = function(value) {
  return (value - this.min_) / (this.max_ - this.min_);
};

// Entry selected by the user
// See: https://developers.google.com/chart/interactive/docs/reference
//          #getselection
GeoChart.prototype.getSelection = function() {
  if (! this.feature_selected_) {
    return [];
  } else {
    return [{
      row: this.feature_selected_.getProperty("data-row"),
      column: null
    }];
  }
};

GeoChart.prototype.setSelection = function(selection) {
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
};

GeoChart.prototype.selectFeature_ = function(feature) {
  this.unselectFeature_();
  this.feature_selected_ = feature;
  this.feature_selected_.setProperty("data-selected", true);
};

GeoChart.prototype.unselectFeature_ = function() {
  if (this.feature_selected_) {
    this.feature_selected_.removeProperty("data-selected");
    this.feature_selected_ = null;
  }
};

context.GeoChart = GeoChart;


// Tooltip for GeoChart GeoJSON
//
// It's an overlay layer to be placed on a Google Maps map.
//
// Params:
//
// - geoChart: The GeoChart GeoJSON object where the tooltip will be placed.
var Tooltip = function(geoChart) {
  this.geo_chart_ = geoChart;

  this.div_ = null;
  this.id_span_ = null;
  this.label_span_ = null;
  this.value_span_ = null;

  this.LatLng = null;

  this.setMap(geoChart.map_);
};

Tooltip.prototype = new google.maps.OverlayView();

Tooltip.prototype.onAdd = function() {
  // Create the main div
  var div = document.createElement("div");
  var div_style = {};
  div_style = Object.assign(
      {}, {position: "absolute", visibility: "hidden"},
      this.geo_chart_.options_.tooltip,
      {zIndex: TOOLTIP_Z_INDEX});
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
};

Tooltip.prototype.draw = function() {
  // Do not draw nothing at first
  return;
};

Tooltip.prototype.drawTooltip = function(feature, latLng) {
  // Update text
  var id = feature.getId();
  if (id !== this.id_span_.innerText) {
    this.id_span_.innerText = id;
    this.label_span_.innerText = feature.getProperty("data-label");
    this.value_span_.innerText = feature.getProperty("data-value");
  }

  // Set positioning
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
  this.div_.style.top = top;
  this.div_.style.left = left;

  // Show
  this.div_.style.visibility = "visible";
};

Tooltip.prototype.undrawTooltip = function() {
  this.div_.style.visibility = "hidden";
};

context.Tooltip = Tooltip;


// Color axis for GeoChart GeoJSON
//
// It's a control to be placed on a Google Maps map.
//
// Params:
//
// - geoChart: The GeoChart GeoJSON object where the color axis will be placed.
var ColorAxis = function(geoChart) {
  this.geo_chart_ = geoChart;

  this.div_ = null;
  this.indicator_span_ = null;

  this.draw_();
};

ColorAxis.prototype.draw_ = function() {
  var div = document.createElement("div");

  var div_inner = document.createElement("div");
  Object.assign(
      div_inner.style,
      {marginTop: - COLOR_AXIS_INDICATOR_TOP_OFFSET + "px"},
      this.geo_chart_.options_.colorAxis.textStyle);

  var min_div =  document.createElement("div");
  min_div.style.padding = "4px";
  min_div.style.display = "table-cell";
  min_div.innerText = this.geo_chart_.min_;
  div_inner.appendChild(min_div);

  var axis_div = document.createElement("div");
  axis_div.style.display = "table-cell";
  axis_div.style.verticalAlign = "middle";
  axis_div.style.position = "relative";
  axis_div.style.padding = "0";
  axis_div.style.margin = "0";
  var axis_div_inner = document.createElement("div");
  axis_div_inner.style.width = this.geo_chart_.options_.colorAxis.width;
  axis_div_inner.style.height = this.geo_chart_.options_.colorAxis.height;
  axis_div_inner.style.padding = "0";
  axis_div_inner.style.margin = "0";
  // See: https://stackoverflow.com/a/16219600
  axis_div_inner.setAttribute(
      "style",
      axis_div_inner.getAttribute("style") + "; " + this.getGradientStr_());
  axis_div.appendChild(axis_div_inner);
  var indicator_span = document.createElement("span");
  indicator_span.style.fontSize = COLOR_AXIS_INDICATOR_SIZE;
  indicator_span.style.top = COLOR_AXIS_INDICATOR_TOP_OFFSET;
  indicator_span.style.position = "absolute";
  indicator_span.style.visibility = "hidden";
  indicator_span.innerText = "▼";
  axis_div.appendChild(indicator_span);
  div_inner.appendChild(axis_div);

  var max_div =  document.createElement("div");
  max_div.style.padding = "4px";
  max_div.style.display = "table-cell";
  max_div.innerText = this.geo_chart_.max_;
  div_inner.appendChild(max_div);

  div.appendChild(div_inner);
  this.div_ = div;
  this.indicator_span_ = indicator_span;
};

// Set the background gradient string
// See: https://stackoverflow.com/a/16219600
ColorAxis.prototype.getGradientStr_ = function() {
  var gradient_string =
      "background-image: -o-linear-gradient(left, {c1}, {c2}); " +
      "background-image: -moz-linear-gradient(left, {c1}, {c2}); " +
      "background-image: -webkit-linear-gradient(left, {c1}, {c2}); " +
      "background-image: -ms-linear-gradient(left, {c1}, {c2}); " +
      "background: linear-gradient(left, {c1}, {c2})";

  var gradient_colors_arr = [
      this.geo_chart_.getColorArray_(
          this.geo_chart_.options_.featuresGradientColors[0]),
      this.geo_chart_.getColorArray_(
          this.geo_chart_.options_.featuresGradientColors[1])
  ];
  var gradient_colors_str = [
    this.geo_chart_.getColorArrayStr_(gradient_colors_arr[0]),
    this.geo_chart_.getColorArrayStr_(gradient_colors_arr[1])
  ];
  gradient_string = gradient_string.
      replace(/\{c1\}/g, gradient_colors_str[0]).
      replace(/\{c2\}/g, gradient_colors_str[1]);

  return gradient_string;
};

ColorAxis.prototype.getContainer = function() {
  return this.div_;
};

ColorAxis.prototype.drawIndicator = function(feature) {
  var relative_value = this.geo_chart_.getRelativeValue_(
      feature.getProperty("data-value"));
  var width = parseInt(this.geo_chart_.options_.colorAxis.width, 10);
  this.indicator_span_.style.left =
      (relative_value * width + COLOR_AXIS_INDICATOR_LEFT_OFFSET) + "px";
  this.indicator_span_.style.visibility = "visible";
};

ColorAxis.prototype.undrawIndicator = function() {
  this.indicator_span_.style.visibility = "hidden";
};

context.ColorAxis = ColorAxis;


})(geochart_geojson);
