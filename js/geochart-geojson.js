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
// Tooltip constants
var TOOLTIP_STYLE = {
    borderStyle: "solid",
    borderWidth: "1px",
    borderColor: "#cccccc",
    backgroundColor: "#ffffff",
    padding: "4px"
};
var TOOLTIP_MARGIN = 2;
var TOOLTIP_OFFSET = 12;
// Legend constants
var LEGEND_WIDTH = 250;
var LEGEND_HEIGHT = 13;
var LEGEND_NUM_PADDING_VERT = 2;
var LEGEND_NUM_PADDING_HORIZ = 4;
var LEGEND_INDICATOR_SIZE = 12;
var LEGEND_INDICATOR_TOP_OFFSET = -8;
var LEGEND_INDICATOR_LEFT_OFFSET = -6;


// Auxiliary functions

function processTextStyle_(textStyle) {
  var style = {};

  style.color = textStyle.color;
  style.fontFamily = textStyle.fontName;
  style.fontSize = textStyle.fontSize + "px";
  if (textStyle.bold) {
    style.fontWeight = "bold";
  }
  if (textStyle.italic) {
    style.fontStyle = "italic";
  }

  return style;
}

// Deep merge two objects
//
// The objects passed as params are kept intact.
function deepMerge_(obj1, obj2) {
  var obj = {};

  obj = JSON.parse(JSON.stringify(obj1));

  Object.entries(obj2).forEach(function(p) {
    if (p[0] in obj && typeof obj[p[0]] === "object" &&
        obj[p[0]] !== null && typeof p[1] === "object") {
      obj[p[0]] = deepMerge_(obj[p[0]], p[1]);
    } else {
      obj[p[0]] = p[1];
    }
  });

  return obj;
}


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
  this.map_ = null;
  this.color_axis_ = null;
  this.tooltip_ = null;
  this.legend_ = null;
  // Min and max values of the DataTable rows
  this.min_ = 0;
  this.max_ = 0;
  // Feature selected by the user
  this.feature_selected_ = null;
};

// Default GeoChart options
// TODO Document each option.
GeoChart.prototype.DEFAULT_OPTIONS = {
  colorAxis: {
    colors: ["#efe6dc", "#109618"],
    strokeColors: ["#cccccc", "#888888"],
  },
  datalessRegionColor: "#f5f5f5",
  datalessRegionStrokeColor: "#cccccc",
  defaultColor: "#267114", // TODO Implement
  defaultStrokeColor: "#666666", // TODO Implement
  displayMode: "regions", // TODO Implement
  featureStyle: {
    fillOpacity: 1,
    strokeWeight: 1,
    strokeOpacity: 0.5
  },
  featureStyleHighlighted: {
    strokeWeight: 2,
    strokeOpacity: 1
  },
  geoJson: null,
  geoJsonOptions: null,
  // Set `legend` to `"none"` to disable the legend.
  legend: {
    // A position string. Valid options are `ControlPosition` locations in the
    // Google Maps API.
    // See: https://developers.google.com/maps/documentation/javascript/ \
    //     controls?hl=pt-br#ControlPositioning
    position: "LEFT_BOTTOM",
    textStyle: {
      color: "#000000",
      fontName: "Arial",
      fontSize: 14,
      bold: false,
      italic: false
    }
  },
  mapsOptions: null,
  mapsBackground: "none", // TODO Implement
  mapsControl: false, // TODO Implement
  tooltip: {
    textStyle: {
      color: "#000000",
      fontName: "Arial",
      fontSize: 13,
      bold: false,
      italic: false
    },
    trigger: "focus" // TODO Implement
  }
};

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

  if (! this.options_.mapsControl) {
    maps_options.disableDefaultUI = true;
    maps_options.scrollwheel = false;
    maps_options.draggable = false;
    maps_options.disableDoubleClickZoom = true;
  } else {
    throw new Error("Invalid `mapsControl` option");
  }

  return maps_options;
};

/**
 * Draw the chart
 *
 * Params:
 *
 * - data: The data (a `google.visualization.DataTable` object with two
         columns);
 * - options: The chart visualization options (check the
         `GeoChart.prototype.DEFAULT_OPTIONS` docs for all options).
 */
GeoChart.prototype.draw = function(data, options={}) {
  this.data_ = data;
  this.options_ = deepMerge_(
      context.GeoChart.prototype.DEFAULT_OPTIONS, options);

  // Create the Google Maps object
  var maps_options = this.getMapsOptions_();
  // TODO We could implement custom zooming when mapsBackground = "none" using
  // custom projections.
  // See: https://groups.google.com/forum/#!topic/google-maps-js-api-
  //     v3/AbOHZlLQLCg
  this.map_ = new google.maps.Map(this.container, maps_options);

  // Load the GeoJSON data
  this.map_.data.loadGeoJson(
      this.options_.geoJson, this.options_.geoJsonOptions,
      function(features) {
        var min = Number.MAX_VALUE;
        var max = -Number.MAX_VALUE;

        // Populate the feature "data-" properties
        for (var row = 0; row < this.data_.getNumberOfRows(); row++) {
          var id = this.data_.getValue(row, 0);
          var value = this.data_.getValue(row, 1);
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
          feature.setProperty("data-label", this.data_.getColumnLabel(1));
          feature.setProperty("data-value", value);
        }
        this.min_ = min;
        this.max_ = max;

        // Create the color axis
        this.color_axis_ = new ColorAxis(this);

        // Create the legend
        // Note that if the option `legend` is set to `"none"`, the legend
        // with be disabled.
        if (this.options_.legend !== "none") {
          var control_position = null;
 
          this.legend_ = new Legend(this);
          control_position = google.maps.ControlPosition[
              this.options_.legend.position];
          this.map_.controls[control_position].push(
              this.legend_.getContainer());
        }

        // Create the tooltip
        this.tooltip_ = new Tooltip(this);

        // Trigger the ready event
        // See: https://developers.google.com/chart/interactive/docs/dev/
        //     events#the-ready-event
        google.visualization.events.trigger(this, "ready", null);
      }.bind(this)
  );

  // Define the feature styles
  this.map_.data.setStyle(function(feature) {
    // Default style
    var style = Object.assign(
        {}, {
          cursor: "default",
          fillColor: this.options_.datalessRegionColor,
          strokeColor: this.options_.datalessRegionStrokeColor
        },
        this.options_.featureStyle);

    // Feature with data style
    // Colorize the features with data (using the gradient colors)
    if (feature.getProperty("data-value") !== undefined) {
      var relative_value = this.getRelativeValue_(
          feature.getProperty("data-value"));

      var colors_to_fill = this.color_axis_.getRelativeColors(relative_value);

      style = Object.assign(style, {
        fillColor: this.color_axis_.toHex(colors_to_fill[0]),
        strokeColor: this.color_axis_.toHex(colors_to_fill[1])
      });

      // Selected feature style
      if (feature.getProperty("data-selected")) {
        style = Object.assign(
            style, this.options_.featureStyleHighlighted,
            {zIndex: SELECTED_Z_INDEX}
        );
      }
    }

    return style;
  }.bind(this));

  // Mouse event handlers

  this.map_.data.addListener("mouseover", function(event) {
    var highlighted_style = Object.assign(
        {}, this.options_.featureStyleHighlighted,
        {zIndex: HIGHLIGHTED_Z_INDEX});

    if (event.feature !== this.feature_selected_) {
      this.map_.data.revertStyle();
      this.map_.data.overrideStyle(event.feature, highlighted_style);
    }
    if (event.feature.getProperty("data-value") !== undefined) {
      if (this.legend_) {
        this.legend_.drawIndicator(event.feature);
      }
    }
  }.bind(this));

  this.map_.data.addListener("mouseout", function(event) {
    if (event.feature !== this.feature_selected_) {
      this.map_.data.revertStyle();
    }
    this.tooltip_.undrawTooltip();
    if (this.legend_) {
      this.legend_.undrawIndicator();
    }
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

GeoChart.prototype.getRelativeValue_ = function(value) {
  return (value - this.min_) / (this.max_ - this.min_);
};

// Entry selected by the user
// See: https://developers.google.com/chart/interactive/docs/reference
//     #getselection
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


// ColorAxis for GeoChart GeoJSON
//
// It's an abstraction that implements the color processment needed to color
// the features and the legend.
//
// The color conversion functions are based on a `njvack`'s Github Gist.
//
// Based on: https://gist.github.com/njvack/02ad8efcb0d552b0230d
//
// Params:
//
// - geoChart: The GeoChart GeoJSON object where this color axis belong to.
var ColorAxis = function(geoChart) {
  this.geo_chart_ = geoChart;

  this.single_value = false;

  this.colors_ = [];
  this.stroke_colors_ = [];
  this.canvas_context_ = null;

  this.initCanvas_();
  this.initColors_();
};

ColorAxis.prototype.initCanvas_ = function() {
  var canvas = null;
  var context = null;

  canvas = document.createElement("canvas");
  canvas.height = 1;
  canvas.width = 1;
  context = canvas.getContext("2d");

  this.canvas_context_ = context;
};

// Convert number to hex string
//
// Turns a number (0-255) into a 2-character hex number (00-ff) as an string.
ColorAxis.prototype.numToHexStr_ = function(num) {
  // Adding a zero padding if necessary
  return ("0" + num.toString(16)).slice(-2);
};

// Convert color to RGBA array
//
// Turns any valid canvas fillStyle into a 4-element Uint8ClampedArray with
// bytes for R, G, B, and A. Invalid styles will return [0, 0, 0, 0].
// Examples:
// toRgbArray('red')  # [255, 0, 0, 255]
// toRgbArray('#ff0000')  # [255, 0, 0, 255]
// toRgbArray('garbagey')  # [0, 0, 0, 0]
//
// This function also can process RGB or RGBA arrays.
ColorAxis.prototype.toRgbaArray = function(color) {
  var a = [];

  // Already receive a RGB or RGBA array cases
  if (Array.isArray(color)) {
    a = color;
    // If receive a RGB array, use `255` as opacity.
    if (color.length === 3) {
      a.push(255);
    }
    return a;
  }

  // Setting an invalid fillStyle leaves this unchanged.
  this.canvas_context_.fillStyle = "rgba(0, 0, 0, 0)";
  // We're reusing the canvas, so fill it with something predictable.
  this.canvas_context_.clearRect(0, 0, 1, 1);
  this.canvas_context_.fillStyle = color;
  this.canvas_context_.fillRect(0, 0, 1, 1);
  a = this.canvas_context_.getImageData(0, 0, 1, 1).data;

  return a;
};

// Convert color to RGB array
ColorAxis.prototype.toRgbArray = function(color) {
  var a = this.toRgbaArray(color);

  return [a[0], a[1], a[2]];
};

// Convert color to RGBA string
//
// Turns any valid canvas fill style (or a RGB or RGBA array) into an RGBA
// string.
// Returns 'rgba(0,0,0,0)' for invalid colors.
// Examples:
// toRgba('red')  # 'rgba(255,0,0,1)'
// toRgba('#f00')  # 'rgba(255,0,0,1)'
// toRgba('garbagey')  # 'rgba(0,0,0,0)'
ColorAxis.prototype.toRgba = function(color) {
  var a = this.toRgbaArray(color);

  return "rgba(" + a[0] + "," + a[1] + "," + a[2] + "," + (a[3]/255) + ")";
};

// Convert color to RGB string
ColorAxis.prototype.toRgb = function(color) {
  var a = this.toRgbaArray(color);

  return "rgb(" + a[0] + "," + a[1] + "," + a[2] + ")";
};

// Convert color to hex string (like "#000000")
//
// Turns any valid canvas fill style into a hex triple.
// Returns '#000000' for invalid colors.
// Examples:
// toHex('red')  # '#ff0000'
// toHex('rgba(255,0,0,1)')  # '#ff0000'
// toHex('garbagey')  # '#000000'
// toHex(some_pattern)  # Depends on the pattern
ColorAxis.prototype.toHex = function(color) {
  var a = this.toRgbArray(color);

  return "#" +
      this.numToHexStr_(a[0]) + this.numToHexStr_(a[1]) +
      this.numToHexStr_(a[2]);
};

ColorAxis.prototype.initColors_ = function() {
  var color_axis_options_ = this.geo_chart_.options_.colorAxis;

  this.colors_ = [
    this.toRgbArray(color_axis_options_.colors[0]),
    this.toRgbArray(color_axis_options_.colors[1])
  ];
  this.stroke_colors_ = [
    this.toRgbArray(color_axis_options_.strokeColors[0]),
    this.toRgbArray(color_axis_options_.strokeColors[1])
  ];

  // Single value case
  // In this case, use a single color (the color of the max value).
  if (this.geo_chart_.min_ === this.geo_chart_.max_) {
    this.single_value = true;

    this.colors_[0] = this.colors_[1];
    this.stroke_colors_[0] = this.stroke_colors_[1];
  }
};

// An array with two colors (fill and stroke)
//
// The colors represent a relative position in the color axis gradients (fill
// and stroke).
ColorAxis.prototype.getRelativeColors = function(rel_pos) {
  var rel_colors = [];

  function get_relative_color(colors, rel_pos) {
    var rel_color = [];
    for (var i = 0; i < 3; i++) {
      rel_color[i] = Math.round(
          (colors[1][i] - colors[0][i]) * rel_pos + colors[0][i]);
    }

    return rel_color;
  }

  // Optimization for the single value case
  if (this.single_value) {
    return [this.colors_[1], this.stroke_colors_[1]];
  }

  rel_colors = [
    get_relative_color(this.colors_, rel_pos),
    get_relative_color(this.stroke_colors_, rel_pos)
  ];

  return rel_colors;
};

// Generate the background gradient CSS string
// See: https://stackoverflow.com/a/16219600
ColorAxis.prototype.getGradientCssStr = function() {
  var gradient_string =
      "background-image: -o-linear-gradient(left, {c1}, {c2}); " +
      "background-image: -moz-linear-gradient(left, {c1}, {c2}); " +
      "background-image: -webkit-linear-gradient(left, {c1}, {c2}); " +
      "background-image: -ms-linear-gradient(left, {c1}, {c2}); " +
      "background: linear-gradient(left, {c1}, {c2})";

  gradient_string = gradient_string.
      replace(/\{c1\}/g, this.toRgb(this.colors_[0])).
      replace(/\{c2\}/g, this.toRgb(this.colors_[1]));

  return gradient_string;
};

context.ColorAxis = ColorAxis;


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

  this.setMap(this.geo_chart_.map_);
};

Tooltip.prototype = new google.maps.OverlayView();

Tooltip.prototype.onAdd = function() {
  // Create the main div
  var div = document.createElement("div");
  var div_style = {};
  div_style = Object.assign(
      {}, {position: "absolute", visibility: "hidden"},
      TOOLTIP_STYLE,
      {zIndex: TOOLTIP_Z_INDEX});
  Object.assign(div.style, div_style);

  var p_style = Object.assign(
      {}, {margin: TOOLTIP_MARGIN + "px"},
      processTextStyle_(this.geo_chart_.options_.tooltip.textStyle));

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
  var s = TOOLTIP_OFFSET;
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
  this.div_.style.top = top + "px";
  this.div_.style.left = left + "px";

  // Show
  this.div_.style.visibility = "visible";
};

Tooltip.prototype.undrawTooltip = function() {
  this.div_.style.visibility = "hidden";
};

context.Tooltip = Tooltip;


// Legend for GeoChart GeoJSON
//
// It's a control to be placed on a Google Maps map.
//
// Params:
//
// - geoChart: The GeoChart GeoJSON object where the legend will be placed.
var Legend = function(geoChart) {
  this.geo_chart_ = geoChart;

  this.div_ = null;
  this.indicator_span_ = null;

  this.draw_();
};

Legend.prototype.draw_ = function() {
  var div = document.createElement("div");

  var div_inner = document.createElement("div");
  Object.assign(
      div_inner.style,
      {marginTop: - LEGEND_INDICATOR_TOP_OFFSET + "px"},
      processTextStyle_(this.geo_chart_.options_.legend.textStyle));

  var min_div =  document.createElement("div");
  min_div.style.padding =
      LEGEND_NUM_PADDING_VERT + "px " + LEGEND_NUM_PADDING_HORIZ + "px";
  min_div.style.display = "table-cell";
  min_div.innerText = this.geo_chart_.min_;
  div_inner.appendChild(min_div);

  var legend_div = document.createElement("div");
  legend_div.style.display = "table-cell";
  legend_div.style.verticalAlign = "middle";
  legend_div.style.position = "relative";
  legend_div.style.padding = "0";
  legend_div.style.margin = "0";
  var legend_div_inner = document.createElement("div");
  legend_div_inner.style.width = LEGEND_WIDTH + "px";
  legend_div_inner.style.height = LEGEND_HEIGHT + "px";
  legend_div_inner.style.padding = "0";
  legend_div_inner.style.margin = "0";
  // See: https://stackoverflow.com/a/16219600
  legend_div_inner.setAttribute(
      "style",
      legend_div_inner.getAttribute("style") + "; " +
          this.geo_chart_.color_axis_.getGradientCssStr());
  legend_div.appendChild(legend_div_inner);
  var indicator_span = document.createElement("span");
  indicator_span.style.fontSize = LEGEND_INDICATOR_SIZE + "px";
  indicator_span.style.top = LEGEND_INDICATOR_TOP_OFFSET + "px";
  indicator_span.style.position = "absolute";
  indicator_span.style.visibility = "hidden";
  indicator_span.innerText = "▼";
  legend_div.appendChild(indicator_span);
  div_inner.appendChild(legend_div);

  var max_div =  document.createElement("div");
  max_div.style.padding =
      LEGEND_NUM_PADDING_VERT + "px " + LEGEND_NUM_PADDING_HORIZ + "px";
  max_div.style.display = "table-cell";
  max_div.innerText = this.geo_chart_.max_;
  div_inner.appendChild(max_div);

  div.appendChild(div_inner);
  this.div_ = div;
  this.indicator_span_ = indicator_span;
};

Legend.prototype.getContainer = function() {
  return this.div_;
};

Legend.prototype.drawIndicator = function(feature) {
  var relative_value = 0;

  // Single value case
  // In this case, put the indicator in the middle.
  if (this.geo_chart_.color_axis_.single_value) {
    relative_value = 0.5;
  // Normal case
  } else {
    relative_value = this.geo_chart_.getRelativeValue_(
        feature.getProperty("data-value"));
  }

  var width = LEGEND_WIDTH;
  this.indicator_span_.style.left =
      (relative_value * width + LEGEND_INDICATOR_LEFT_OFFSET) + "px";
  this.indicator_span_.style.visibility = "visible";
};

Legend.prototype.undrawIndicator = function() {
  this.indicator_span_.style.visibility = "hidden";
};

context.Legend = Legend;


})(geochart_geojson);
