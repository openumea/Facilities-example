/*jshint browser:true, jquery:true, devel:true*/
/*global google:true*/
/*global swedish_params:true, grid_to_geodetic:true*/

(function() {
	"use strict";
	var map;
	var created_polygon = false;
	function initialize() {
		// Pan to a nice view over Umea
		var umea = new google.maps.LatLng(63.825847,20.263035);
		var mapOptions = {
			zoom: 8,
			center: umea,
			mapTypeId: google.maps.MapTypeId.ROADMAP
		};
		map = new google.maps.Map(document.getElementById('map_canvas'), mapOptions);

		plot_facilities();
	}
	function plot_facilities() {
		// First, figure out which file we should fetch
		// Read the package-datastructure from ckan and pick out the newest resource in it.
		var dataset = "anlaggningsdata";
		$.ajax({
			url: "http://openumea.se/api/action/package_show",
			type: "POST",
			data: JSON.stringify({id: dataset}),
			success: function(data, textStatus, jqXHR) {
				if (typeof data === "string") {
					data = JSON.parse(data);
				}
				var resources = data.result.resources;
				var url = resources[0].url;
				var created = new Date(resources[0].created);
				for (var i=1; i < resources.length ; i+=1) {
					var tmp_created = new Date(resources[i].created);
					if (tmp_created > created) {
						created = tmp_created;
						url = resources[i].url;
					}
				}
				if (url !== undefined) {
					load_data(url);
				} else {
					alert("No url found from ckan!");
				}
			}
		});
	}
	function load_data(url) {
		$.ajax({ url: url, success: load_dots});
	}
	function load_dots(data, textStatus, jqXHR) {
		//Parse the xml we got
		var xml = $.parseXML(data);
		var nodes = xml.childNodes[0];
		var serializer = new XMLSerializer();

		for (var i = 0; i < nodes.childNodes.length; i += 1) {
			// We only know how to handle Facility-nodes
			var f = nodes.childNodes[i];
			if (f.tagName === "Facility") {
				var lu_x, lu_y, name;

				for (var j = 0; j < f.childNodes.length ; j += 1) {
					var n = f.childNodes[j];
					//Find and plot the thingie, if it has a position
					if (n.tagName === "Name") {
						name = n.textContent;
					}
					if (n.tagName === "Coordinate") {
						for (var k = 0; k < n.childNodes.length ; k += 1){
							if (n.childNodes[k].tagName === "LU_X") {
								lu_x = n.childNodes[k].textContent;
							}
							if (n.childNodes[k].tagName === "LU_Y") {
								lu_y = n.childNodes[k].textContent;
							}
						}
					}
					// If it got more Polygons, plot them also
					if (n.tagName === "Polygons" && n.childNodes.length > 1) {
						//<Polygon Name="Bjensjöns FVO" Type="Polygon">
						//<Coordinates>
						//<Coordinate LU_X="7074682,7689" LU_Y="138955,2227"/>
						//or
						//<Polygon Name="Gimonäs 9 km" Type="Polyline">
						//<Coordinates>
						//<Coordinate LU_X="7076417,8288" LU_Y="154605,6126"/>
						for (var b = 0; b < n.childNodes.length ; b += 1){
							if (n.childNodes[b].tagName === "Polygon") {
								var p = n.childNodes[b];
								var cordinates = [];
								for (var l = 1 ; l < p.childNodes.length; l += 1){
									if (p.childNodes[l].tagName === "Coordinates") {
										var c = p.childNodes[l];
										for (var m = 1 ; m < c.childNodes.length; m += 1){
											if (c.childNodes[m].tagName === "Coordinate") {
												var cord_attr = c.childNodes[m].attributes;
												cordinates.push({
													lu_x: parseFloat(cord_attr.LU_X.nodeValue),
													lu_y: parseFloat(cord_attr.LU_Y.nodeValue)
												});
											}
										}
									}
								}
								if (cordinates.length > 0) {
									create_polygon(p.attributes.Name.nodeValue, p.attributes.Type.nodeValue, cordinates);
								}
							}
						}
					}
				}
				if (lu_x !== undefined && lu_y !== undefined &&
						lu_x !== "" && lu_y !== "" &&
						lu_x !== " " && lu_y !== " " &&
						name !== undefined) {
					create_dot(lu_x, lu_y, name, "<pre>" + $('<div/>').text(serializer.serializeToString(f)).html() + "</pre>");
				}
			}
		}
	}
	function create_dot(LU_X, LU_Y, Name, data) {
		//Convert from grid
		var geodetic = grid_to_geodetic(LU_X, LU_Y);

		//Create a marker
		var marker = new google.maps.Marker({
			position: new google.maps.LatLng(geodetic[0], geodetic[1]),
			map: map,
			title: Name
		});

		//Create a infowindow
		var infowindow = new google.maps.InfoWindow({content: data});

		//Attatch infowindow to marker
		google.maps.event.addListener(marker, 'click', function() {
			infowindow.open(map,marker);
		});
	}
	function create_polygon(name, type, cords) {
		var poly;
		//convert cords to wsg84 for google maps
		for (var a=0; a < cords.length ; a += 1) {
			var geodetic = grid_to_geodetic(cords[a].lu_x, cords[a].lu_y);
			cords[a] = new google.maps.LatLng(geodetic[0], geodetic[1]);
		}
		if (type === "Polygon") {
			poly = new google.maps.Polygon({
				paths: cords,
				strokeColor: "#FF0000",
				strokeOpacity: 0.8,
				strokeWeight: 2,
				fillColor: "#FF0000",
				fillOpacity: 0.35
			});
		} else if (type === "Polyline") {
			poly = new google.maps.Polyline({
				path: cords,
				strokeColor: "#000000",
				strokeOpacity: 1.0,
				strokeWeight: 2
			});
		} else {
			//console.log("Unknown type : " + type + " typeof " + typeof type);
			return;
		}
		poly.setMap(map);

		//Create a infowindow
		var infowindow = new google.maps.InfoWindow({
			content: name,
			position: cords[0]
		});

		//Attatch infowindow to poly
		google.maps.event.addListener(poly, 'click', function(event) {
			infowindow.open(map);
		});
	}

	//Build the map and everything in it
	google.maps.event.addDomListener(window, 'load', initialize);

	//Set gausskruger parameters to what we expect from data
	swedish_params("sweref_99_2015");
})();
