Geochart GeoJSON
================

Create charts very similar to the [Google Charts geochart](https://developers.google.com/chart/interactive/docs/gallery/geochart), but with GeoJSON support.

The Google Charts geochart is a very interesting project. However, it only generates predetermined maps.

This project makes possible to draw geocharts in custom maps with boundaries defined using GeoJSON.

The above printscreens show two examples: a Geochart GeoJSON of the Rio de Janeiro state (Brazil), and a Geochart GeoJSON of the Rio de Janeiro city (RJ, Brazil).

![Geochart GeoJSON of Rio de Janeiro state, Brazil](readme_img/rio-state-chart.png)
![Geochart GeoJSON of Rio de Janeiro city, RJ, Brazil](readme_img/rio-city-chart.png)

Requirements
------------

This project uses [Google Charts](https://developers.google.com/chart/interactive/docs/) and [Google Maps API](https://developers.google.com/maps/documentation/javascript/tutorial).

Usage
-----

Using Geochart GeoJSON is somehow similar to using [Google Charts geochart](https://developers.google.com/chart/interactive/docs/gallery/geochart). The bigger difference is that Google Charts geochart requires you to inform a region to draw the map, while Geochart GeoJSON requires you to set some Google Maps params and a GeoJSON to draw the map.

The follow example shows an HTML page that draws a Geochart GeoJSON of the Rio de Janeiro state (in Brazil).

```html
<html>
  <head>
    <meta charset="utf-8">
    <title>Geochart GeoJSON example page</title>

    <script type="text/javascript" src="https://www.gstatic.com/charts/loader.js"></script>
    <script src="https://maps.googleapis.com/maps/api/js?key=AIzaSyD-9tSrke72PouQMnMX-a7eZSW0jkFMBWY"></script>
    <script type="text/javascript" src="https://cdn.rawgit.com/rarylson/geochart-geojson/master/build/geochart-geojson.min.js"></script>

    <script type="text/javascript">
      google.charts.load("current");
      google.charts.setOnLoadCallback(drawVisualization);

      function drawVisualization() {

        // Create and populate a data table
        var data = new google.visualization.DataTable();
        data.addColumn("string", "City");
        data.addColumn("number", "Value");
        data.addRows([
          ["Rio de Janeiro", 10],
          ["Maricá", 5],
          ["São João de Meriti", 2],
          ["Niterói", 1],
          ["São Gonçalo", 1]
        ]);

        // Instantiate our Geochart GeoJSON object
        var vis = new geochart_geojson.GeoChart(document.getElementById("mydiv"));

        // Set Geochart GeoJSON options
        var options = {
          mapsOptions: {
            center: {lat: -22.15, lng: -42.9},
            zoom: 8
          },
          geoJson: "https://cdn.rawgit.com/rarylson/geochart-geojson/master/example/rio-state.geojson",
          geoJsonOptions: {
            idPropertyName: "name"
          }
        };

        // Draw our Geochart GeoJSON with the data we created locally
        vis.draw(data, options);
      }
    </script>
  </head>

  <body>
    <div id="mydiv" style="width: 900px; height: 560px;"></div>
  </body>
</html>
```

Notes
-----

This project implements the Google Chart API and tries to implement an interface similar to the Google Charts geochart component.

However, only a very few features are implemented.
