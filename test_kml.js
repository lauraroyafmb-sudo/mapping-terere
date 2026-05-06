import { kml } from '@tmcw/togeojson';
import { DOMParser } from '@xmldom/xmldom';
import fs from 'fs';

const kmlString = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <Placemark>
      <name>Line 1</name>
      <MultiGeometry>
        <LineString>
          <coordinates>
            -57.5, -25.2, 0
            -57.6, -25.3, 0
          </coordinates>
        </LineString>
        <LineString>
          <coordinates>
            -57.7, -25.4, 0
            -57.8, -25.5, 0
          </coordinates>
        </LineString>
      </MultiGeometry>
    </Placemark>
  </Document>
</kml>`;

const dom = new DOMParser().parseFromString(kmlString, 'text/xml');
const geojson = kml(dom);
console.log(JSON.stringify(geojson, null, 2));
