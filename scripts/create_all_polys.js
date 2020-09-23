const fs = require("fs"),
    turf = require("@turf/turf"),
    fetch = require('node-fetch'),
    welshpowell = require("welshpowell")

var all_features = []


/**
 * Given an array of GeoJSON Polygon/Multipolygon features, return an array of arrays,
 * in which each index position is an array of the index positions of adjacent polygons.
 * @param {Object[]} all_features 
 */
function compute_neighbors(all_features) {
    let graph = {
        vertices: [],
        edges: []
    }

    all_features.forEach((f, i) => {
        graph.vertices.push(f.properties.slug)
        console.log(`${f.properties.glenviewslug} is adjacent to...`)
        graph.edges.push([])
        all_features.forEach((g, j) => {
            if (i != j) {
                if (turf.intersect( // need to buffer a teeny bit
                        turf.buffer(f, .001, { units: 'kilometers' }),
                        turf.buffer(g, .001, { units: 'kilometers' }),
                    )) {
                    graph.edges[i].push(g.properties.slug)
                    console.log(`...${g.properties.slug}`)
                }
            }
        })
    })

    return graph
}

/**
 * Simple util combining the fetch and JSON parse.
 * @param {String} url 
 */
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

let commareas_geojson = JSON.parse(fs.readFileSync(`${__dirname}/../commareas.geojson`, 'utf-8'))

commareas_geojson.features.forEach(f => {
    f['properties']['slug'] = slugify(f['properties'].community)
    f['properties']['name'] = titleCase(f['properties'].community)
    all_features.push(f)
})

let places_url = `https://api.censusreporter.org/1.0/geo/show/tiger2018?geo_ids=${Object.values(PLACES).join(',')}`
fetchJSON(places_url).then(j => {
    places_geojson = j
    places_geojson.features.forEach(f => {
        // names are ok
        f.properties['slug'] = PLACES_BY_GEOID[f.properties['geoid']]
        console.log(`${f.properties.slug}`)
        all_features.push(f)
    })

    // let neighbor_graph = compute_neighbors(all_features)
    // let colors = welshpowell.color(neighbor_graph)


    fs.writeFileSync(`${__dirname}/../all_polys.geojson`, JSON.stringify(turf.featureCollection(all_features)), 'utf-8')
})