function checkHash(force_all) {
    let hash_str = location.hash

    if (force_all == 'force' && !hash_str) {
        hash_str = '#all'
    }

    let zoom = true,
        bounds = null

    if (hash_str[0] == '#') {
        let active_places = hash_str.substr(1).split(',')
        if (active_places.indexOf('all') == 0) {
            active_places = Object.keys(PLACES)
            zoom = false
        }

        // yes it's janky to do places and commareas separately
        // but i don't feel making one source that has cross-compatible
        // IDs and such so...
        Object.keys(PLACES).forEach((place, i) => {
            clearLayers(map, place)
            if (active_places.indexOf(place) != -1) {
                let feature = null;
                places_geojson['features'].forEach(f => {
                        if (f.properties.geoid == PLACES[place]) {
                            feature = f
                        }
                    })
                    // if (zoom && feature) bounds = extendBounds(bounds, feature)
                addLayers(map, place,
                        'places', // source
                        ["==", ["get", "geoid"], PLACES[place]], // filter
                        PALETTE[i % PALETTE.length], // fill
                        'name') // property-name for name popup

            }
        })

        // now commareas
        let active_areas = hash_str.substr(1).split(',')
        if (active_areas.indexOf('all') == 0) {
            active_areas = COMMAREAS
            zoom = false
        }

        COMMAREAS.forEach((area, i) => {
            clearLayers(map, area)
            if (active_areas.indexOf(area) != -1) {
                let feature = null;
                commareas_geojson['features'].forEach(f => {
                        if (f.properties.slug == area) {
                            feature = f
                        }
                    })
                    // if (zoom && feature) bounds = extendBounds(bounds, feature)
                addLayers(map, area,
                        'commareas', // source
                        ["==", ["get", "slug"], area], // filter
                        PALETTE[i % PALETTE.length], // fill
                        'community') // property-name for name popup
            }
        })

        if (zoom && bounds) {
            map.fitBounds(bounds, {
                padding: 20
            })
        }
    }

}

function clearLayers(map, slug) {
    if (map.getLayer(`${slug}-fill`)) {
        map.removeLayer(`${slug}-fill`)
    }
    if (map.getLayer(`${slug}-line`)) {
        map.removeLayer(`${slug}-line`)
    }

}

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

function addLayers(map, slug, source, filter, fill, name_key) {
    map.addLayer({
        id: `${slug}-fill`,
        type: 'fill',
        source: source,
        filter: filter,
        paint: {
            'fill-color': fill,
            'fill-opacity': 0.3
        }
    }, 'routes-layer')
    map.addLayer({
        id: `${slug}-line`,
        type: 'line',
        source: source,
        filter: filter,
        paint: { // todo.. change colors? add borders?
            'line-color': '#333',
            'line-opacity': 1,
            'line-width': 1
        }
    }, 'routes-layer')

    // from https://docs.mapbox.com/mapbox-gl-js/example/polygon-popup-on-click/
    map.on('click', `${slug}-fill`, function(e) {
        new mapboxgl.Popup()
            .setLngLat(e.lngLat)
            .setHTML(titleCase(e.features[0].properties[name_key]))
            .addTo(map);
    });


}

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

let COMMAREAS = []

let PALETTE = //['#a6cee3', '#1f78b4', '#b2df8a', '#33a02c', '#fb9a99', '#e31a1c', '#fdbf6f', '#ff7f00', '#cab2d6', '#6a3d9a']
    ['#8dd3c7', '#ffffb3', '#bebada', '#fb8072', '#80b1d3', '#fdb462', '#b3de69', '#fccde5', '#d9d9d9', '#bc80bd']

let commareas_geojson = null,
    places_geojson = null,
    routes_geojson = null,
    map = null;

mapboxgl.accessToken = 'pk.eyJ1Ijoiam9lZ2VybXVza2EiLCJhIjoiY2thOXNwNHpwMGp2NDJybnplZHE2NWsxZiJ9.R08AIHjCQZKow3hRRao5MA';

function initMap() {
    /*global*/
    map = new mapboxgl.Map({
        container: 'map', // container id
        style: 'mapbox://styles/joegermuska/cka9tuolk0n921jse7dggjtll', // stylesheet location
        // style: styles.frank,
        center: [-87.72294673185576, 42.05386137897145], // starting position [lng, lat]
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

            // var routes_bounds = completeBounds(routes_geojson.features)
            // map.fitBounds(routes_bounds, {
            //     padding: 20
            // })

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


        let commareas_promise = fetch('./commareas.geojson').then(r => {
            if (r.status != 200) {
                throw new Error(`${r.status} ${r.statusText}`)
            } else {
                return r.text()
            }
        }).then(t => {
            commareas_geojson = JSON.parse(t)
            commareas_geojson.features.forEach(f => {
                f['properties']['slug'] = slugify(f['properties'].community)
                COMMAREAS.push(f['properties']['slug'])
            })
            map.addSource('commareas', {
                type: 'geojson',
                data: commareas_geojson
            })

            // if there were any more async things happening, we'd need to
            // handle this more elegantly
            COMMAREAS.sort()
        })
        let places_url = `https://api.censusreporter.org/1.0/geo/show/tiger2018?geo_ids=${Object.values(PLACES).join(',')}`

        let places_promise = fetch(places_url).then(r => {
            if (r.status != 200) {
                throw new Error(`${r.status} ${r.statusText}`)
            } else {
                return r.text()
            }
        }).then(t => {
            places_geojson = JSON.parse(t)
            map.addSource('places', {
                type: 'geojson',
                data: places_geojson
            })
        })

        Promise.all([routes_promise, commareas_promise, places_promise]).then(_ => {
            checkHash('force')
        })

        map.addControl(new mapboxgl.GeolocateControl({
            trackUserLocation: true
        }))

        window.addEventListener('hashchange', checkHash)
    })
}