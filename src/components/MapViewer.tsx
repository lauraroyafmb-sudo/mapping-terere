import React, { useEffect, useRef, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { GeoService } from '../services/GeoService';
import { getIconComponent } from '../utils/iconMap';


interface MapViewerProps {
  onMapClick?: (e: any) => void;
  onEditFeature?: (feature: any) => void;
  points?: any[];
  firePoints?: any[];
  showFires?: boolean;
  track?: any[];
  geometries?: any[];
  currentDrawing?: any[];
  drawMode?: 'none' | 'line' | 'polygon';
  centerTo?: { lat: number, lon: number, timestamp: number } | null;
  mapStyle?: string | object;
  customLayers?: any[];
}

const MapViewer: React.FC<MapViewerProps> = ({ 
  onMapClick, 
  onEditFeature,
  points = [], 
  firePoints = [],
  showFires = false,
  track = [], 
  geometries = [], 
  currentDrawing = [],
  drawMode = 'none',
  centerTo = null,
  mapStyle = 'https://demotiles.maplibre.org/style.json',
  customLayers = []
}) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const markers = useRef<maplibregl.Marker[]>([]);
  const roots = useRef<Root[]>([]);
  const userLocationMarker = useRef<maplibregl.Marker | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [styleLoadedTs, setStyleLoadedTs] = useState(0);
  
  // Refs para evitar clausuras obsoletas en los listeners de eventos
  const geometriesRef = useRef(geometries);
  const pointsRef = useRef(points);

  useEffect(() => {
    geometriesRef.current = geometries;
  }, [geometries]);

  useEffect(() => {
    pointsRef.current = points;
  }, [points]);

  const COLORS = {
    line: '#EF4444',
    polygon: '#FACC15',
    track: '#F97316',
    point: '#3B82F6'
  };

  useEffect(() => {
    if (map.current) return;
    
    if (mapContainer.current) {
      map.current = new maplibregl.Map({
        container: mapContainer.current,
        style: 'https://demotiles.maplibre.org/style.json',
        center: [-57.6333, -25.3000],
        zoom: 12
      });

      map.current.on('style.load', () => {
        if (!map.current) return;
        const m = map.current;

        if (!m.getSource('track')) m.addSource('track', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
        if (!m.getSource('geometries')) m.addSource('geometries', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
        if (!m.getSource('current-drawing')) m.addSource('current-drawing', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
        if (!m.getSource('fire-points')) m.addSource('fire-points', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });

        if (!m.getLayer('fire-points')) {
          m.addLayer({
            id: 'fire-points',
            type: 'circle',
            source: 'fire-points',
            paint: {
              'circle-radius': ['interpolate', ['linear'], ['zoom'], 5, 4, 12, 10],
              'circle-color': ['interpolate', ['linear'], ['get', 'confidence'], 50, '#F97316', 100, '#EF4444'],
              'circle-stroke-width': 2,
              'circle-stroke-color': 'white',
              'circle-opacity': 0.8
            }
          });
        }

        if (!m.getLayer('track')) {
          // Intentamos insertar la ruta sobre el tiff
          if (m.getLayer('imported-tiff-layer')) {
             m.addLayer({ id: 'track', type: 'line', source: 'track', paint: { 'line-color': COLORS.track, 'line-width': 4 } });
          } else {
             m.addLayer({ id: 'track', type: 'line', source: 'track', paint: { 'line-color': COLORS.track, 'line-width': 4 } });
          }
        }

        if (!m.getLayer('geometries-fill')) {
          m.addLayer({
            id: 'geometries-fill', type: 'fill', source: 'geometries', filter: ['==', '$type', 'Polygon'], paint: { 'fill-color': COLORS.polygon, 'fill-opacity': 0.4 }
          });
        }

        if (!m.getLayer('geometries-line')) {
          m.addLayer({
            id: 'geometries-line', type: 'line', source: 'geometries', paint: { 
              'line-color': ['case', ['==', ['get', 'type'], 'polygon'], '#854D0E', COLORS.line],
              'line-width': ['case', ['==', ['get', 'type'], 'polygon'], 2, 3]
            }
          });
        }

        if (!m.getLayer('current-drawing-fill')) {
          m.addLayer({
            id: 'current-drawing-fill', type: 'fill', source: 'current-drawing', filter: ['==', '$type', 'Polygon'], paint: { 'fill-color': COLORS.polygon, 'fill-opacity': 0.3 }
          });
        }
        
        if (!m.getLayer('current-drawing-line')) {
          m.addLayer({
            id: 'current-drawing-line', type: 'line', source: 'current-drawing', filter: ['==', '$type', 'LineString'], paint: { 
              'line-color': drawMode === 'polygon' ? COLORS.polygon : COLORS.line,
              'line-width': 3, 
              'line-dasharray': [2, 1] 
            }
          });
        }

        if (!m.getLayer('current-drawing-point')) {
          m.addLayer({
            id: 'current-drawing-point', type: 'circle', source: 'current-drawing', filter: ['==', '$type', 'Point'], paint: { 
              'circle-radius': 6, 
              'circle-color': drawMode === 'polygon' ? COLORS.polygon : COLORS.line,
              'circle-stroke-width': 2, 
              'circle-stroke-color': 'white' 
            }
          });
        }

        setIsReady(true);
        setStyleLoadedTs(Date.now());
      });
      
      // Events can be attached once, outside style.load
      map.current.on('click', 'geometries-fill', (e) => {
        if (!map.current || !e.features?.[0] || !onEditFeature) return;
        const props = e.features[0].properties;
        const featureId = props.id || geometriesRef.current.find(g => g.name === props.name)?.id;
        const fullFeature = geometriesRef.current.find(g => g.id === featureId);
        if (fullFeature) onEditFeature(fullFeature);
      });

      map.current.on('click', 'geometries-line', (e) => {
        if (!map.current || !e.features?.[0] || !onEditFeature) return;
        const props = e.features[0].properties;
        if (props.type === 'line') {
          const featureId = props.id || geometriesRef.current.find(g => g.name === props.name)?.id;
          const fullFeature = geometriesRef.current.find(g => g.id === featureId);
          if (fullFeature) onEditFeature(fullFeature);
        }
      });
    }

    return () => {
      map.current?.remove();
      map.current = null;
    };
  }, []);

  useEffect(() => {
    if (!map.current || !isReady) return;
    const color = drawMode === 'polygon' ? COLORS.polygon : COLORS.line;
    if (map.current.getLayer('current-drawing-line')) {
      map.current.setPaintProperty('current-drawing-line', 'line-color', color);
    }
    if (map.current.getLayer('current-drawing-point')) {
      map.current.setPaintProperty('current-drawing-point', 'circle-color', color);
    }
  }, [drawMode, isReady]);

  useEffect(() => {
    if (!map.current || !isReady || !onMapClick) return;
    const wrappedClick = (e: any) => {
      // Evitar que el clic en el mapa cree un punto si se hizo clic en una geometría
      const features = map.current?.queryRenderedFeatures(e.point, { layers: ['geometries-fill', 'geometries-line'] });
      if (features && features.length > 0) return;
      onMapClick(e);
    };
    map.current.on('click', wrappedClick);
    return () => {
      map.current?.off('click', wrappedClick);
    };
  }, [onMapClick, isReady]);

  useEffect(() => {
    if (!map.current || !isReady) return;
    markers.current.forEach(m => m.remove());
    roots.current.forEach(r => r.unmount());
    markers.current = [];
    roots.current = [];

    points.forEach(p => {
      const el = document.createElement('div');
      el.className = 'custom-marker';
      el.style.width = '32px';
      el.style.height = '32px';
      el.style.display = 'flex';
      el.style.alignItems = 'center';
      el.style.justifyContent = 'center';
      el.style.background = 'white';
      el.style.borderRadius = '50%';
      el.style.border = '2px solid #3B82F6';
      el.style.boxShadow = '0 2px 4px rgba(0,0,0,0.3)';
      el.style.cursor = 'pointer';
      el.style.color = '#3B82F6';

      const IconComponent = getIconComponent(p.icon);
      const root = createRoot(el);
      root.render(<IconComponent size={20} />);
      roots.current.push(root);

      const marker = new maplibregl.Marker({ element: el })
        .setLngLat([p.lon, p.lat])
        .addTo(map.current!);
      
      marker.getElement().addEventListener('click', (e) => {
        e.stopPropagation();
        if (onEditFeature) onEditFeature(p);
      });
      
      markers.current.push(marker);
    });
  }, [points, isReady]);

  useEffect(() => {
    if (!map.current || !isReady) return;

    const trackSource = map.current.getSource('track') as maplibregl.GeoJSONSource;
    if (trackSource) {
      trackSource.setData({
        type: 'Feature',
        geometry: { type: 'LineString', coordinates: track.map(p => [p.lon, p.lat]) },
        properties: {}
      });
    }

    const geoSource = map.current.getSource('geometries') as maplibregl.GeoJSONSource;
    if (geoSource) {
      geoSource.setData({
        type: 'FeatureCollection',
        features: geometries.map(g => {
          let coords = g.coordinates.map((p: any) => [p.lon, p.lat]);
          const isPolygon = g.type === 'polygon' && coords.length > 2;
          if (isPolygon) coords = [...coords, coords[0]];
          
          return {
            type: 'Feature',
            geometry: {
              type: isPolygon ? 'Polygon' : 'LineString',
              coordinates: isPolygon ? [coords] : coords
            },
            properties: { 
              type: g.type,
              name: g.name,
              description: g.description
            }
          };
        })
      });
    }

    const drawSource = map.current.getSource('current-drawing') as maplibregl.GeoJSONSource;
    if (drawSource) {
      const features: any[] = [];
      if (currentDrawing.length > 0) {
        currentDrawing.forEach(p => {
          features.push({
            type: 'Feature',
            geometry: { type: 'Point', coordinates: [p.lon, p.lat] },
            properties: {}
          });
        });
        if (currentDrawing.length > 1) {
          features.push({
            type: 'Feature',
            geometry: { type: 'LineString', coordinates: currentDrawing.map((p: any) => [p.lon, p.lat]) },
            properties: {}
          });
        }
        if (drawMode === 'polygon' && currentDrawing.length > 2) {
          const polyCoords = [...currentDrawing.map((p: any) => [p.lon, p.lat]), [currentDrawing[0].lon, currentDrawing[0].lat]];
          features.push({
            type: 'Feature',
            geometry: { type: 'Polygon', coordinates: [polyCoords] },
            properties: {}
          });
        }
      }
      drawSource.setData({ type: 'FeatureCollection', features });
    }

    const fireSource = map.current.getSource('fire-points') as maplibregl.GeoJSONSource;
    if (fireSource) {
      fireSource.setData({
        type: 'FeatureCollection',
        features: showFires ? firePoints.map(f => ({
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [f.lon, f.lat] },
          properties: f
        })) : []
      });
    }
  }, [track, geometries, currentDrawing, drawMode, firePoints, showFires, isReady, styleLoadedTs]);

  useEffect(() => {
    if (!map.current || !isReady) return;
    const m = map.current;

    const activeLayerIds = new Set<string>();

    customLayers.filter(l => l.visible).forEach(layer => {
      const sourceId = `custom-source-${layer.id}`;
      const layerId = `custom-layer-${layer.id}`;
      activeLayerIds.add(sourceId);

      if (!m.getSource(sourceId)) {
        if (layer.type === 'xyz') {
          m.addSource(sourceId, {
            type: 'raster',
            tiles: [layer.url],
            tileSize: 256
          });
        } else if (layer.type === 'tiff') {
          m.addSource(sourceId, {
            type: 'image',
            url: layer.url,
            coordinates: layer.coordinates
          });
        }

        const addParams: any = {
          id: layerId,
          type: 'raster',
          source: sourceId,
          paint: { 'raster-opacity': layer.type === 'tiff' ? 0.85 : 1 }
        };

        if (m.getLayer('track')) {
          m.addLayer(addParams, 'track');
        } else {
          m.addLayer(addParams);
        }
      } else if (layer.type === 'tiff') {
        const source = m.getSource(sourceId) as maplibregl.ImageSource;
        if (source) {
          source.updateImage({
            url: layer.url,
            coordinates: layer.coordinates
          });
        }
      }
    });

    const style = m.getStyle();
    if (style && style.layers) {
      style.layers.forEach(l => {
        if (l.id.startsWith('custom-layer-')) {
          const sourceId = (l as any).source;
          if (!activeLayerIds.has(sourceId)) {
            if (m.getLayer(l.id)) m.removeLayer(l.id);
            if (m.getSource(sourceId)) m.removeSource(sourceId);
          }
        }
      });
    }
  }, [customLayers, isReady, styleLoadedTs]);

  useEffect(() => {
    if (!map.current || !mapStyle) return;
    map.current.setStyle(mapStyle as any);
  }, [mapStyle]);

  useEffect(() => {
    if (!map.current || !isReady) return;

    const handleFireClick = (e: any) => {
      if (!map.current || !e.features?.[0]) return;
      const props = e.features[0].properties;
      const lat = e.lngLat.lat;
      const lon = e.lngLat.lng;
      const utm = GeoService.toUTM(lat, lon);
      
      const shareText = encodeURIComponent(
        `🔥 *Alerta de Foco de Calor*\n\n` +
        `📍 *Ubicación:*\n` +
        `UTM: E ${utm?.easting.toFixed(0)} m, N ${utm?.northing.toFixed(0)} m (Zona ${utm?.zone})\n` +
        `Lat/Lon: ${lat.toFixed(6)}, ${lon.toFixed(6)}\n\n` +
        `📊 *Datos Satelitales:*\n` +
        `- Confianza: ${props.confidence}%\n` +
        `- Satélite: ${props.satellite}\n` +
        `- Fecha/Hora: ${props.acq_date} ${props.acq_time}\n\n` +
        `🗺️ Ver en Google Maps: https://www.google.com/maps?q=${lat},${lon}`
      );

      new maplibregl.Popup()
        .setLngLat(e.lngLat)
        .setHTML(`
          <div style="padding: 10px; min-width: 180px; font-family: sans-serif;">
            <h3 style="margin: 0 0 8px; color: #EF4444; font-size: 1rem; display: flex; align-items: center; gap: 8px;">
              <span style="width: 10px; height: 10px; background: #EF4444; border-radius: 50%;"></span>
              Foco de Calor
            </h3>
            <div style="font-size: 0.85rem; display: flex; flex-direction: column; gap: 4px; color: #4B5563;">
              <span><b>Confianza:</b> ${props.confidence}%</span>
              <span><b>Satélite:</b> ${props.satellite}</span>
              <span><b>Hora:</b> ${props.acq_time}</span>
            </div>
            <hr style="margin: 10px 0; border: 0; border-top: 1px solid #E5E7EB;" />
            <a href="https://wa.me/?text=${shareText}" target="_blank" style="
              display: flex;
              align-items: center;
              justify-content: center;
              gap: 8px;
              background: #25D366;
              color: white;
              text-decoration: none;
              padding: 8px;
              border-radius: 8px;
              font-weight: 600;
              font-size: 0.85rem;
              transition: opacity 0.2s;
            " onmouseover="this.style.opacity='0.9'" onmouseout="this.style.opacity='1'">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="white"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.445 0 .01 5.437 0 12.045c0 2.112.552 4.173 1.6 6.012L0 24l6.135-1.61a11.77 11.77 0 005.911 1.586h.005c6.604 0 12.039-5.437 12.042-12.045a11.82 11.82 0 00-3.53-8.472"/></svg>
            Compartir Alerta
          </a>
        </div>
      `)
      .addTo(map.current);
    };

    const handleMouseEnter = () => { if (map.current) map.current.getCanvas().style.cursor = 'pointer'; };
    const handleMouseLeave = () => { if (map.current) map.current.getCanvas().style.cursor = ''; };

    map.current.on('click', 'fire-points', handleFireClick);
    map.current.on('mouseenter', 'fire-points', handleMouseEnter);
    map.current.on('mouseleave', 'fire-points', handleMouseLeave);

    return () => {
      map.current?.off('click', 'fire-points', handleFireClick);
      map.current?.off('mouseenter', 'fire-points', handleMouseEnter);
      map.current?.off('mouseleave', 'fire-points', handleMouseLeave);
    };
  }, [isReady]);

  // Center to user location effect
  useEffect(() => {
    if (!map.current || !isReady || !centerTo) return;
    
    map.current.flyTo({
      center: [centerTo.lon, centerTo.lat],
      zoom: 15,
      duration: 2000,
      essential: true
    });

    if (!userLocationMarker.current) {
      const el = document.createElement('div');
      el.style.width = '16px';
      el.style.height = '16px';
      el.style.backgroundColor = '#3B82F6';
      el.style.border = '3px solid white';
      el.style.borderRadius = '50%';
      el.style.boxShadow = '0 0 10px rgba(59, 130, 246, 0.5)';
      
      userLocationMarker.current = new maplibregl.Marker({ element: el })
        .setLngLat([centerTo.lon, centerTo.lat])
        .addTo(map.current);
    } else {
      userLocationMarker.current.setLngLat([centerTo.lon, centerTo.lat]);
    }
  }, [centerTo, isReady]);

  return <div id="map" ref={mapContainer} style={{ width: '100%', height: '100%' }} />;
};

export default MapViewer;
