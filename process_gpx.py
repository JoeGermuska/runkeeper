# TODO: animate the paths...
# https://docs.mapbox.com/mapbox-gl-js/example/live-update-feature/

from lxml.etree import parse,dump
from pathlib import Path
from osgeo import ogr
import datetime
from dateutil.parser import isoparse
import geopandas as gpd
from shapely.geometry import LineString, mapping, shape
import json

NAME_FIXES = {
    # user errors: forgot to switch before starting
    'Cycling 5/26/20 8:28 am': lambda name: name.replace('Cycling', 'Walking'),
    'Walking 7/19/20 10:49 am': lambda name: name.replace('Walking', 'Cycling'),
    'Cycling 8/16/23 1:08 pm': lambda name: name.replace('Cycling', 'Walking')
}

def parse_gpx(p):
    doc = parse(p.open())
    name = doc.xpath('gpx:trk/gpx:name',namespaces={'gpx': 'http://www.topografix.com/GPX/1/1'})[0].text
    if name in NAME_FIXES:
        name = NAME_FIXES[name](name)
    time = doc.xpath('gpx:trk/gpx:time',namespaces={'gpx': 'http://www.topografix.com/GPX/1/1'})[0].text
    route = [(float(trkpt.attrib['lon']),float(trkpt.attrib['lat'])) 
             for trkpt in doc.xpath('//gpx:trkpt',namespaces={'gpx': 'http://www.topografix.com/GPX/1/1'})]
    d = {
        'name': name,
        'time': isoparse(time),
        'time_str': time,
        'geometry': LineString(route)
    }
    
    return d


def one_gpx_to_json_file(gpx_path):
    """Create a single JSON file structurally compatible with the components
    passed in to the dataframe. The name will be the same as the input, with 
    .gpx changed to .json. Note this file is json, not geojson, but has a 'geometry'
    key which has a value which is a geojson LineString.
    """
    parsed = parse_gpx(gpx_path)
    parsed['geometry'] = mapping(parsed['geometry'])
    del parsed['time'] # not serializable, but we have time_str
    json_path = gpx_path.parent / f"{gpx_path.stem}.json"
    json.dump(parsed,json_path.open('w'))

def gpx_to_geojson(path, output_file):
    routes = []
    for walk in path.glob('*.gpx'):
        try:
            fixed = walk.parent / f'{walk.stem}.json'
            if fixed.exists():
                print(f"reading override {fixed}")
                parsed = json.load(fixed.open())
                # must manage time and shapely serialization/deserialization specially
                parsed['geometry'] = shape(parsed['geometry'])
                parsed['time'] = isoparse(parsed['time_str'])
            else:
                parsed = parse_gpx(walk)
            routes.append(parsed)
        except Exception as e:
            print(f"Error processing {walk}")
            print(f"{e}")

    df = gpd.GeoDataFrame(routes)
    df.sort_values('time',inplace=True)

    home = [42.045465,-87.7161625]

    df['type'] = df['name'].apply(lambda x: x.split(' ')[0])
    with open(output_file,"w") as f:
        f.write(df.sort_values('time').drop('time',axis=1).to_json()) # time is not JSON serializable

def fixup_markers(fn):

    import re
    ICONS = [ # https://labs.mapbox.com/maki-icons/
        (re.compile(r'^.*gallery.*$',re.IGNORECASE), 'art-gallery-15'),
        (re.compile(r'^.*(pantry|fridge).*$',re.IGNORECASE), 'grocery-15'),
        (re.compile(r'^.*dog biscuits.*$',re.IGNORECASE), 'dog-park-15'), # or maybe veterinary-15
        (re.compile(r'^.*\btoy\b.*', re.IGNORECASE), 'playground-15')
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
                if "ofEvanston" in place['properties']['name']:
                    # cope with Google Maps label length limitation
                    place['properties']['name'] = place['properties']['name'].replace('ofEvanston', 'of Evanston')
    for place in to_remove:
        j['features'].remove(place)
    json.dump(j,open(fn,'w'),indent=2)

if __name__ == '__main__':
    p = Path('export') 
    gpx_to_geojson(p, "paths.geojson")
    fixup_markers('lfl.geojson')
