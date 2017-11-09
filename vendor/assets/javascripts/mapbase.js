let elevationService;
let map;
let polyline = new Array();
let markers = new Array();
let path = new Array();
let linearDistance = new Array();
let absoluteDistance = new Array();
let down = new Array();
let up = new Array();
let elevator;
let rubberPolyline;
let rubberPolylines = new Array();
let units = "metric";
let generated = false;
let geolocated = true;
let referenceMarker;

function initMap (location) {

  $('input:checkbox').change(
    function(){
      if ($(this).is(':checked')) {
        units = "imperial";
          if (generated != false) {
            toImperial();
          }
        $("#weight").attr("placeholder", "lb");
        $("#pack-weight").attr("placeholder", "lb");
      } else {
        units = "metric";
          if (generated != false) {
            toMetric();
          }
        $("#weight").attr("placeholder", "kg");
        $("#pack-weight").attr("placeholder", "kg");
      }
    });

  if (geolocated == true) {
    currentLocation = new google.maps.LatLng(location.coords.latitude, location.coords.longitude);
  } else {
    currentLocation = {lat: 49.24966, lng: -123.11934};
  }

  elevator = new google.maps.ElevationService();

  let mapOptions = {
    center: currentLocation,
    zoom: 9,
    mapTypeId: google.maps.MapTypeId.ROADMAP,
    draggableCursor:'crosshair'
  }

  map = new google.maps.Map(document.getElementById("map-canvas"), mapOptions);

  google.maps.event.addListener(map, 'click', function(event) {
    plotPoints(event.latLng);
  });

  google.maps.event.addListener(map, 'mousemove', function (event) {
    hudDisplay(event.latLng);
  });

  elevationService = new google.maps.ElevationService();
  let input = document.getElementById('pac-input');
  let searchBox = new google.maps.places.SearchBox(input);
  map.controls[google.maps.ControlPosition.TOP].push(input);
  google.maps.event.addListener(searchBox, 'places_changed', function() {
    let places = searchBox.getPlaces();
    let bounds = new google.maps.LatLngBounds();

    places.forEach(function(place) {
      if (!place.geometry) {
        return;
      }

      let icon = {
        url: place.icon,
        size: new google.maps.Size(71, 71),
        origin: new google.maps.Point(0, 0),
        anchor: new google.maps.Point(17, 34),
        scaledSize: new google.maps.Size(25, 25)
      };

      if (place.geometry.viewport) {
        bounds.union(place.geometry.viewport);
      } else {
        bounds.extend(place.geometry.location);
      }
    });

    map.fitBounds(bounds);
    $("#pac-input").val('');
  });
  $("#pac-input").show();
  $(".loader-container").hide();
}

function reset() {
  generated = true;
  for (let i = 0; i < markers.length; i++) {
    markers[i].setMap(null);
  }
  for (let i = 0; i < polyline.length; i++) {
    polyline[i].setMap(null);
  }
  absoluteDistance = new Array();
  markers = new Array();
  path = new Array();
  polyline = new Array();
  linearDistance = new Array();
  down = new Array();
  up = new Array();
  $('.results').html("&nbsp;");
  $('#difficulty').html('&nbsp;');
  $('#vector').html('&nbsp;');
  function timer() {
    $('#elevation-chart').html('');
  }
  setTimeout(timer, 400);
  $('.bars').fadeOut(300);
}

function undo() {

  if (path.length < 2) {
    reset();
  } else if (generated == true && markers.length == 2) {
    generated = false;
    let lastMarker = markers.length - 1;
    let lastPolyline = polyline.length - 1;
    markers[lastMarker].setMap(null);
    polyline[lastPolyline].setMap(null);
    polyline.pop();
    markers.pop();
  } else {
    let lastPolyline = polyline.length - 1;
    polyline[lastPolyline].setMap(null);
    polyline.pop();
    path.pop();
    absoluteDistance.pop();
    linearDistance.pop();
    down.pop();
    up.pop();
  }

}

function toImperial() {
  $('#elevation-gain').html("&nbsp;");
  $('#elevation-loss').html("&nbsp;");
  $('#distance').html("&nbsp;");
  $('#map-distance').html("&nbsp;");
  $('#starting-elevation').html("&nbsp;");
  $('#finishing-elevation').html("&nbsp;");
  $('#elevation-gain').html((totalUp*3.28084).toFixed(0) + 'ft');
  $('#elevation-loss').html((totalDown * -3.28084).toFixed(0) + 'ft');
  $('#distance').html( (totalAbsoluteDistance/1000*0.62137121212121).toFixed(2) + 'mi');
  $('#map-distance').html( (totalDistance/1000*0.62137121212121).toFixed(2) + 'mi');
  $('#starting-elevation').html((startingElevation*3.28084).toFixed(2) + 'ft');
  $('#finishing-elevation').html((finishingElevation*3.28084).toFixed(2) + 'ft');
}

function toMetric() {
  $('#elevation-gain').html("&nbsp;");
  $('#elevation-loss').html("&nbsp;");
  $('#distance').html("&nbsp;");
  $('#map-distance').html("&nbsp;");
  $('#starting-elevation').html("&nbsp;");
  $('#finishing-elevation').html("&nbsp;");
  $('#elevation-gain').html((totalUp).toFixed(0) + 'm');
  $('#elevation-loss').html((totalDown * -1).toFixed(0) + 'm');
  $('#distance').html( (totalAbsoluteDistance/1000).toFixed(2) + 'km');
  $('#map-distance').html( (totalDistance/1000).toFixed(2) + 'km');
  $('#starting-elevation').html(startingElevation.toFixed(2) + 'm');
  $('#finishing-elevation').html(finishingElevation.toFixed(2) + 'm');
}

function hudDisplay(point) {

  let coordsLabel = document.getElementById("tdCursor");
  let lat = point.lat();
  lat = lat.toFixed(6);
  let lng = point.lng();
  lng = lng.toFixed(6);
  $('#instant-long').html(lng);
  $('#instant-lat').html(lat);
  let locations = new Array();
  let location = new google.maps.LatLng(lat, lng);
  locations.push(location);
  let positionRequest = { 'locations': locations }

  elevator.getElevationForLocations(positionRequest, function (results, status) {
    if (status == google.maps.ElevationStatus.OK) {
      if (path.length >= 1) {
        let lastElement = path[path.length - 1]
        let lastLat = lastElement.lat();
        let lastLng = lastElement.lng();
        let vector = google.maps.geometry.spherical.computeDistanceBetween(lastElement, point);
        let segmentHeading = this.google.maps.geometry.spherical.computeHeading(lastElement, point);
        let heading1;
        let heading2;

        let rubberPath = [
          {lat: lastLat, lng: lastLng},
          {lat: point.lat(), lng: point.lng()}
        ];
        let rubberOptions = {
          path: rubberPath,
          strokeColor: '#FF0000',
          strokeOpacity: 1.0,
          strokeWeight: 1,
          geodesic: true,
          map: map
        };

        switch(true) {
          case ( segmentHeading >= -180 && segmentHeading < -135 ):
            segmentHeading = (segmentHeading + 180).toFixed(2);
            heading1="W";
            heading2="S";
            break;
          case ( segmentHeading >= -135 && segmentHeading < -90 ):
            segmentHeading = ((-1 * segmentHeading) - 90).toFixed(2);
            heading1="S";
            heading2="W";
            break;
          case ( segmentHeading >= -90 && segmentHeading < -45 ):
            segmentHeading = (segmentHeading + 90).toFixed(2);
            heading1="N";
            heading2="W";
            break;
          case ( segmentHeading >= -45 && segmentHeading < 0 ):
            segmentHeading = (-1 * segmentHeading).toFixed(2);
            heading1="W";
            heading2="N";
            break;
          case ( segmentHeading >= 0 && segmentHeading < 45 ):
            segmentHeading = (segmentHeading).toFixed(2);
            heading1="E";
            heading2="N";
            break;
          case ( segmentHeading >= 45 && segmentHeading < 90 ):
            segmentHeading = (90 - segmentHeading).toFixed(2);
            heading1="N";
            heading2="E";
            break;
          case ( segmentHeading >= 90 && segmentHeading < 135 ):
            segmentHeading = (segmentHeading - 90).toFixed(2);
            heading1="S";
            heading2="E";
            break;
          case ( segmentHeading >= 135 && segmentHeading < 180 ):
            segmentHeading = (180 - segmentHeading).toFixed(2);
            heading1="E";
            heading2="S";
            break;
          default:
            segmentHeading = "Error";
        }

        if (units == "metric") {
          $('#instant-elev').html(results[0].elevation.toFixed(2) + 'm ');
            if (vector > 10000) {
              $('#vector').html((vector/1000).toFixed(2) + 'km ');
            } else {
              $('#vector').html(vector.toFixed(2) + 'm ');
            }
        } else {
          $('#instant-elev').html((results[0].elevation*3.28084).toFixed(2) + 'ft ');
            $('#vector').html((vector*0.000621371).toFixed(2) + 'mi ');
        }

      $('#heading-degrees').html(segmentHeading);
      $('#heading1').html(heading1);
      $('#heading2').html(heading2);

      } else {

        if (units == "metric") {
          $('#instant-elev').html(results[0].elevation.toFixed(2) + 'm ');
        } else {
          $('#instant-elev').html((results[0].elevation*3.28084).toFixed(2) + 'ft ')
        }
      }
    }
  });
}

function plotPoints(theLatLng) {
  generated = false;
  if (path.length >= 1) {
    let lastElement = path[path.length - 1];
    let vector = google.maps.geometry.spherical.computeDistanceBetween(lastElement, theLatLng);
    let segmentHeading = this.google.maps.geometry.spherical.computeHeading(lastElement, theLatLng);

    linearDistance.push(vector);
  }
  path.push(theLatLng);

  if (path.length == 1) {
    markers.push(new google.maps.Marker({
      position: theLatLng,
      map: map
    }));
  }

  let pathOptions = {
    path: path,
    strokeColor: '#0000CC',
    opacity: 0.4,
    geodesic: true,
    map: map
  }

  polyline.push(new google.maps.Polyline(pathOptions));
}

function plottingComplete() {
  if (path.length < 2) {
    alertDrawFirst();
  } else if (generated == true) {
    alertNoNewPaths();
  } else {
    generated = true;
    $('#difficulty').html('&nbsp;');
    $('.results').html("&nbsp;");

    let lastMarker = path[path.length - 1]
    markers.push(new google.maps.Marker({
      position: lastMarker,
      map: map
    }));

    window.samples = $('#user-form > input[name="samples"]').val();
    if (units == "imperial") {
      window.weight = ($('#user-form > input[name="weight"]').val())/2.20462;
      window.pWeight = ($('#user-form > input[name="pack-weight"]').val())/2.20462;
    } else {
      window.weight = $('#user-form > input[name="weight"]').val();
      window.pWeight = $('#user-form > input[name="pack-weight"]').val();
    }
    window.totalDistance = linearDistance.reduce(function(a, b) { return a + b; }, 0);

    let pathOptions = {
      path: path,
      strokeColor: '#0000CC',
      opacity: 0.4,
      map: map
    }

    polyline.push(new google.maps.Polyline(pathOptions));

    let pathRequest = {
      'path': path,
      'samples': parseInt(samples)
    }

    elevationService.getElevationAlongPath(pathRequest, plotElevation);
  }
}

function plotElevation(results, status) {
  let energy = 0;
  let adjacent = (totalDistance/(samples - 1));
  let totalWeight = (pWeight + weight);
  let lowest = 0
  let data = {}
    if (status == google.maps.ElevationStatus.OK) {
      elevations = results;

        for (let i = 0; i < results.length; i++) {
            if (elevations[i].elevation == elevations[0].elevation){
              highest = elevations[i].elevation;
            } else if (highest <= elevations[i].elevation) {
              highest = elevations[i].elevation;
            } else if (elevations[i].elevation <= lowest) {
              lowest = elevations[i].elevation;
            }
        }

        let graphHeight = highest - lowest;
        let spacing = 1/(results.length)
        let screenHeight = $('#elevation-chart').height();
        let screenWidth = $('#elevation-chart').width();

        for (let i = 0; i < results.length; i++) {
          hoverLat = (elevations[i].location.lat(["[[Scopes]]"]["0"].a));
          hoverLng = (elevations[i].location.lng(["[[Scopes]]"]["0"].a));

        if (lowest>=0){
          $('<div class="bars" onmouseover="referenceMap('+hoverLat+','+hoverLng+','+elevations[i].elevation+');" onmouseleave="stopReference();" style="margin-top:'+(screenHeight-((elevations[i].elevation*screenHeight)/highest))+'px; width:'+(screenWidth*spacing)+'px; height:'+(elevations[i].elevation*screenHeight)/highest+'px">  <span class="tooltiptext" style="bottom:'+((screenHeight*elevations[i].elevation/highest)+18)+'px; left:'+(screenWidth*spacing*(i+1))+'">Latitude: '+hoverLat+'<br>Longitude: '+hoverLng+'<br>Elevation: '+elevations[i].elevation+'</span></div>').appendTo("#elevation-chart").hide().fadeIn(3000);
        } else if (lowest < 0){
          if (elevations[i].elevation > 0){
            $('<div class="bars" onmouseover="referenceMap('+hoverLat+','+hoverLng+','+elevations[i].elevation+');" onmouseleave="stopReference();" style="margin-top:'+(screenHeight-(-1*lowest*screenHeight/graphHeight)-(elevations[i].elevation*screenHeight/graphHeight))+'px; width:'+(screenWidth*spacing)+'px; margin-bottom:'+(-1*lowest*screenHeight/graphHeight)+'px; height:'+(elevations[i].elevation*screenHeight/graphHeight)+'px"><span class="tooltiptext" style="bottom:'+((elevations[i].elevation*screenHeight/graphHeight)+(-1*lowest*screenHeight/graphHeight)+18)+'px; left:'+(screenWidth*spacing*(i+1))+'">Latitude: '+hoverLat+'<br>Longitude: '+hoverLng+'<br>Elevation: '+elevations[i].elevation+'</span></div>').appendTo("#elevation-chart").hide().fadeIn(3000);
          } else if (elevations[i].elevation < 0) {
              $('<div class="bars"  onmouseover="referenceMap('+hoverLat+','+hoverLng+','+elevations[i].elevation+');" onmouseleave="stopReference();" style="margin-top:'+(highest*screenHeight/graphHeight)+'px; width:'+(screenWidth*spacing)+'px; margin-bottom:'+(screenHeight-(highest*screenHeight/graphHeight)-((elevations[i].elevation*screenHeight)/lowest))+'px; height:'+((elevations[i].elevation*screenHeight)/(-1*graphHeight))+'px"><span class="tooltiptext" style="bottom:'+((lowest*-1*screenHeight/graphHeight)+18)+'px; left:'+(screenWidth*spacing*(i+1))+'">Latitude: '+hoverLat+'<br>Longitude: '+hoverLng+'<br>Elevation: '+elevations[i].elevation+'</span></div>').appendTo("#elevation-chart").hide().fadeIn(3000);
          } else {
              $('<div class="bars"  onmouseover="referenceMap('+hoverLat+','+hoverLng+','+elevations[i].elevation+');" onmouseleave="stopReference();" style="width:'+(screenWidth*spacing)+'px; height:'+(screenHeight)+'px; background-color: rgba(27, 32, 37, 0.0);"><span class="tooltiptext" style="bottom:'+((lowest*-1*screenHeight/graphHeight)+18)+'px; left:'+(screenWidth*spacing*(i+1))+'">Latitude: '+hoverLat+'<br>Longitude: '+hoverLng+'<br>Elevation: '+elevations[i].elevation+'</span></div>').appendTo("#elevation-chart").hide().fadeIn(3000);
          }
        }
      }

        for (let i = 0; i < elevations.length - 1; i++) {
          absoluteDistance.push(((adjacent**2)+((elevations[i+1].elevation - elevations[i].elevation)**2))**0.5);
          if (elevations[i+1].elevation - elevations[i].elevation >= 0) {
            up.push(elevations[i+1].elevation - elevations[i].elevation);
          } else {
            down.push(elevations[i+1].elevation - elevations[i].elevation);
          }
        }

      window.startingElevation = elevations[0].elevation;
      window.finishingElevation = elevations[samples - 1].elevation;
      window.totalAbsoluteDistance = absoluteDistance.reduce(function(a, b) { return a + b; }, 0);
      let pace = (totalAbsoluteDistance / 2000).toFixed(1);
      window.totalUp = up.reduce(function(a, b) { return a + b; }, 0);
      window.totalDown = down.reduce(function(a, b) { return a + b; }, 0);
      let averageGrade = ((finishingElevation - startingElevation)/totalDistance)*100;

    if (units == "imperial"){
      $('#elevation-gain').append((totalUp*3.28084).toFixed(0) + 'ft');
      $('#elevation-loss').append((totalDown * -3.28084).toFixed(0) + 'ft');
      $('#distance').append( (totalAbsoluteDistance/1000*0.62137121212121).toFixed(2) + 'mi');
      $('#map-distance').append( (totalDistance/1000*0.62137121212121).toFixed(2) + 'mi');
      $('#starting-elevation').append((startingElevation*3.28084).toFixed(2) + 'ft');
      $('#finishing-elevation').append((finishingElevation*3.28084).toFixed(2) + 'ft');
    } else {
      $('#elevation-gain').append((totalUp).toFixed(0) + 'm');
      $('#elevation-loss').append((totalDown * -1).toFixed(0) + 'm');
      $('#distance').append( (totalAbsoluteDistance/1000).toFixed(2) + 'km');
      $('#map-distance').append( (totalDistance/1000).toFixed(2) + 'km');
      $('#starting-elevation').append(startingElevation.toFixed(2) + 'm');
      $('#finishing-elevation').append(finishingElevation.toFixed(2) + 'm');
    }
    $('#completion-time').append('~' + pace + 'hrs');
    $('#average-grade').append(averageGrade.toFixed(2) + '%');

    let difficulty;

    switch(true) {
      case ( totalUp >= 15000 ):
        difficulty = "Extreme Terrain";
        break;
      case ( totalUp >= 5000 && pace > 15 ):
        difficulty = "Extreme Endurance";
        break;
      case ( totalUp >= 3000 && pace > 8 ):
        difficulty = "Difficult Hike";
        break;
      case ( totalUp >= 2000 && pace > 6):
        difficulty = "Moderate Hike";
        break;
      case ( totalUp > 300 && pace > 1.5):
        difficulty = "Moderate Hike";
        break;
      case ( totalUp >= 150 && pace > 1 ):
        difficulty = "Easy Hike";
        break;
      case ( totalUp < 150 && pace > 0.6 ):
        difficulty = "Quick Hike";
        break;
      default:
        difficulty = "Short Walk";
    }

    energy = (totalWeight * -9.81 * totalDown * 0.000239006 / 0.3) + (totalWeight * 9.81 * totalUp * 0.000239006 / 0.2) + (45 * (totalAbsoluteDistance/1000)) + (weight * pace);

    let efficiency;
      if (averageGrade >= 0) {
        efficiency = (totalUp * 100 / (totalUp + (-1 * totalDown)))
      } else {
        efficiency = (totalDown * -100 / (totalUp + (-1 * totalDown)))
      }

    $('#path-efficiency').append(efficiency.toFixed(2) + '%')
    $('#calories').append(energy.toFixed(0));
    $('#difficulty').append(difficulty);
  }

}

$(document).ready(function (){
  navigator.geolocation.getCurrentPosition(initMap,
    function (error) {
      if (error.code == error.PERMISSION_DENIED) {
        $(".loader-1").css("display", "none");
        $(".loader-1-hidden").fadeIn("slow", function(){
          $(".loader-1-hidden").css("display", "block");
        });
        $(".loader-text-1").fadeIn("slow", function(){
          $(".loader-text-1").html("&nbsp; Location request blocked");
        });
        $("#map-canvas").append("<div class='loader-container'><div class='loader'></div><div class='loader-text'> &nbsp; Defaulting to Vancouver, BC...</div></div>");
        geolocated = false;
        setTimeout(initMap, 3500);
      }
    });
  document.getElementById("samples").defaultValue = "300";
});

function openHelp() {
  $(".nerds").css("z-index","1");
  $(".help-overlay-header").css("z-index","3");
  document.getElementById("helpSlider").style.width = "100%";
  document.getElementById("helpSliderHeader").style.width = "100%";
  $(".help").html("&#9432; Close");
  $(".help").attr("onclick","closeHelp()");
  $(".help").css("z-index","4");
  $(".help").css("position","fixed");
}

function closeHelp() {
  function timer() {$(".nerds").css("z-index","2");}
  setTimeout(timer, 500);
  document.getElementById("helpSlider").style.width = "0%";
  document.getElementById("helpSliderHeader").style.width = "0%";
  $(".help").html("&#9432;&nbsp;Help");
  $(".help").attr("onclick","openHelp()");
  $(".help").css("position","absolute");
}

function openNerds() {
  $(".help").css("z-index","1");
  $(".nerds-overlay-header").css("z-index","3");
  document.getElementById("nerdsSlider").style.width = "100%";
  document.getElementById("nerdsSliderHeader").style.width = "100%";
  $(".nerds").html("&int; &nbsp;Close");
  $(".nerds").attr("onclick","closeNerds()");
  $(".nerds").css("z-index","4");
  $(".nerds").css("position","fixed");
}

function closeNerds() {
  $(".nerds-overlay-header").css("background-color", "rgba(0,0,0, 0.9)");
  function timer() {$(".help").css("z-index","2");}
  setTimeout(timer, 500);
  document.getElementById("nerdsSlider").style.width = "0%";
  document.getElementById("nerdsSliderHeader").style.width = "0%";
  $(".nerds").html("&int; &nbsp;Nerds");
  $(".nerds").attr("onclick","openNerds()");
  $(".nerds").css("position","absolute");
}

function closeAlert() {
  $(".alert-warning").css("opacity","0");
  function timer() {$(".alert-warning").css("z-index","-1");}
  setTimeout(timer, 500);
}

function alertDrawFirst() {
  $(".alert-warning").css("opacity","1");
  $(".alert-warning").css("z-index","5");
  $(".alert-warning").html('Draw a path first!<span class="close-alert-btn" onclick="closeAlert()">&nbsp;&times;</span>');
  setTimeout(closeAlert, 7500);
}

function alertNoNewPaths() {
  $(".alert-warning").css("opacity","1");
  $(".alert-warning").css("z-index","5");
  $(".alert-warning").html('No new paths added!<span class="close-alert-btn" onclick="closeAlert()">&nbsp;&times;</span>');
  setTimeout(closeAlert, 7500);
}

function referenceMap(lat,lng,elev) {
  if (referenceMarker != null) {
  referenceMarker.setMap(null);
  }
  referenceMarker = new google.maps.Marker({
    position: {lat:lat, lng:lng},
    map: map,
    icon: {path: google.maps.SymbolPath.BACKWARD_CLOSED_ARROW,
          scale: 4
        }
  })
}

function stopReference() {
  referenceMarker.setMap(null);
}
