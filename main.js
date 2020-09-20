let EASING = {
    'InOutSine': (x) => -(Math.cos(Math.PI * x) - 1) / 2
}

let FIT_BOUNDS_OPTIONS = {
    padding: 20,
    linear: false,
    duration: 1250,
    easing: EASING.InOutSine
}

let MAP_CENTER = [-87.72294673185576, 42.05386137897145]

let styles = {
    'basic': 'mapbox://styles/joegermuska/cka9sxxuk1td11in6nbg3jvon',
    'frank': 'mapbox://styles/joegermuska/cka9tuolk0n921jse7dggjtll'
}

let PLACES = {
    //            'chicago': '16000US1714000',
    'wilmette': '16000US1782075',
    'winnetka': '16000US1782530',
    'kenilworth': '16000US1739519',
    'evanston': '16000US1724582',
    'glenview': '16000US1729938',
    'northbrook': '16000US1753481',
    'skokie': '16000US1770122',
    'lincolnwood': '16000US1743744',
    'northfield': '16000US1753663',
    'morton-grove': '16000US1750647',
    'harwood-heights': '16000US1733435',
    'norridge': '16000US1753377',
    'niles': '16000US1753000',
    'park-ridge': '16000US1757875',
    'glencoe': '16000US1729652',
    'golf': '16000US1730328'
}

let PLACES_BY_GEOID = {}
Object.keys(PLACES).forEach(k => PLACES_BY_GEOID[PLACES[k]] = k)

let COMMAREAS = []

let PALETTE = //['#a6cee3', '#1f78b4', '#b2df8a', '#33a02c', '#fb9a99', '#e31a1c', '#fdbf6f', '#ff7f00', '#cab2d6', '#6a3d9a']
    ['#8dd3c7', '#ffffb3', '#bebada', '#fb8072', '#80b1d3', '#fdb462', '#b3de69', '#fccde5', '#d9d9d9', '#bc80bd']

let commareas_geojson = null,
    places_geojson = null,
    routes_geojson = null,
    all_features = [],
    all_features_dict = {},
    map = null;

mapboxgl.accessToken = 'pk.eyJ1Ijoiam9lZ2VybXVza2EiLCJhIjoiY2thOXNwNHpwMGp2NDJybnplZHE2NWsxZiJ9.R08AIHjCQZKow3hRRao5MA';

/* 
 * UTILITIES
 */


function slugify(s) {
    return s.toLowerCase().replace(' ', '-')
}


function titleCase(s) {
    let parts = s.split(' '),
        new_parts = []
    parts.forEach(p => {
        new_parts.push(p[0].toUpperCase() + p.slice(1).toLowerCase())
    })
    return new_parts.join(' ')
}

/*
    OPERATIONS
*/

/**
 * Check the value of the hash and update the map accordingly. 
 * Currently handles selective display of polygons.
 * @param {HashChangeEvent} evt
 */
function checkHash(evt) {
    let slugs = location.hash.substr(1).split(','),
        zoom = true,
        features = [];

    if (slugs.length == 0 || slugs[0] == 'all') {
        features = all_features
        zoom = false
    } else {
        slugs.forEach(slug => {
            if (all_features_dict[slug]) {
                features.push(all_features_dict[slug])
            }
        })
    }

    map.getSource('polygons').setData(turf.featureCollection(features))
    if (zoom && features.length > 0) {
        map.fitBounds(turf.bbox(turf.featureCollection(features)), FIT_BOUNDS_OPTIONS)
    }
}

function addSavedPlaces(map) {
    map.addSource('saved-places', {
        type: 'geojson',
        data: './lfl.geojson'
    })

    // layer style reference https://docs.mapbox.com/mapbox-gl-js/style-spec/layers/
    // expressions: https://docs.mapbox.com/mapbox-gl-js/style-spec/expressions/
    map.addLayer({
        id: 'saved-places-show',
        type: 'symbol',
        source: 'saved-places',
        layout: {
            // get the icon name from the source's "icon" property
            'icon-image': ['get', 'icon'],
            // 'icon-color': '#5520b0', seems to break everything
            'text-field': ['get', 'name'],
            'text-font': ['DIN Pro Medium', 'Arial Unicode MS Bold'],
            // 'text-color': '#7e6958', seems to break also?
            'text-size': 11,
            'text-offset': [0, 0.6],
            'text-anchor': 'top'
        },
        paint: {}
    })
}

/**
 * Expects global all_features to have been populated as an array
 * which is the union of different sources for map areas.
 * Currently Census Places and Chicago Community Areas.
 * Adds source, styling, and click handler.
 */
function addPolygons() {

    all_features.forEach((f, i) => {
        f.properties['fill-color'] = PALETTE[i % PALETTE.length]
    })

    // add features source and layer
    map.addSource('polygons', {
        type: 'geojson',
        data: turf.featureCollection(all_features)
    })

    map.addLayer({
        id: `polygons-fill`,
        type: 'fill',
        source: 'polygons',
        paint: {
            'fill-color': ['get', 'fill-color'],
            'fill-opacity': 0.3
        }
    }, 'routes-layer')
    map.addLayer({
        id: `polygons-line`,
        type: 'line',
        source: 'polygons',
        paint: { // todo.. change colors? add borders?
            'line-color': '#333',
            'line-opacity': 1,
            'line-width': 1
        }
    }, 'routes-layer')

    // from https://docs.mapbox.com/mapbox-gl-js/example/polygon-popup-on-click/
    map.on('click', `polygons-fill`, function(e) {
        new mapboxgl.Popup()
            .setLngLat(e.lngLat)
            .setHTML(titleCase(e.features[0].properties['name']))
            .addTo(map);
    });
}

function initCircles() {
    let source = map.addSource('circles', {
        type: 'geojson',
        data: turf.featureCollection([])
    })
    map.addLayer({
        id: `circles-fill`,
        type: 'fill',
        source: 'circles',
        paint: {
            'fill-color': '#666',
            'fill-opacity': 0.3
        }
    })
    map.addLayer({
        id: `circles-line`,
        type: 'line',
        source: 'circles',
        paint: { // todo.. change colors? add borders?
            'line-color': '#333',
            'line-opacity': 1,
            'line-width': 1
        }
    })

    // from https://docs.mapbox.com/mapbox-gl-js/example/polygon-popup-on-click/
    map.on('click', `circles-fill`, function(e) {
        new mapboxgl.Popup()
            .setLngLat(e.lngLat)
            .setHTML(titleCase(e.features[0].properties['label']))
            .addTo(map);
        e.preventDefault()
    });

    return source
}

function setCircles(increment, count) {

    let source = map.getSource('circles')
    if (!source) {
        initCircles()
        source = map.getSource('circles')
    }

    if (!increment) {
        increment = 10
    }
    if (!count) {
        count = 3
    }

    let circles = []

    for (let i = 1; i <= count; i++) {
        let distance = increment * i
        let c = turf.circle(MAP_CENTER, distance, { units: 'miles' })
        c.properties['label'] = (distance) ? `${i} mile` : `${i} miles`
        circles.push(c)
    }

    source.setData(turf.featureCollection(circles))
}

function fetchJSON(url) {
    return new Promise((resolve, reject) => {
        fetch(url).then(r => {
            if (r.status != 200) {
                reject(`${r.status} ${r.statusText}`)
            } else {
                return r.text()
            }
        }).then(t => {
            resolve(JSON.parse(t))
        })
    })
}

let route_playback_start = null,
    route_playback_duration = null

function route_step(timestamp) {
    let duration = 50 // default
    if (!route_playback_start) {
        route_playback_start = timestamp
        console.log(`route_playback_start: ${route_playback_start}`)
        duration = 0
    }
    const elapsed = timestamp - route_playback_start;
    const pct_elapsed = elapsed / route_playback_duration
    var max_idx = parseInt(routes_geojson.features.length * pct_elapsed)
    console.log(`pct_elapsed: ${pct_elapsed} max_idx: ${max_idx}`)

    let fc = turf.featureCollection(routes_geojson.features.slice(0, max_idx))
    map.fitBounds(turf.bbox(routes_geojson), {
        padding: 20,
        linear: true,
        duration: duration,
        // easing: EASING.InOutSine
    })
    map.getSource('routes').setData(fc)
    if (max_idx >= 0 && max_idx < routes_geojson.features.length) {
        window.requestAnimationFrame(route_step)
    } else { // done, so reset
        route_playback_start = null
        route_playback_duration = null
    }
}
/**
 * Given a duration in seconds, play back the routes, so that all are shown by the time 
 * duration has passed.
 * @param {number} playback_duration 
 */
function playRoutes(playback_duration) {
    route_playback_duration = playback_duration * 1000
    window.requestAnimationFrame(route_step)
}


/**
 * Set up the map.
 */
function initMap() {
    /*global*/
    map = new mapboxgl.Map({
        container: 'map', // container id
        style: 'mapbox://styles/joegermuska/cka9tuolk0n921jse7dggjtll', // stylesheet location
        // style: styles.frank,
        center: MAP_CENTER, // starting position [lng, lat]
        zoom: 13 // starting zoom
    });
    map.on('style.load', () => {
        var layers = map.getStyle().layers;
        // Find the index of the first symbol layer in the map style
        var firstSymbolId;
        for (var i = 0; i < layers.length; i++) {
            if (layers[i].type === 'symbol') {
                firstSymbolId = layers[i].id;
                break;
            }
        }

        let routes_promise = fetch('./paths.geojson').then(r =>
            r.text()).then(t => {

            routes_geojson = JSON.parse(t)

            routes_geojson.features.forEach(f => {
                f.properties['date'] = new Date(f.properties.time_str)
            })

            map.fitBounds(turf.bbox(routes_geojson), FIT_BOUNDS_OPTIONS)

            map.addSource('routes', {
                type: 'geojson',
                data: routes_geojson // url
            })

            map.addLayer({
                    'id': 'routes-layer',
                    'type': 'line',
                    'source': 'routes',
                    'layout': {},
                    'paint': {
                        'line-color': [
                            'match', ['get', 'type'],
                            'Cycling', 'red', // '#bd4220',
                            '#5520b0'
                        ],
                        'line-width': 2,
                        'line-opacity': .7
                    }
                },
                firstSymbolId // new layer goes right before this one
            );

            // from https://docs.mapbox.com/mapbox-gl-js/example/polygon-popup-on-click/
            map.on('click', 'routes-layer', function(e) {
                new mapboxgl.Popup()
                    .setLngLat(e.lngLat)
                    .setHTML(e.features[0].properties.name)
                    .addTo(map);
            });

            // Change the cursor to a pointer when the mouse is over the routes layer.
            map.on('mouseenter', 'routes-layer', function() {
                map.getCanvas().style.cursor = 'pointer';
            });

            // Change it back to a pointer when it leaves.
            map.on('mouseleave', 'routes-layer', function() {
                map.getCanvas().style.cursor = '';
            });
        })

        addSavedPlaces(map)

        let commareas_promise = fetchJSON('./commareas.geojson')
        commareas_promise.then(j => {
            commareas_geojson = j
            commareas_geojson.features.forEach(f => {
                f['properties']['slug'] = slugify(f['properties'].community)
                f['properties']['name'] = titleCase(f['properties'].community)
                all_features.push(f)
                all_features_dict[f.properties['slug']] = f
            })
        })

        let places_url = `https://api.censusreporter.org/1.0/geo/show/tiger2018?geo_ids=${Object.values(PLACES).join(',')}`
        let places_promise = fetchJSON(places_url)
        places_promise.then(j => {
            places_geojson = j
            places_geojson.features.forEach(f => {
                // names are ok
                f.properties['slug'] = PLACES_BY_GEOID[f.properties['geoid']]
                all_features.push(f)
                all_features_dict[f.properties['slug']] = f
            })
        })

        Promise.all([routes_promise, commareas_promise, places_promise]).then(_ => {
            addPolygons()
                // setCircles(2, 5)
        })

        map.addControl(new mapboxgl.GeolocateControl({
            trackUserLocation: true
        }))

        window.addEventListener('hashchange', checkHash)
    })


}