#!/bin/bash
fn=$(ls -lrt ~/Downloads/01-run* 2>/dev/null | tail -1 | awk '{print $9}')
if [[ $fn != '' ]] && test -f $fn
then
    echo "unzipping Runkeeper"
    unzip -o -d export/ ${fn}
    rm ~/Downloads/01-run*
else
    echo "no Runkeeper today"
fi

fn=$(ls -lrt ~/Downloads/takeout*zip 2>/dev/null | tail -1 | awk '{print $9}')
if [[ $fn != '' ]] && test -f $fn
then
    echo "unzipping Google Maps"
    unzip -o -j $fn "Takeout/Maps/My labeled places/Labeled places.json"
    mv "Labeled places.json" lfl.geojson
    rm ~/Downloads/takeout*zip
else
    echo "no Google Maps today"
fi

echo "processing"
python ./process_gpx.py

git add lfl.geojson paths.geojson

jq < lfl.geojson '.features[].properties.icon' | sort | uniq -c

http-server -p 1234 -o /
