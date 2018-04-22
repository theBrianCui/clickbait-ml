#!/bin/bash
tsc
for file in $(find sites/sites* 2> /dev/null);
do
    [ -e "$file" ] || continue
    node scraper.js "$file" adapters.json run/normal.out run/unknown.out run/clickbait.out 2 2> /dev/null
done
