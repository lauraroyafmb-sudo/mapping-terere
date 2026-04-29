import React, { useState } from 'react';
import MapViewer from './components/MapViewer';
import FeatureEditor from './components/FeatureEditor';
import { GeoService } from './services/GeoService';
import { 
  Plus, 
  Map as MapIcon, 
  MapPin, 
  Route, 
  Pentagon, 
  CircleDot, 
  Layers, 
  Search,
  Navigation,
  Flame,
  Check,
  Download,
  X
} from 'lucide-react';
import tokml from 'tokml';
import './index.css';

function App() {
  const [activeTab, setActiveTab] = useState('mapa');
  const [points, setPoints] = useState<any[]>(() => {
    const saved = localStorage.getItem('mt_points');
    return saved ? JSON.parse(saved) : [];
  });
  const [geometries, setGeometries] = useState<any[]>(() => {
    const saved = localStorage.getItem('mt_geometries');
    return saved ? JSON.parse(saved) : [];
  });
  const [editingFeature, setEditingFeature] = useState<any | null>(null);
  const [showMaps, setShowMaps] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [drawMode, setDrawMode] = useState<'none' | 'line' | 'polygon'>('none');
  const [currentDrawing, setCurrentDrawing] = useState<any[]>([]);
  const [currentTrack, setCurrentTrack] = useState<any[]>([]);
  const [trackStats, setTrackStats] = useState({ distance: 0, time: 0, speed: 0 });
  const [showLayers, setShowLayers] = useState(false);
  const [showFires, setShowFires] = useState(false);
  const [firePoints, setFirePoints] = useState<any[]>([]);
  const [isLoadingFires, setIsLoadingFires] = useState(false);
  const [maps, setMaps] = useState<any[]>([
    { id: 1, name: 'Parque Nacional', size: '45 MB' },
    { id: 2, name: 'Zona Rural', size: '12 MB' }
  ]);
  const BASE_MAPS = [
    { id: 'voyager', name: 'Calles (Carto)', type: 'Vector', style: 'https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json' },
    { id: 'positron', name: 'Claro (Carto)', type: 'Vector', style: 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json' },
    { id: 'demotiles', name: 'Estándar', type: 'Vector', style: 'https://demotiles.maplibre.org/style.json' },
    { id: 'satellite', name: 'Satélite (ESRI)', type: 'Raster', style: {
        version: 8,
        sources: {
          'esri-satellite': {
            type: 'raster',
            tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'],
            tileSize: 256,
            attribution: 'Esri, Maxar, Earthstar Geographics'
          }
        },
        layers: [{
          id: 'satellite',
          type: 'raster',
          source: 'esri-satellite',
          paint: {}
        }]
      }
    }
  ];
  const [activeMapStyle, setActiveMapStyle] = useState<any>(BASE_MAPS[2].style);
  const [centerTo, setCenterTo] = useState<{lat: number, lon: number, timestamp: number} | null>(null);
  const [isLocating, setIsLocating] = useState(false);
  const [importedTiff, setImportedTiff] = useState<{ url: string, coordinates: number[][] } | null>(null);

  const [showExportModal, setShowExportModal] = useState(false);
  const [exportFilename, setExportFilename] = useState('mis_datos_terere');

  const currentMeasurement = React.useMemo(() => {
    if (drawMode === 'none' || currentDrawing.length < 2) return null;
    if (drawMode === 'line') return GeoService.calculateDistance(currentDrawing);
    if (drawMode === 'polygon' && currentDrawing.length >= 3) return GeoService.calculateArea(currentDrawing);
    return null;
  }, [drawMode, currentDrawing]);

  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const handleCenterLocation = () => {
    if (!navigator.geolocation) {
      alert('Geolocalización no soportada por tu navegador');
      return;
    }
    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setCenterTo({ 
          lat: position.coords.latitude, 
          lon: position.coords.longitude,
          timestamp: Date.now()
        });
        setIsLocating(false);
      },
      (error) => {
        let msg = 'Error desconocido';
        if (error.code === 1) msg = 'Permiso denegado. Habilita el GPS.';
        if (error.code === 2) msg = 'Posición no disponible.';
        if (error.code === 3) msg = 'Tiempo de espera agotado.';
        alert('Error obteniendo ubicación: ' + msg);
        setIsLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  // Cargar focos de calor cuando se activa la capa
  React.useEffect(() => {
    if (showFires && firePoints.length === 0) {
      setIsLoadingFires(true);
      GeoService.fetchFireData().then(data => {
        setFirePoints(data);
        setIsLoadingFires(false);
      });
    }
  }, [showFires]);

  // Simulación de Grabación de Track
  React.useEffect(() => {
    localStorage.setItem('mt_points', JSON.stringify(points));
  }, [points]);

  React.useEffect(() => {
    localStorage.setItem('mt_geometries', JSON.stringify(geometries));
  }, [geometries]);

  React.useEffect(() => {
    let interval: any;
    if (isRecording) {
      interval = setInterval(() => {
        setTrackStats(prev => ({
          ...prev,
          time: prev.time + 1,
          distance: prev.distance + (Math.random() * 0.01),
          speed: 5 + (Math.random() * 2)
        }));
        
        setCurrentTrack(prev => {
          const lastPoint = prev[prev.length - 1] || { lat: -25.3000, lon: -57.6333 };
          return [...prev, { 
            lat: lastPoint.lat + (Math.random() - 0.5) * 0.0001, 
            lon: lastPoint.lon + (Math.random() - 0.5) * 0.0001 
          }];
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isRecording]);

  const handleMapClick = (e: any) => {
    const { lngLat } = e;
    if (drawMode !== 'none') {
      setCurrentDrawing(prev => [...prev, { lat: lngLat.lat, lon: lngLat.lng }]);
    } else {
      setEditingFeature({
        id: Date.now(),
        type: 'point',
        lat: lngLat.lat,
        lon: lngLat.lng,
        name: `Punto ${points.length + 1}`,
        description: '',
        icon: 'default',
        attributes: []
      });
    }
  };

  const finishDrawing = () => {
    if (currentDrawing.length > (drawMode === 'line' ? 1 : 2)) {
      setEditingFeature({
        id: Date.now(),
        type: drawMode,
        coordinates: currentDrawing,
        name: `${drawMode === 'line' ? 'Línea' : 'Polígono'} ${geometries.length + 1}`,
        description: '',
        attributes: []
      });
    }
    setDrawMode('none');
    setCurrentDrawing([]);
  };

  const handleSaveFeature = (data: any) => {
    if (data.type === 'point') {
      const exists = points.find(p => p.id === data.id);
      if (exists) {
        setPoints(points.map(p => p.id === data.id ? data : p));
      } else {
        setPoints([...points, data]);
      }
    } else {
      const exists = geometries.find(g => g.id === data.id);
      if (exists) {
        setGeometries(geometries.map(g => g.id === data.id ? data : g));
      } else {
        setGeometries([...geometries, data]);
      }
    }
    setEditingFeature(null);
  };

  const handleDeleteFeature = (id: number) => {
    setPoints(points.filter(p => p.id !== id));
    setGeometries(geometries.filter(g => g.id !== id));
    setEditingFeature(null);
  };

  const handleImportMap = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.name.toLowerCase().endsWith('.tif') && !file.name.toLowerCase().endsWith('.tiff')) {
        alert('Por favor selecciona un archivo .tif o .tiff válido.');
        return;
      }
      try {
        const result = await GeoService.parseGeoTIFF(file);
        const newMap = {
          id: Date.now(),
          name: file.name.split('.')[0],
          size: `${(file.size / (1024 * 1024)).toFixed(1)} MB`
        };
        setMaps([...maps, newMap]);
        setImportedTiff({ url: result.dataUrl, coordinates: result.coordinates as any });
        setCenterTo({ ...result.center, timestamp: Date.now() });
      } catch (error: any) {
        if (error.message === "PROJECTION_ERROR") {
          alert('Tu mapa está usando coordenadas proyectadas (probablemente UTM) y esto hace que la aplicación falle. Por favor, abre tu archivo en QGIS, expórtalo cambiando el SRC a "WGS 84 (EPSG:4326)" y vuelve a subirlo.');
        } else {
          alert('Error al leer el GeoTIFF. Asegúrate de que no esté corrupto. Detalle: ' + error.message);
        }
      }
    }
  };

  const [exportFormat, setExportFormat] = useState<'geojson' | 'kml'>('geojson');

  const handleExportAction = async (action: 'download' | 'share') => {
    const geojson = GeoService.exportToGeoJSON(points, geometries);
    let dataStr = '';
    let mimeType = '';
    let extension = '';

    if (exportFormat === 'geojson') {
      dataStr = JSON.stringify(geojson, null, 2);
      mimeType = 'text/plain'; // Usar text/plain para mejor compatibilidad al compartir
      extension = 'geojson';
    } else {
      try {
        dataStr = tokml(geojson, {
          name: 'name',
          description: 'description',
          documentName: exportFilename,
          documentDescription: 'Exportado desde Mapping Terere'
        });
        mimeType = 'text/plain'; // Usar text/plain para mejor compatibilidad al compartir
        extension = 'kml';
      } catch (err) {
        alert("Error al exportar a KML");
        return;
      }
    }

    const blob = new Blob([dataStr], { type: mimeType });
    const isShare = action === 'share';
    const fileName = isShare ? `${exportFilename}_${extension}.txt` : `${exportFilename}.${extension}`;
    const file = new File([blob], fileName, { type: mimeType });

    const downloadFile = () => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      a.download = `${exportFilename}.${extension}`;
      document.body.appendChild(a);
      a.click();
      
      setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }, 1000);
      
      setShowExportModal(false);
    };

    if (isShare) {
      if (!navigator.share) {
        alert("Tu navegador no permite compartir directamente. Se descargará el archivo en su lugar.");
        downloadFile();
        return;
      } else if (!navigator.canShare || !navigator.canShare({ files: [file] })) {
        alert("Tu dispositivo no permite compartir este tipo de archivos. Se descargará el archivo en su lugar.");
        downloadFile();
        return;
      } else {
        try {
          await navigator.share({
            title: exportFilename,
            text: `Datos exportados de Mapping Terere en formato ${exportFormat.toUpperCase()} (renombrar a .${extension})`,
            files: [file]
          });
          setShowExportModal(false);
          return; // Salir si se compartió con éxito
        } catch (error: any) {
          if (error.name !== 'AbortError') {
            alert(`Error al compartir: ${error.message || 'el sistema lo bloqueó'}. Se descargará el archivo en su lugar.`);
            downloadFile();
          }
          return;
        }
      }
    }

    // Descarga clásica si eligió 'download'
    downloadFile();


  };

  return (
    <div className="app-container">
      {/* Barra de Búsqueda */}
      <div className="search-bar glass">
        {drawMode !== 'none' ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--primary-dark)', fontWeight: 600 }}>
            <div className="pulse" style={{ background: 'var(--primary)' }}></div>
            MODO DIBUJO: {drawMode === 'line' ? 'LÍNEA' : 'POLÍGONO'}
          </div>
        ) : (
          <>
            <Search size={20} className="text-on-surface-variant" />
            <input type="text" placeholder="Buscar lugares o coordenadas..." />
          </>
        )}
      </div>

      {/* Measurement Overlay */}
      {currentMeasurement && (
        <div style={{
          position: 'absolute',
          top: '80px',
          left: '50%',
          transform: 'translateX(-50%)',
          backgroundColor: 'var(--surface)',
          padding: '0.5rem 1rem',
          borderRadius: '1rem',
          boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
          zIndex: 10,
          fontWeight: 600,
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          color: 'var(--text)'
        }}>
          {drawMode === 'polygon' ? <Pentagon size={16} color="var(--primary)" /> : <Route size={16} color="var(--primary)" />}
          <span>{drawMode === 'polygon' ? 'Área:' : 'Distancia:'} {currentMeasurement}</span>
        </div>
      )}

      {/* Botones Flotantes */}
      <div className="layer-toggle glass" onClick={() => setShowLayers(!showLayers)}>
        <Layers size={24} className={showLayers ? 'text-primary' : 'text-on-surface-variant'} />
      </div>

      {showLayers && (
        <div className="layers-menu glass">
          <h3 style={{ fontSize: '0.9rem', marginBottom: '1rem', color: 'var(--primary-dark)' }}>Capas de Información</h3>
          <div className="layer-item" onClick={() => setShowFires(!showFires)}>
            <div className="layer-icon" style={{ background: showFires ? '#FEE2E2' : '#F3F4F6' }}>
              <Flame size={20} color={showFires ? '#EF4444' : '#6B7280'} />
            </div>
            <div className="layer-info">
              <span className="layer-name">Focos de Calor (FIRMS)</span>
              <span className="layer-desc">Incendios activos últimas 24h</span>
            </div>
            {showFires && <Check size={18} className="text-primary" />}
          </div>
          {isLoadingFires && (
            <div style={{ fontSize: '0.75rem', color: 'var(--primary)', textAlign: 'center', marginTop: '0.5rem' }}>
              Cargando datos satelitales...
            </div>
          )}
        </div>
      )}

      <div className="layer-toggle glass" style={{ top: '5rem' }} onClick={() => setShowMaps(!showMaps)}>
        <MapIcon size={24} className="text-on-surface-variant" />
      </div>

      {/* Visor de Mapa */}
      <MapViewer 
        points={points}
        firePoints={firePoints}
        showFires={showFires}
        track={currentTrack}
        geometries={geometries}
        currentDrawing={currentDrawing}
        drawMode={drawMode}
        centerTo={centerTo}
        mapStyle={activeMapStyle}
        importedTiff={importedTiff}
        onMapClick={handleMapClick}
        onEditFeature={setEditingFeature}
      />

      {/* Panel de Grabación */}
      {isRecording && (
        <div className="recording-panel">
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <span className="pulse"></span>
            <span style={{ fontWeight: 700, color: 'var(--error)' }}>GRABANDO TRACK</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div className="stat-item">
              <span className="stat-label">Distancia</span>
              <span className="stat-value">{trackStats.distance.toFixed(2)} km</span>
            </div>
            <div className="stat-item">
              <span className="stat-label">Tiempo</span>
              <span className="stat-value">
                {Math.floor(trackStats.time / 60)}:{(trackStats.time % 60).toString().padStart(2, '0')}
              </span>
            </div>
            <div className="stat-item">
              <span className="stat-label">Velocidad</span>
              <span className="stat-value">{trackStats.speed.toFixed(1)} km/h</span>
            </div>
            <div className="stat-item">
              <span className="stat-label">Puntos</span>
              <span className="stat-value">{currentTrack.length}</span>
            </div>
          </div>
          <button 
            className="btn btn-primary" 
            style={{ background: 'var(--error)' }}
            onClick={() => setIsRecording(false)}
          >
            Detener Grabación
          </button>
        </div>
      )}

      {/* Panel de Mis Mapas y Capas Base */}
      {showMaps && (
        <div className="modal-overlay" onClick={() => setShowMaps(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700 }}>Mapas Base</h2>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              {BASE_MAPS.map(map => (
                <div 
                  key={map.id} 
                  className="coords-box"
                  style={{ 
                    cursor: 'pointer', 
                    border: activeMapStyle === map.style ? '2px solid var(--primary)' : '2px solid transparent',
                    background: activeMapStyle === map.style ? 'var(--primary-light)' : 'var(--surface-low)',
                    color: activeMapStyle === map.style ? 'var(--primary-dark)' : 'inherit'
                  }}
                  onClick={() => setActiveMapStyle(map.style)}
                >
                  <p style={{ fontWeight: 600 }}>{map.name}</p>
                  <p style={{ fontSize: '0.75rem', opacity: 0.8 }}>{map.type}</p>
                </div>
              ))}
            </div>

            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginTop: '1rem' }}>Mapas Importados</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {maps.map(map => (
                <div key={map.id} className="coords-box" style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <p style={{ fontWeight: 600 }}>{map.name}</p>
                    <p style={{ fontSize: '0.75rem', opacity: 0.7 }}>{map.size}</p>
                  </div>
                  <button className="btn btn-secondary" style={{ width: 'auto', padding: '0.5rem 1rem' }}>Abrir</button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Barra de Herramientas Inferior */}
      <div className="toolbar glass">
        <button className={`tool-button ${activeTab === 'puntos' ? 'text-primary' : ''}`} onClick={() => setActiveTab('puntos')}>
          <MapPin />
          <span>Puntos</span>
        </button>
        <button 
          className={`tool-button ${drawMode === 'line' ? 'text-primary' : ''}`} 
          onClick={() => setDrawMode(drawMode === 'line' ? 'none' : 'line')}
        >
          <Route />
          <span>Líneas</span>
        </button>
        <button 
          className={`tool-button ${drawMode === 'polygon' ? 'text-primary' : ''}`} 
          onClick={() => setDrawMode(drawMode === 'polygon' ? 'none' : 'polygon')}
        >
          <Pentagon />
          <span>Polígonos</span>
        </button>
        <button className={`tool-button ${isRecording ? 'text-error' : activeTab === 'track' ? 'text-primary' : ''}`} onClick={() => {
          setActiveTab('track');
          setIsRecording(true);
          setTrackStats({ distance: 0, time: 0, speed: 0 });
          setCurrentTrack([]);
        }}>
          <CircleDot color={isRecording ? 'var(--error)' : 'currentColor'} />
          <span>{isRecording ? 'Grabando' : 'Grabar'}</span>
        </button>
      </div>

      {/* Botón Flotante Principal (Importar Mapa) */}
      <input 
        type="file" 
        ref={fileInputRef} 
        style={{ display: 'none' }} 
        accept=".tif,.tiff"
        onChange={handleImportMap}
      />
      <div style={{ position: 'fixed', bottom: '8rem', right: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem', zIndex: 50 }}>
        <button 
          className="fab" 
          style={{ width: '48px', height: '48px', position: 'static' }}
          onClick={() => setShowExportModal(true)}
          title="Exportar Datos"
        >
          <Download size={24} />
        </button>

        <button 
          className="fab" 
          style={{ width: '48px', height: '48px', opacity: isLocating ? 0.7 : 1, position: 'static' }}
          onClick={handleCenterLocation}
          title="Centrar en mi ubicación GPS"
        >
          <Navigation size={24} className={isLocating ? 'pulse' : ''} />
        </button>

        <button 
          className="fab" 
          style={{ position: 'static' }} 
          title="Cargar nuevo mapa" 
          onClick={() => fileInputRef.current?.click()}
        >
          <Plus size={32} />
        </button>
      </div>

      {/* Export Modal */}
      {showExportModal && (
        <div className="modal-overlay" onClick={() => setShowExportModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '400px' }}>
            <div className="editor-header" style={{ marginBottom: '1rem' }}>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 700 }}>Exportar Datos</h2>
              <button className="icon-button" onClick={() => setShowExportModal(false)}>
                <X size={20} />
              </button>
            </div>
            
            <div className="form-group" style={{ marginBottom: '1.5rem' }}>
              <label>Nombre del archivo</label>
              <input 
                type="text" 
                value={exportFilename} 
                onChange={(e) => setExportFilename(e.target.value)} 
                placeholder="mis_datos_terere"
              />
            </div>

            <div className="form-group" style={{ marginBottom: '1.5rem' }}>
              <label>Formato de Exportación</label>
              <div style={{ display: 'flex', gap: '1rem', marginTop: '0.5rem' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                  <input 
                    type="radio" 
                    name="format" 
                    value="geojson" 
                    checked={exportFormat === 'geojson'}
                    onChange={() => setExportFormat('geojson')}
                  />
                  GeoJSON (QGIS)
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                  <input 
                    type="radio" 
                    name="format" 
                    value="kml" 
                    checked={exportFormat === 'kml'}
                    onChange={() => setExportFormat('kml')}
                  />
                  KML (Google Earth)
                </label>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <button 
                className="btn btn-primary" 
                onClick={() => handleExportAction('share')}
                style={{ padding: '1rem' }}
              >
                Compartir (WhatsApp / Gmail)
              </button>
              <button 
                className="btn btn-secondary" 
                onClick={() => handleExportAction('download')}
                style={{ padding: '1rem' }}
              >
                Guardar en Dispositivo
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Editor de Entidades (Punto, Línea, Polígono) */}
      {editingFeature && (
        <FeatureEditor 
          feature={editingFeature}
          onSave={handleSaveFeature}
          onDelete={handleDeleteFeature}
          onClose={() => setEditingFeature(null)}
        />
      )}

      {/* Botón para finalizar dibujo */}
      {drawMode !== 'none' && currentDrawing.length > 0 && (
        <button 
          className="fab" 
          style={{ bottom: '8rem', left: '1.5rem', width: 'auto', padding: '0 1.5rem', borderRadius: '1rem', background: 'var(--primary-dark)' }}
          onClick={finishDrawing}
        >
          Finalizar {drawMode === 'line' ? 'Línea' : 'Polígono'}
        </button>
      )}
    </div>
  );
}

export default App;
