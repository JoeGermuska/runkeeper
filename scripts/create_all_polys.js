/**
 * Creates a single unified geojson file with polygons of interest from different sources.
 * Applies a four_color algorithm to help prevent coloring adjacent polys with the same fill.
 * Saves that as an index instead of an actual color, but colors can be applied in browser.
 */
import fs from "fs"
import turf from "@turf/turf"
import fetch from 'node-fetch'

import { gen4col } from "./four_color.js"

var all_features = []


/**
 * Given an array of GeoJSON Polygon/Multipolygon features, return an array of arrays,
 * in which each index position is an array of the index positions of adjacent polygons.
 * @param {Object[]} all_features 
 */
function compute_neighbors(all_features) {
    let graph = {
        vertices: all_features.map(i => []),
        edges: all_features.map(i => []),
        degree: all_features.map(i => 0),
    }

    all_features.forEach((f, i) => {
        graph.vertices[i] = f.properties.slug
        console.log(`${f.properties.slug} is adjacent to...`)
        all_features.forEach((g, j) => {
            if (i != j) {
                if (turf.intersect( // need to buffer a teeny bit
                        turf.buffer(f, .001, { units: 'kilometers' }),
                        turf.buffer(g, .001, { units: 'kilometers' }),
                    )) {
                    graph.edges[i].push(j)
                    graph.degree[i] = graph.edges[i].length
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
        }).catch(e => {
            console.log(`fetchJSON error with ${url}`)
            console.log(`${e}`)
            reject(e)
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
    'golf': '16000US1730328',
    'highland-park': '16000US1734722'
}
let PLACES_BY_GEOID = {}
Object.keys(PLACES).forEach(k => PLACES_BY_GEOID[PLACES[k]] = k)

let commareas_geojson = JSON.parse(fs.readFileSync(`commareas.geojson`, 'utf-8'))

commareas_geojson.features.forEach(f => {
    f['properties']['slug'] = slugify(f['properties'].community)
    f['properties']['name'] = titleCase(f['properties'].community)
    all_features.push(f)
})

let places_url = `https://api.censusreporter.org/1.0/geo/show/tiger2019?geo_ids=${Object.values(PLACES).join(',')}`
fetchJSON(places_url).then(j => {
    let places_geojson = j
    places_geojson.features.forEach(f => {
        // names are ok
        f.properties['slug'] = PLACES_BY_GEOID[f.properties['geoid']]
        console.log(`${f.properties.slug}`)
        all_features.push(f)
    })

    console.log("computing neighbors")
    let neighbor_graph = compute_neighbors(all_features)
    console.log("assigning colors")
    let colors = gen4col(neighbor_graph.edges, true)
    all_features.forEach((f, i) => {
        f.properties['color_idx'] = colors[i]
    })
    console.log("writing file")
    fs.writeFileSync(`all_polys.geojson`, JSON.stringify(turf.featureCollection(all_features)), 'utf-8')
    console.log("DONE")
}).catch(e => {
    console.log(e)
})