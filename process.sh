#!/bin/bash
fn=$(ls -lrt ~/Downloads/01-run* | tail -1 | awk '{print $9}')
if test -f ${fn} ; then
    echo "unzipping Runkeeper"
    unzip -o -d export/ ${fn}
    rm ~/Downloads/01-run*
fi

fn=$(ls -lrt ~/Downloads/takeout*zip | tail -1 | awk '{print $9}')
if test -f $fn; then
    echo "unzipping Google Maps"
    unzip -o -j $fn "Takeout/Maps/My labeled places/Labeled places.json"
    mv "Labeled places.json" lfl.geojson
    rm ~/Downloads/takeout*zip
fi

echo "processing"
python ./process_gpx.py

