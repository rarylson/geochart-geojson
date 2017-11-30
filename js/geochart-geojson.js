// vim: set ts=2 sw=2 et colorcolumn=80 :

/**
 * Package "geochart_geojson"
 *
 * Provides GeoChart with GeoJSON support.
 *
 * Contains the GeoChart class with its subcomponent classes.
 */
let geochart_geojson = {};

(function(context) {


"use strict";


// Constants

// zIndex constants
// The selected (click) and highlighted (hover) features must have a zIndex
// higher than the other features. The tooltip must have a zIndex higher than
// the features and the selected and highlighted features.
const SELECTED_Z_INDEX = 999;
const HIGHLIGHTED_Z_INDEX = 1000;
const TOOLTIP_Z_INDEX = 2000;
// Tooltip constants
const TOOLTIP_STYLE = {
  borderStyle: "solid",
  borderWidth: "1px",
  borderColor: "#cccccc",
  backgroundColor: "#ffffff",
  padding: "4px"
};
const TOOLTIP_MARGIN = 2;
const TOOLTIP_OFFSET = 12;
// Legend constants
const LEGEND_WIDTH = 250;
const LEGEND_HEIGHT = 13;
const LEGEND_NUM_PADDING_VERT = 2;
const LEGEND_NUM_PADDING_HORIZ = 4;
const LEGEND_INDICATOR_SIZE = 12;
const LEGEND_INDICATOR_TOP_OFFSET = -8;
const LEGEND_INDICATOR_LEFT_OFFSET = -6;


// Auxiliary functions

// Process a Google Chart `textStyle` option
//
// Converts a Google Chart `textStyle` option into a valid CSS style object.
function processTextStyle_(textStyle) {
  let style = {};

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
  let obj = {};

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
 * Code based on Google Charts and Google Maps API guides and references.
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
let GeoChart = function(container) {
  this.container = container;

  // The inner datatable
  this.data_ = null;
  // The inner chart options
  this.options_ = null;
  // The inner Google Maps map object
  // This object will hold the GeoJSON map (in its overlay layer), the tooltip
  // overlay and the legend.
  // Optionally, it will also handle the underlying map layer (map, satellite
  // or simple map) and the map control (zoom, map drag). These features are
  // disabled by default.
  this.map_ = null;
  // Inner objects (`ColorAxis`, `Tooltip` and `Legend`)
  this.color_axis_ = null;
  this.tooltip_ = null;
  this.legend_ = null;
  // Min and max values of the DataTable rows
  this.min_ = 0;
  this.max_ = 0;
  // Feature selected by the user
  this.feature_selected_ = null;
  // Datatable has (or doesn't have) values
  this.data_has_values_ = true;
};

// Default GeoChart options
// TODO Document each option.
GeoChart.prototype.DEFAULT_OPTIONS = {
  backgroundColor: "#ffffff",
  colorAxis: {
    colors: ["#efe6dc", "#109618"],
    strokeColors: ["#cccccc", "#888888"],
  },
  datalessRegionColor: "#f5f5f5",
  datalessRegionStrokeColor: "#cccccc",
  defaultColor: "#267114",
  defaultStrokeColor: "#666666",
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
    // Interaction that causes the tooltip to be displayed. Valid options
    // are: "focus", "none" and "selection".
    trigger: "focus"
  }
};

GeoChart.prototype.getMapsOptions_ = function() {
  let maps_options = this.options_.mapsOptions;

  maps_options.backgroundColor = this.options_.backgroundColor;

  if (this.options_.mapsBackground === "none") {
    maps_options.styles = [{
      "stylers": [{"visibility": "off"}]
    }];
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

  // Check if datatable has values
  if (this.data_.getNumberOfColumns() === 2) {
    this.data_has_values_ = true;
  } else if (this.data_.getNumberOfColumns() === 1) {
    this.data_has_values_ = false;
  } else {
    throw new Error("Incompatible datatable (must have one or two columns)");
  }

  // Create the Google Maps object
  let maps_options = this.getMapsOptions_();
  // TODO We could implement custom zooming when mapsBackground = "none" using
  // custom projections.
  // See: https://groups.google.com/forum/#!topic/google-maps-js-api-
  //     v3/AbOHZlLQLCg
  this.map_ = new google.maps.Map(this.container, maps_options);

  // Load the GeoJSON data
  this.map_.data.loadGeoJson(
      this.options_.geoJson, this.options_.geoJsonOptions,
      function(features) {
        let min = Number.MAX_VALUE;
        let max = -Number.MAX_VALUE;

        // Process the datatable values
        for (let row = 0; row < this.data_.getNumberOfRows(); row++) {
          let id = this.data_.getValue(row, 0);
          let value = 0;

          if (this.data_has_values_) {
            value = this.data_.getValue(row, 1);
            // Keep track of min and max values
            if (value < min) {
              min = value;
            }
            if (value > max) {
              max = value;
            }
          }

          // Populate the feature "data-" properties
          let feature = this.map_.data.getFeatureById(id);
          if (feature) {
            feature.setProperty("data-is-data", true);
            feature.setProperty("data-row", row);
            feature.setProperty("data-id", id);
            if (this.data_has_values_) {
              feature.setProperty("data-label", this.data_.getColumnLabel(1));
              feature.setProperty("data-value", value);
            }
          } else {
            console.warn('Region "' + id + '" not found');
          }
        }
        this.min_ = min;
        this.max_ = max;

        // Create the color axis
        this.color_axis_ = new ColorAxis(this);

        // Create the legend
        // Note that if the option `legend` is set to `"none"`, the legend
        // with be disabled.
        // The legend will also be disabled if the datatable doesn't have
        // values or if its is empty.
        if (this.options_.legend !== "none" &&
            this.data_has_values_ && this.data_.getNumberOfRows()) {
          let control_position = null;
 
          this.legend_ = new Legend(this);
          control_position = google.maps.ControlPosition[
              this.options_.legend.position];
          this.map_.controls[control_position].push(
              this.legend_.getContainer());
        }

        // Create the tooltip
        // Note that if the option `tooltip.trigger` is set to `"none"`, the
        // tooltip will be disabled.
        if (this.options_.tooltip.trigger !== "none") {
          this.tooltip_ = new Tooltip(this);
        }

        // Trigger the ready event
        // See: https://developers.google.com/chart/interactive/docs/dev/
        //     events#the-ready-event
        google.visualization.events.trigger(this, "ready", null);
      }.bind(this)
  );

  // Define the feature styles
  this.map_.data.setStyle(function(feature) {
    // Default style
    let style = Object.assign(
        {}, {
          cursor: "default",
          fillColor: this.options_.datalessRegionColor,
          strokeColor: this.options_.datalessRegionStrokeColor
        },
        this.options_.featureStyle);

    // Feature with data style
    // Colorize the features with data (using the gradient colors)
    if (feature.getProperty("data-is-data")) {
      // Feature has value
      if (feature.getProperty("data-value") !== undefined) {
        let relative_value = this.getRelativeValue_(
            feature.getProperty("data-value"));

        let colors_to_fill = this.color_axis_.getRelativeColors(
            relative_value);

        style = Object.assign(style, {
          fillColor: this.color_axis_.toHex(colors_to_fill[0]),
          strokeColor: this.color_axis_.toHex(colors_to_fill[1])
        });
      // Feature without value
      } else {
        style = Object.assign(style, {
          fillColor: this.options_.defaultColor,
          strokeColor: this.options_.defaultStrokeColor,
        });
      }

      // Selected feature
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
  //
  // They handle the highlight and selection events.

  this.map_.data.addListener("mouseover", function(event) {
    if (event.feature !== this.feature_selected_) {
      this.highlightFeature_(event.feature);
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
    if (this.tooltip_ && this.options_.tooltip.trigger === "focus") {
      this.tooltip_.undrawTooltip();
    }
    if (this.legend_) {
      this.legend_.undrawIndicator();
    }
  }.bind(this));

  this.map_.data.addListener("mousemove", function(event) {
    if (this.tooltip_ && this.options_.tooltip.trigger === "focus" &&
        event.feature.getProperty("data-is-data") !== undefined) {
      this.tooltip_.drawTooltip(event.feature, event.latLng);
    }
  }.bind(this));

  this.map_.data.addListener("click", function(event) {
    this.map_.data.revertStyle();
    // Select the feature
    if (event.feature !== this.feature_selected_) {
      if (event.feature.getProperty("data-is-data") !== undefined) {
        this.selectFeature_(event.feature);
        if (this.tooltip_ && this.options_.tooltip.trigger === "selection") {
          this.tooltip_.drawTooltip(event.feature);
        }
      } else {
        this.unselectFeature_();
        if (this.tooltip_ && this.options_.tooltip.trigger === "selection") {
          this.tooltip_.undrawTooltip();
        }
      }
    // Unselect the feature if its already selected
    } else {
      this.unselectFeature_();
      if (this.tooltip_ && this.options_.tooltip.trigger === "selection") {
        this.tooltip_.undrawTooltip();
      }
      this.highlightFeature_(event.feature);
    }
  }.bind(this));

  this.map_.addListener("click", function(event) {
    this.map_.data.revertStyle();
    this.unselectFeature_();
    if (this.tooltip_ && this.options_.tooltip.trigger === "selection") {
      this.tooltip_.undrawTooltip();
    }
  }.bind(this));

};

GeoChart.prototype.highlightFeature_ = function(feature) {
  let highlighted_style = Object.assign(
      {}, this.options_.featureStyleHighlighted,
      {zIndex: HIGHLIGHTED_Z_INDEX});

  this.map_.data.revertStyle();
  this.map_.data.overrideStyle(feature, highlighted_style);
};

GeoChart.prototype.getRelativeValue_ = function(value) {
  return (value - this.min_) / (this.max_ - this.min_);
};

// Get the selected data
//
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

// Set the selected data
//
// See: https://developers.google.com/chart/interactive/docs/reference
//     #setselection
GeoChart.prototype.setSelection = function(selection) {
  let id = "";
  let feature = null;

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
// It's an abstraction that implements the color processment needed to
// colorizing the features and the legend.
//
// The color conversion functions are based on a `njvack`'s Github Gist.
//
// Based on: https://gist.github.com/njvack/02ad8efcb0d552b0230d
//
// Params:
//
// - geoChart: The GeoChart GeoJSON object where this color axis belong to.
let ColorAxis = function(geoChart) {
  this.geo_chart_ = geoChart;

  this.single_value = false;

  this.colors_ = [];
  this.stroke_colors_ = [];
  this.canvas_context_ = null;

  this.initCanvas_();
  this.initColors_();
};

ColorAxis.prototype.initCanvas_ = function() {
  let canvas = null;
  let context = null;

  canvas = document.createElement("canvas");
  canvas.height = 1;
  canvas.width = 1;
  context = canvas.getContext("2d");

  this.canvas_context_ = context;
};

ColorAxis.prototype.initColors_ = function() {
  let color_axis_options_ = this.geo_chart_.options_.colorAxis;

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
  let a = [];

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
  let a = this.toRgbaArray(color);

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
  let a = this.toRgbaArray(color);

  return "rgba(" + a[0] + "," + a[1] + "," + a[2] + "," + (a[3]/255) + ")";
};

// Convert color to RGB string
ColorAxis.prototype.toRgb = function(color) {
  let a = this.toRgbaArray(color);

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
  let a = this.toRgbArray(color);

  return "#" +
      this.numToHexStr_(a[0]) + this.numToHexStr_(a[1]) +
      this.numToHexStr_(a[2]);
};

// Get the colors (fill and stroke) of a relative position between min/max
//
// The colors will be an array with two colors (fill and stroke) and they
// represent the colors of the relative position in the color axis gradients.
ColorAxis.prototype.getRelativeColors = function(rel_pos) {
  let rel_colors = [];

  function get_relative_color(colors, rel_pos) {
    let rel_color = [];

    for (let i = 0; i < 3; i++) {
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
//
// See: https://stackoverflow.com/a/16219600
ColorAxis.prototype.getGradientCssStr = function() {
  let gradient_string =
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
let Tooltip = function(geoChart) {
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
  let div = null;
  let id_span = null;
  let label_span = null;
  let value_span = null;

  // Create the main div
  div = document.createElement("div");
  let div_style = {};
  div_style = Object.assign(
      {}, {position: "absolute", visibility: "hidden"},
      TOOLTIP_STYLE,
      {zIndex: TOOLTIP_Z_INDEX});
  Object.assign(div.style, div_style);

  let p_style = Object.assign(
      {}, {margin: TOOLTIP_MARGIN + "px"},
      processTextStyle_(this.geo_chart_.options_.tooltip.textStyle));

  // Create the first inner paragraph
  let p1 = document.createElement("p");
  Object.assign(p1.style, p_style);
  id_span = document.createElement("span");
  id_span.style.fontWeight = "bold";
  p1.appendChild(id_span);
  div.appendChild(p1);

  // Create the second inner paragraph
  if (this.geo_chart_.data_has_values_) {
    let p2 = document.createElement("p");
    Object.assign(p2.style, p_style);
    label_span = document.createElement("span");
    value_span = document.createElement("span");
    value_span.style.fontWeight = "bold";
    p2.appendChild(label_span);
    p2.appendChild(document.createTextNode(": "));
    p2.appendChild(value_span);
    div.appendChild(p2);
  }

  this.div_ = div;
  this.id_span_ = id_span;
  this.label_span_ = label_span;
  this.value_span_ = value_span;

  this.getPanes().overlayLayer.appendChild(div);
};

Tooltip.prototype.draw = function() {
  // Do not draw anything at first
  return;
};

// Draw tooltip of a feature in the chart
//
// The tooltip will be drawn near the `latLng` point (with a small offset).
// If `latLng` is null, however, it will be drawn at the center of the
// feature.
Tooltip.prototype.drawTooltip = function(feature, latLng=null) {
  // Update text
  let id = feature.getId();
  if (id !== this.id_span_.innerText) {
    this.id_span_.innerText = id;
    if (feature.getProperty("data-value") !== undefined) {
      this.label_span_.innerText = feature.getProperty("data-label");
      this.value_span_.innerText = feature.getProperty("data-value");
    }
  }

  // Set positioning
  let top = 0;
  let left = 0;
  let w = this.div_.offsetWidth;
  let h = this.div_.offsetHeight;

  // Offset from `latLng` case
  if (latLng) {
    let s = TOOLTIP_OFFSET;
    let px = this.getProjection().fromLatLngToDivPixel(latLng);
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
  // Center of the feature case
  //
  // See: https://stackoverflow.com/questions/3081021/how-to-get-the-center- \
  //     of-a-polygon-in-google-maps-v3
  } else {
    let bounds = new google.maps.LatLngBounds();
    feature.getGeometry().forEachLatLng(function(latLng) {
      bounds.extend(latLng);
    });
    let px = this.getProjection().fromLatLngToDivPixel(bounds.getCenter());
    top = px.y - h / 2;
    left = px.x - w / 2;
  }

  this.div_.style.top = top + "px";
  this.div_.style.left = left + "px";

  // Show
  this.div_.style.visibility = "visible";
};

// Undraw the tooltip
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
let Legend = function(geoChart) {
  this.geo_chart_ = geoChart;

  this.div_ = null;
  this.indicator_span_ = null;

  this.draw_();
};

Legend.prototype.draw_ = function() {
  let div = document.createElement("div");

  let div_inner = document.createElement("div");
  Object.assign(
      div_inner.style,
      {marginTop: - LEGEND_INDICATOR_TOP_OFFSET + "px"},
      processTextStyle_(this.geo_chart_.options_.legend.textStyle));

  let min_div =  document.createElement("div");
  min_div.style.padding =
      LEGEND_NUM_PADDING_VERT + "px " + LEGEND_NUM_PADDING_HORIZ + "px";
  min_div.style.display = "table-cell";
  min_div.innerText = this.geo_chart_.min_;
  div_inner.appendChild(min_div);

  let legend_div = document.createElement("div");
  legend_div.style.display = "table-cell";
  legend_div.style.verticalAlign = "middle";
  legend_div.style.position = "relative";
  legend_div.style.padding = "0";
  legend_div.style.margin = "0";
  let legend_div_inner = document.createElement("div");
  legend_div_inner.style.width = LEGEND_WIDTH + "px";
  legend_div_inner.style.height = LEGEND_HEIGHT + "px";
  legend_div_inner.style.padding = "0";
  legend_div_inner.style.margin = "0";
  // Add the background CSS string to the style property
  //
  // See: https://stackoverflow.com/a/16219600
  legend_div_inner.setAttribute(
      "style",
      legend_div_inner.getAttribute("style") + "; " +
          this.geo_chart_.color_axis_.getGradientCssStr());
  legend_div.appendChild(legend_div_inner);
  let indicator_span = document.createElement("span");
  indicator_span.style.fontSize = LEGEND_INDICATOR_SIZE + "px";
  indicator_span.style.top = LEGEND_INDICATOR_TOP_OFFSET + "px";
  indicator_span.style.position = "absolute";
  indicator_span.style.visibility = "hidden";
  indicator_span.innerText = "▼";
  legend_div.appendChild(indicator_span);
  div_inner.appendChild(legend_div);

  let max_div = document.createElement("div");
  max_div.style.padding =
      LEGEND_NUM_PADDING_VERT + "px " + LEGEND_NUM_PADDING_HORIZ + "px";
  max_div.style.display = "table-cell";
  max_div.innerText = this.geo_chart_.max_;
  div_inner.appendChild(max_div);

  div.appendChild(div_inner);
  this.div_ = div;
  this.indicator_span_ = indicator_span;
};

// Get the div container of the legend
Legend.prototype.getContainer = function() {
  return this.div_;
};

// Draw the indicator at the right place above the legend
//
// The indicator will be an arrow.
Legend.prototype.drawIndicator = function(feature) {
  let relative_value = 0;

  // Single value case
  // In this case, put the indicator in the middle of the legend.
  if (this.geo_chart_.color_axis_.single_value) {
    relative_value = 0.5;
  // Normal case
  } else {
    relative_value = this.geo_chart_.getRelativeValue_(
        feature.getProperty("data-value"));
  }

  this.indicator_span_.style.left =
      (relative_value * LEGEND_WIDTH + LEGEND_INDICATOR_LEFT_OFFSET) + "px";
  this.indicator_span_.style.visibility = "visible";
};

Legend.prototype.undrawIndicator = function() {
  this.indicator_span_.style.visibility = "hidden";
};

context.Legend = Legend;


})(geochart_geojson);
