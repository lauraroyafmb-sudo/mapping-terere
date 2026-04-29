import proj4 from 'proj4';
import * as turf from '@turf/turf';

// ...

// UTM Zona 21J (Común en Paraguay)
const UTM21J = '+proj=utm +zone=21 +south +ellps=WGS84 +datum=WGS84 +units=m +no_defs';

/**
 * Servicio para manejar cálculos geográficos y conversiones de coordenadas.
 */
export const GeoService = {
  /**
   * Convierte coordenadas Latitud/Longitud a UTM Zona 21J.
   */
  toUTM(lat: number, lon: number) {
    try {
      const [easting, northing] = proj4('WGS84', UTM21J, [lon, lat]);
      return {
        easting: Math.round(easting * 100) / 100,
        northing: Math.round(northing * 100) / 100,
        zone: '21J'
      };
    } catch (error) {
      console.error('Error en conversión UTM:', error);
      return null;
    }
  },

  /**
   * Formatea coordenadas Lat/Lon para visualización.
   */
  formatLatLon(lat: number, lon: number) {
    return `${lat.toFixed(6)}, ${lon.toFixed(6)}`;
  },

  /**
   * Simula la descarga de datos de focos de calor (NASA FIRMS).
   */
  async fetchFireData() {
    // Simulación de retraso de red
    await new Promise(resolve => setTimeout(resolve, 800));

    // Generar focos de calor aleatorios en la región de Paraguay
    const fires = [];
    const count = 15 + Math.floor(Math.random() * 20);
    
    for (let i = 0; i < count; i++) {
      fires.push({
        id: `fire-${i}`,
        lat: -25.3 + (Math.random() - 0.5) * 2,
        lon: -57.6 + (Math.random() - 0.5) * 2,
        brightness: 300 + Math.random() * 100,
        confidence: 50 + Math.floor(Math.random() * 50),
        acq_date: new Date().toISOString().split('T')[0],
        acq_time: `${Math.floor(Math.random() * 24).toString().padStart(2, '0')}${Math.floor(Math.random() * 60).toString().padStart(2, '0')}`,
        satellite: Math.random() > 0.5 ? 'Aqua' : 'Terra'
      });
    }
    
    return fires;
  },

  /**
   * Lee un archivo GeoTIFF local y extrae la imagen y coordenadas.
   * Asume que el GeoTIFF está en proyección EPSG:4326 (Lat/Lon).
   */
  async parseGeoTIFF(file: File) {
    try {
      const GeoTIFF = await import('geotiff');
      const tiff = await GeoTIFF.fromBlob(file);
      const image = await tiff.getImage();
      const bbox = image.getBoundingBox(); 
      // bbox is [minX, minY, maxX, maxY]
      
      const width = image.getWidth();
      const height = image.getHeight();
      const rasters = await image.readRasters() as any[];
      
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error("No canvas context");

      const imageData = ctx.createImageData(width, height);
      const data = imageData.data;
      
      let o = 0;
      for (let i = 0; i < rasters[0].length; i++) {
        data[o] = rasters[0][i];     // R
        data[o+1] = rasters[1] ? rasters[1][i] : rasters[0][i]; // G
        data[o+2] = rasters[2] ? rasters[2][i] : rasters[0][i]; // B
        data[o+3] = rasters[3] ? rasters[3][i] : 255; // A
        o += 4;
      }
      ctx.putImageData(imageData, 0, 0);
      
      // Validar si las coordenadas están en formato Lat/Lon (EPSG:4326)
      const [minX, minY, maxX, maxY] = bbox;
      if (Math.abs(minX) > 180 || Math.abs(maxX) > 180 || Math.abs(minY) > 90 || Math.abs(maxY) > 90) {
        throw new Error("PROJECTION_ERROR");
      }

      const dataUrl = await new Promise<string>((resolve, reject) => {
        canvas.toBlob(blob => {
          if (blob) resolve(URL.createObjectURL(blob));
          else reject(new Error("No se pudo crear la imagen del mapa"));
        }, 'image/png');
      });
      
      // Coordinates for Maplibre Image Source: top-left, top-right, bottom-right, bottom-left
      const coordinates = [
        [minX, maxY], // top-left
        [maxX, maxY], // top-right
        [maxX, minY], // bottom-right
        [minX, minY]  // bottom-left
      ];
      
      return { dataUrl, coordinates, center: { lat: (minY + maxY) / 2, lon: (minX + maxX) / 2 } };
    } catch (error) {
      console.error("Error leyendo GeoTIFF:", error);
      throw error;
    }
  },

  /**
   * Calcula la longitud de una línea
   */
  calculateDistance(coordinates: {lat: number, lon: number}[]) {
    if (!coordinates || coordinates.length < 2) return null;
    const line = turf.lineString(coordinates.map(p => [p.lon, p.lat]));
    const lengthKm = turf.length(line, {units: 'kilometers'});
    if (lengthKm < 1) {
      return `${(lengthKm * 1000).toFixed(0)} m`;
    }
    return `${lengthKm.toFixed(2)} km`;
  },

  /**
   * Calcula el área de un polígono
   */
  calculateArea(coordinates: {lat: number, lon: number}[]) {
    if (!coordinates || coordinates.length < 3) return null;
    let coords = coordinates.map(p => [p.lon, p.lat]);
    // Cerrar el polígono para turf
    if (coords[0][0] !== coords[coords.length-1][0] || coords[0][1] !== coords[coords.length-1][1]) {
      coords.push([...coords[0]]);
    }
    if (coords.length < 4) return null;
    
    const polygon = turf.polygon([coords]);
    const areaSqM = turf.area(polygon);
    
    if (areaSqM < 10000) {
      return `${areaSqM.toFixed(0)} m²`;
    } else {
      return `${(areaSqM / 10000).toFixed(2)} ha`;
    }
  },

  /**
   * Exporta los datos al formato GeoJSON FeatureCollection
   */
  exportToGeoJSON(points: any[], geometries: any[]): any {
    const features: any[] = [];

    const formatProperties = (obj: any) => {
      const props: any = {
        name: obj.name || (obj.type === 'polygon' ? 'Polígono' : obj.type === 'line' ? 'Línea' : 'Punto'),
        description: obj.description || '',
      };
      if (obj.icon) props.icon = obj.icon;
      
      if (obj.attributes && Array.isArray(obj.attributes)) {
        obj.attributes.forEach((attr: any) => {
          if (attr.key && attr.value) {
            // Reemplazar espacios para evitar problemas en KML
            const safeKey = attr.key.replace(/\s+/g, '_');
            props[`extra_${safeKey}`] = attr.value;
          }
        });
      }
      return props;
    };

    // Añadir Puntos
    points.forEach(p => {
      features.push({
        type: 'Feature',
        properties: formatProperties(p),
        geometry: {
          type: 'Point',
          coordinates: [p.lon, p.lat]
        }
      });
    });

    // Añadir Geometrías (Líneas y Polígonos)
    geometries.forEach(g => {
      let geojsonType = 'LineString';
      let coords = g.coordinates.map((coord: any) => [coord.lon, coord.lat]);

      if (g.type === 'polygon') {
        geojsonType = 'Polygon';
        // Ensure polygon is closed
        if (coords.length >= 3) {
          if (coords[0][0] !== coords[coords.length-1][0] || coords[0][1] !== coords[coords.length-1][1]) {
            coords.push([...coords[0]]);
          }
        }
        coords = [coords]; // Polygons need an array of linear rings
      }

      features.push({
        type: 'Feature',
        properties: formatProperties(g),
        geometry: {
          type: geojsonType,
          coordinates: coords
        }
      });
    });

    return {
      type: 'FeatureCollection',
      features
    };
  }
};

