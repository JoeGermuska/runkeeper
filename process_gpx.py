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
    time = doc.xpath('gpx:trk/gpx:time',namespaces={'gpx': 'http://www.topografix.com/GPX/1/1'})[0].text
    route = [(float(trkpt.attrib['lon']),float(trkpt.attrib['lat'])) 
             for trkpt in doc.xpath('//gpx:trkpt',namespaces={'gpx': 'http://www.topografix.com/GPX/1/1'})]
    d = {
        'name': name,
        'time': datetime.datetime.strptime(time, "%Y-%m-%dT%H:%M:%SZ"),
        'geometry': LineString(route)
    }
    
    return d

def style_function(feature):
    return {
        'weight': 2,
        'opacity': .5,
        'color': 'red' if feature['properties']['type'] == 'Cycling' else 'blue'
    }

if __name__ == '__main__':
    p = Path('export') # parameterize input dir?
    walks = list(p.glob('*.gpx'))
    routes = [parse_gpx(walk) for walk in walks]
    df = gpd.GeoDataFrame(routes)
    df.sort_values('time',inplace=True)

    home = [42.045465,-87.7161625]
    m = folium.Map(
        location=[42.03,-87.7161625],#home,
        tiles='OpenStreetMap',
        zoom_start=15,
        height=2500
    )

    j = json.loads(df['geometry'].to_json())
    for i,feature in enumerate(j['features']):
        row = df.loc[i].to_dict()
        feature['properties']['name'] = row['name']
        feature['properties']['type'] = row['name'].split(' ')[0]
        feature['properties']['date'] = row['time'].strftime("%Y-%m-%d")

    j['features'].sort(key=lambda x: x['properties']['date'])
    with open("paths.geojson","w") as f:
        json.dump(j,f)
        