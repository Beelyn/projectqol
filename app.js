mapboxgl.accessToken = 'pk.eyJ1IjoiYnJvb2sxMjM0IiwiYSI6ImNsbWhyMXJkajA3NDkzZnFzZXV6YW5lZ3QifQ.DxTQHB79qDgP4XTX_GbpKA';

const map = new mapboxgl.Map({
    container: 'map',
    style: 'mapbox://styles/mapbox/outdoors-v11',
    center: [100.60766, 14.06938],
    zoom: 10,
    pitch: 60,
    bearing: -60,
    antialias: true
});

let startPoint = null;
let endPoint = null;
let totalDistance = 0;
let totalTime = 0;
let colors = ['#FF5733', '#33FF57', '#3357FF', '#FF33A1', '#A133FF', '#FF8C33'];
let currentColorIndex = 0;
let segmentsData = [];
let segmentHeaders = [];

const transportationTypes = ['driving-traffic', 'cycling', 'walking'];

map.on('load', function() {
    map.addSource('mapbox-dem', {
        'type': 'raster-dem',
        'url': 'mapbox://mapbox.mapbox-terrain-dem-v1',
        'tileSize': 512,
        'maxzoom': 14
    });
    map.setTerrain({ 'source': 'mapbox-dem', 'exaggeration': 1.5 });
    map.addLayer({
        'id': '3d-buildings',
        'source': 'composite',
        'source-layer': 'building',
        'filter': ['==', 'extrude', 'true'],
        'type': 'fill-extrusion',
        'minzoom': 15,
        'paint': {
            'fill-extrusion-color': '#aaa',
            'fill-extrusion-height': ['get', 'height'],
            'fill-extrusion-base': ['get', 'min_height'],
            'fill-extrusion-opacity': 0.6
        }
    });
});
//Geo code
function geocodeDestination(query, callback) {
    const geocodingAPI = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?access_token=${mapboxgl.accessToken}`;

    fetch(geocodingAPI)
        .then(response => response.json())
        .then(data => {
            if (data && data.features && data.features.length) {
                callback(data.features);
            } else {
                callback([]);
            }
        })
        .catch(error => {
            console.error("Error fetching geocoding data:", error);
            callback([]);
        });
}

//Dynamic Fetch route
function fetchRoute(start, end, type, callback) {
    const directionsAPI = `https://api.mapbox.com/directions/v5/mapbox/${type}/${start[0]},${start[1]};${end[0]},${end[1]}?geometries=geojson&access_token=${mapboxgl.accessToken}`;

    fetch(directionsAPI)
        .then(response => response.json())
        .then(data => {
            if (data && data.routes && data.routes[0] && data.routes[0].geometry) {
                const routeCoordinates = data.routes[0].geometry.coordinates;
                const distance = data.routes[0].distance / 1000;
                const duration = data.routes[0].duration / 60;
                callback(routeCoordinates, distance, duration);
            } else {
                callback(null, 0, 0);
            }
        })
        .catch(error => {
            console.error("Error fetching route:", error);
            callback(null, 0, 0);
        });
        

}



//Transportation and QOL Scores table

function updateTransportationTable() {
    const thead = document.querySelector('#transportationTable thead');
    const tbody = document.querySelector('#transportationTable tbody');

    // Clear existing rows
    while (thead.firstChild) {
        thead.removeChild(thead.firstChild);
    }
    while (tbody.firstChild) {
        tbody.removeChild(tbody.firstChild);
    }

    // Create header row
    const headerRow = document.createElement('tr');
    const emptyHeader = document.createElement('th'); // Empty cell for top-left corner
    headerRow.appendChild(emptyHeader);
    transportationTypes.forEach(type => {
        const header = document.createElement('th');
        header.textContent = type;
        headerRow.appendChild(header);
    });
    thead.appendChild(headerRow);

    // Populate rows with segment data
    segmentsData.forEach((segment, index) => {
        const row = document.createElement('tr');

        const segmentHeader = document.createElement('td');
        segmentHeader.textContent = `Segment ${index + 1}`;
        row.appendChild(segmentHeader);

        transportationTypes.forEach(type => {
            const cell = document.createElement('td');
            if (type === 'driving-traffic') {
                cell.textContent = `${segment.distance} km, ${segment.time} mins`;
            } else {
                fetchRoute(segment.start, segment.end, type, function(_, distance, duration) {
                    cell.textContent = `${distance.toFixed(2)} km, ${duration.toFixed(2)} mins`;
                });
            }
            row.appendChild(cell);
        });

        tbody.appendChild(row);
    });
    
    updateQOLTable();

}

//QOL calculation
function calculateQOLScore(distance, time) {
    const variables = [distance, time];
    const weights = [4, 1.66];

    let weightedSum = 0;
    for (let i = 0; i < variables.length; i++) {
        weightedSum += variables[i] * weights[i];
    }

    return weightedSum / variables.length;
}

function updateQOLTable() {
    const thead = document.querySelector('#qolTable thead');
    const tbody = document.querySelector('#qolTable tbody');

    // Clear existing rows
    while (thead.firstChild) {
        thead.removeChild(thead.firstChild);
    }
    while (tbody.firstChild) {
        tbody.removeChild(tbody.firstChild);
    }

    // Create header row
    const headerRow = document.createElement('tr');
    const emptyHeader = document.createElement('th'); // Empty cell for top-left corner
    headerRow.appendChild(emptyHeader);
    transportationTypes.forEach(type => {
        const header = document.createElement('th');
        header.textContent = type;
        headerRow.appendChild(header);
    });
    thead.appendChild(headerRow);

    // Populate rows with QOL scores
    segmentsData.forEach((segment, index) => {
        const row = document.createElement('tr');

        const segmentHeader = document.createElement('td');
        segmentHeader.textContent = `Segment ${index + 1}`;
        row.appendChild(segmentHeader);

        transportationTypes.forEach(type => {
            const cell = document.createElement('td');
            if (type === 'driving-traffic') {
                const qolScore = calculateQOLScore(segment.distance, segment.time);
                cell.textContent = qolScore.toFixed(2);
            } else {
                fetchRoute(segment.start, segment.end, type, function(_, distance, duration) {
                    const qolScore = calculateQOLScore(distance, duration);
                    cell.textContent = qolScore.toFixed(2);
                });
            }
            row.appendChild(cell);
        });

        tbody.appendChild(row);
    });
}






//Add type box
document.getElementById('addDestination').addEventListener('click', function() {
    const inputWrapper = document.createElement('div');
    inputWrapper.className = 'inputWrapper';

    const newInput = document.createElement('input');
    newInput.type = 'text';
    newInput.className = 'destinationInput';
    newInput.placeholder = 'Type a destination...';
    inputWrapper.appendChild(newInput);

    const suggestionsBox = document.createElement('div');
    suggestionsBox.className = 'suggestions';
    inputWrapper.appendChild(suggestionsBox);

    document.getElementById('destinationInputs').appendChild(inputWrapper);
});
//Geocoding box
document.getElementById('destinationInputs').addEventListener('input', function(e) {
    if (e.target && e.target.className === 'destinationInput') {
        const query = e.target.value;
        const suggestionsBox = e.target.nextElementSibling;

        geocodeDestination(query, function(suggestions) {
            suggestionsBox.innerHTML = '';

            suggestions.forEach(suggestion => {
                const p = document.createElement('p');
                p.textContent = suggestion.place_name;
                p.addEventListener('click', function() {
                    e.target.value = suggestion.place_name;
                    suggestionsBox.innerHTML = '';
                });
                suggestionsBox.appendChild(p);
            });
        });
    }
});

document.getElementById('destinationInputs').addEventListener('change', function(e) {
    if (e.target && e.target.className === 'destinationInput') {
        const query = e.target.value;
        geocodeDestination(query, function(suggestions) {
            if (suggestions.length) {
                const coordinates = suggestions[0].center;
                new mapboxgl.Marker({ color: colors[currentColorIndex] }).setLngLat(coordinates).addTo(map);
                
                if (!startPoint) {
                    startPoint = coordinates;
                    endPoint = coordinates;
                } else //route driving-traffic and drawline
                {
                    fetchRoute(endPoint, coordinates, 'driving-traffic', function(routeCoordinates, distance, duration) {
                        if (routeCoordinates) {
                            const segmentInfo = {
                                start: endPoint,
                                end: coordinates,
                                distance: distance.toFixed(2),
                                time: duration.toFixed(2),
                                color: colors[currentColorIndex]
                            };
                            segmentsData.push(segmentInfo);
                            //this line is After updating the segmentsData array:
                            
                            map.addLayer({
                                'id': `route-${currentColorIndex}`,
                                'type': 'line',
                                'source': {
                                    'type': 'geojson',
                                    'data': {
                                        'type': 'Feature',
                                        'properties': {},
                                        'geometry': {
                                            'type': 'LineString',
                                            'coordinates': routeCoordinates
                                        }
                                    }
                                },
                                'layout': {
                                    'line-join': 'round',
                                    'line-cap': 'round'
                                },
                                'paint': {
                                    'line-color': colors[currentColorIndex],
                                    'line-width': 4
                                }
                            });

                            //Total Distance and total time in html
                            currentColorIndex = (currentColorIndex + 1) % colors.length;

                            totalDistance += distance;
                            totalTime += duration;
                            document.getElementById('totalDistance').textContent = totalDistance.toFixed(2);
                            document.getElementById('totalTime').textContent = totalTime.toFixed(2);

                            endPoint = coordinates;

                            //segment information:

                            const li = document.createElement('li');
                            li.textContent = `From [${segmentInfo.start}] to [${segmentInfo.end}]: Distance = ${segmentInfo.distance} km, Time = ${segmentInfo.time} mins`;
                            document.getElementById('segments').appendChild(li);

                            const th = document.createElement('th');
                            th.textContent = `Segment ${segmentsData.length}`;
                            document.querySelector('#transportationTable thead tr').appendChild(th);

                            updateTransportationTable();
                        }
                    });
                }

                const li = document.createElement('li');
                li.textContent = `Lat: ${coordinates[1].toFixed(4)}, Lng: ${coordinates[0].toFixed(4)}`;
                document.getElementById('points').appendChild(li);
            }
        });
    }
});




