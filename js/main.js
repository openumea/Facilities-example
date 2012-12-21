(function() {
	var map;
	function initialize() {
		// Pan to a nice view over Umea
		var mapOptions = {
			zoom: 8,
			center: new google.maps.LatLng(63.825847,20.263035),
			mapTypeId: google.maps.MapTypeId.ROADMAP
		};
		map = new google.maps.Map(document.getElementById('map_canvas'),
			mapOptions);

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
				var resources = data.result.resources;
				var url = resources[0].url;
				var created = new Date(resources[0].created);
				for (i=1; i < resources.length ; i+=1) {
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
		})
	}
	function load_data(url) {
		$.ajax({ url: url, success: load_dots});
	}
	function load_dots(data, textStatus, jqXHR) {
		//Parse the xml we got
		var xml = $.parseXML(data);
		var data = xml.childNodes[0];
		var serializer = new XMLSerializer();

		for (i = 0; i < data.childNodes.length; i += 1) {
			// We only know how to handle Facility-nodes
			var f = data.childNodes[i];
			if (f.tagName === "Facility") {
				var lu_x, lu_y, name;

				for (j = 0; j < f.childNodes.length ; j += 1) {
					var n = f.childNodes[j];
					if (n.tagName === "Name") {
						name = n.textContent
					}
					if (n.tagName === "Coordinate") {
						for (k = 0; k < n.childNodes.length ; k += 1){
							var c = n.childNodes[k];
							if (c.tagName === "LU_X") {
								lu_x = c.textContent
							}
							if (c.tagName === "LU_Y") {
								lu_y = c.textContent
							}
						}
					}
				}
				if (lu_x !== undefined && lu_y !== undefined &&
						lu_x !== "" && lu_y !== "" &&
						lu_x !== " " && lu_y !== " " &&
						name !== undefined) {
					create_dot(lu_x, lu_y, name,
							"<pre>"
							+
							$('<div/>').text(serializer.serializeToString(f)).html()
							+
							"</pre>"
							);
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

	//Build the map and everything in it
	google.maps.event.addDomListener(window, 'load', initialize);

	//Set gausskruger parameters to what we expect from data
	swedish_params("sweref_99_2015");
})();
