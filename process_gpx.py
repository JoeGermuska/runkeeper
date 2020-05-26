# TODO: animate the paths...
# https://docs.mapbox.com/mapbox-gl-js/example/live-update-feature/

from lxml.etree import parse,dump
from pathlib import Path
from osgeo import ogr
import datetime
import geopandas as gpd
import folium
from shapely.geometry import Polygon, LineString
import json

def parse_gpx(p):
    doc = parse(p.open())
    name = doc.xpath('gpx:trk/gpx:name',namespaces={'gpx': 'http://www.topografix.com/GPX/1/1'})[0].text
    if name == 'Cycling 5/26/20 8:28 am':
        name = name.replace('Cycling', 'Walking') # user error forgot to switch before starting
    time = doc.xpath('gpx:trk/gpx:time',namespaces={'gpx': 'http://www.topografix.com/GPX/1/1'})[0].text
    route = [(float(trkpt.attrib['lon']),float(trkpt.attrib['lat'])) 
             for trkpt in doc.xpath('//gpx:trkpt',namespaces={'gpx': 'http://www.topografix.com/GPX/1/1'})]
    d = {
        'name': name,
        'time': datetime.datetime.strptime(time, "%Y-%m-%dT%H:%M:%SZ"),
        'geometry': LineString(route)
    }
    
    return d

def gpx_to_geojson(path, output_file):
    routes = [parse_gpx(walk) for walk in path.glob('*.gpx')]
    df = gpd.GeoDataFrame(routes)
    df.sort_values('time',inplace=True)

    home = [42.045465,-87.7161625]

    df['type'] = df['name'].apply(lambda x: x.split(' ')[0])
    with open(output_file,"w") as f:
        f.write(df.sort_values('time').drop('time',axis=1).to_json()) # time is not JSON serializable

def fixup_markers(fn):

    import re
    ICONS = [
        (re.compile('^.*pantry.*$',re.IGNORECASE), 'grocery-15')
    ]

    DROP = [ # old stuff that is in saved places but shouldn't be on the map
        'Home',
        'Work',
        "Sandy & Sarah's",
        'Tom and Megan Germuska',
        'The fireworks spot'
    ]
    j = json.load(open(fn))
    to_remove = []
    for place in j['features']:
        if place['properties']['name'] in DROP:
            to_remove.append(place)
        else:
            place['properties']['icon'] = 'library-15' # default
            # my maps export from Google has... coordinates reversed?
            # geojson wants [ lng, lat ] -- since we're around here, we can assume negative is a lng
            if place['geometry']['coordinates'][1] < 0:
                place['geometry']['coordinates'] = list(reversed(place['geometry']['coordinates']))
            for pat,icon in ICONS:
                if pat.match(place['properties']['name']):
                    place['properties']['icon'] = icon
    for place in to_remove:
        j['features'].remove(place)
    json.dump(j,open(fn,'w'),indent=2)

if __name__ == '__main__':
    p = Path('export') 
    gpx_to_geojson(p, "paths.geojson")
    fixup_markers('lfl.geojson')