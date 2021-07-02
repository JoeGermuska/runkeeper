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

// with some effort, we should be able to reduce this to just 4 and assign them carefully to avoid adjacent
// polygons with the same fill
// see https://carto.com/blog/sql-graph-coloring/
// or possibly topojson.neighbors
let PALETTE = //['#a6cee3', '#1f78b4', '#b2df8a', '#33a02c', '#fb9a99', '#e31a1c', '#fdbf6f', '#ff7f00', '#cab2d6', '#6a3d9a']
    ['#8dd3c7', '#ffffb3', '#bebada', '#fb8072', '#80b1d3', '#fdb462', '#b3de69', '#fccde5', '#d9d9d9', '#bc80bd']

// places to aim for, or to avoid
const MARKERS = [
    ['star', [-87.75069128840433, 41.976543988127474], 'Single block of Lamon in Forest Glen'],
    ['star', [-87.687310, 42.050672], "Evanston alley along Metra"],
    ['star', [-87.79346, 42.0441005], "Morton Grove near Wayside Woods"],
    ['star', [-87.694676, 41.96675], "1/2 block of Leland btwn Talman and Rockwell"],
    ['star', [-87.764916, 42.004547], "N. Waukesha btw N. Sauganash & N. Dowagiac"],
    ['red-x', [-87.72929, 42.109389], "Winnetka near Sheridan Park"],
]

const ATTENTION_GETTERS_FC = turf.featureCollection(
    MARKERS.map(
        args => turf.point(args[1], { name: args[2], marker: args[0] })
    )
)

const ATTENTION_GETTERS_IMG_URLS = {
    'star': './star-marker.png',
    'red-x': './red-x-marker.png', // red isn't good, and even 16x16 is too big. can we use maki icons?

}

let routes_geojson = null,
    all_features = [],
    all_features_dict = {},
    map = null;


mapboxgl.accessToken = 'pk.eyJ1Ijoiam9lZ2VybXVza2EiLCJhIjoiY2thOXNwNHpwMGp2NDJybnplZHE2NWsxZiJ9.R08AIHjCQZKow3hRRao5MA';

/* 
 * UTILITIES
 */

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
    let zoom = true,
        features = [],
        slugs = [];

    let slug_str = location.hash.substr(1)

    if (slug_str) {
        slugs = slug_str.split(',')
    }

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
        // this lets us be more flexible about the actual color
        // without having to regenerate the combined polys.
        f.properties['fill-color'] = PALETTE[f.properties.color_idx]
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
        paint: { // t odo.. change colors? add borders?
            'line-color': '#333',
            'line-opacity': 1,
            'line-width': 1
        }
    }, 'routes-layer')

    // from https://docs.mapbox.com/mapbox-gl-js/example/polygon-popup-on-click/
    map.on('click', `polygons-fill`, function(e) {
        if (!e.originalEvent.defaultPrevented) {
            new mapboxgl.Popup()
                .setLngLat(e.lngLat)
                .setHTML(titleCase(e.features[0].properties['name']))
                .addTo(map);
        }
        console.log(`map click at ${e.lngLat}`)
    });
}

function addAttentionGetters() {
    // add features source and layer

    Object.keys(ATTENTION_GETTERS_IMG_URLS).forEach(id => {
        let url = ATTENTION_GETTERS_IMG_URLS[id]
        map.loadImage(url, (error, image) => {
            if (error) {
                console.log(`Error loading ${id}: ${error}`)
            } else {
                map.addImage(id, image)
                console.log(`loaded ${id}`)
            }
        })
    })

    map.addSource('attention-getters', {
        type: 'geojson',
        data: ATTENTION_GETTERS_FC
    })


    map.addLayer({
        id: `attention-getters-symbol`,
        type: 'symbol',
        source: 'attention-getters',
        'layout': {
            'icon-image': ['get', 'marker'],
            // get the title name from the source's "title" property
            // 'text-field': ['get', 'text-marker'],
            // 'text-font': [
            //     'Open Sans Semibold',
            //     'Arial Unicode MS Bold'
            // ],
            // 'text-offset': [0, 1.25],
            // 'text-anchor': 'top'
        }
    })
}

function makeOptGroup(name, kids) {
    let grp = document.createElement('optgroup')
    grp.setAttribute('label', name)
    kids.forEach(k => {
        grp.appendChild(k)
    })
    return grp
}

function setupFilterMenu() {
    var select = document.getElementById('focus-poly'),
        places = [],
        commareas = []
    all_features.forEach((f, i) => {
        let opt = document.createElement('option')
        opt.setAttribute('value', f.properties.slug)
        opt.innerText = f.properties.name
        let tup = [f.properties.slug, opt]
        if ('community' in f.properties) {
            commareas.push(tup)
        } else {
            places.push(tup)
        }
    })
    if (places.length > 0) {
        places.sort()
        select.appendChild(makeOptGroup('Cities/Towns', places.map(p => p[1])))
    }
    if (commareas.length > 0) {
        commareas.sort()
        select.appendChild(makeOptGroup('Community Areas', commareas.map(ca => ca[1])))
    }
    select.addEventListener('change', e => {
        window.location.hash = e.target.value
    })

}

function initCircles() {
    let source = map.addSource('circles', {
            type: 'geojson',
            data: turf.featureCollection([])
        })
        // map.addLayer({
        //     id: `circles-fill`,
        //     type: 'fill',
        //     source: 'circles',
        //     paint: {
        //         'fill-color': '#666',
        //         'fill-opacity': 0.3
        //     }
        // })
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
    map.on('click', `circles-line`, function(e) {
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
                const popups = document.getElementsByClassName('mapboxgl-popup');
                if (popups.length) {
                    popups[0].remove();
                }
                new mapboxgl.Popup()
                    .setLngLat(e.lngLat)
                    .setHTML(e.features[0].properties.name)
                    .addTo(map);
                e.originalEvent.stopPropagation()
                e.originalEvent.preventDefault()
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

        let polys_promise = fetchJSON('./all_polys.geojson')
        polys_promise.then(j => {
            // even though all_polys is valid geojson,
            // historically we liked to have them in these
            // forms instead.
            all_features = j.features
            all_features.forEach(f => all_features_dict[f.properties.slug] = f)
        })

        // this is the last stuff after all the data is loaded
        Promise.all([routes_promise, polys_promise]).then(_ => {
            addPolygons()
                // setCircles(1, 10)
            addAttentionGetters()
            setupFilterMenu()
            checkHash()
        })

        map.addControl(new mapboxgl.GeolocateControl({
            trackUserLocation: true
        }))

        window.addEventListener('hashchange', checkHash)

    })


}