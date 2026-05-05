import React, { useState, useRef } from 'react';
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
  X,
  Eye,
  EyeOff,
  Folder,
  Trash,
  Pause,
  Play
} from 'lucide-react';
import tokml from 'tokml';
import localforage from 'localforage';
import './index.css';

interface Folder {
  id: number;
  name: string;
  linkedLayerId?: number;
  visible: boolean;
}

function App() {
  const [activeTab, _setActiveTab] = useState('mapa');
  const [points, setPoints] = useState<any[]>([]);
  const [geometries, setGeometries] = useState<any[]>([]);

  const [customLayers, setCustomLayers] = useState<any[]>([]);
  const [folders, setFolders] = useState<Folder[]>([]);
  const mapRef = useRef<any>(null);

  React.useEffect(() => {
    localforage.getItem('mt_points').then((saved: any) => {
      if (saved && Array.isArray(saved)) setPoints(saved);
    });
    localforage.getItem('mt_geometries').then((saved: any) => {
      if (saved && Array.isArray(saved)) setGeometries(saved);
    });
    localforage.getItem('mt_custom_layers').then((saved: any) => {
      if (saved && Array.isArray(saved)) setCustomLayers(saved);
    });
    localforage.getItem('mt_folders').then((saved: any) => {
      if (saved && Array.isArray(saved)) setFolders(saved);
    });
    localforage.getItem('mt_active_map_style').then((saved: any) => {
      if (saved) setActiveMapStyle(saved);
    });
  }, []);
  const [editingFeature, setEditingFeature] = useState<any | null>(null);
  const [showMaps, setShowMaps] = useState(false);
  const [showDataList, setShowDataList] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [accumulatedTime, setAccumulatedTime] = useState(0);
  const [lastResumeTime, setLastResumeTime] = useState(0);
  const [drawMode, setDrawMode] = useState<'none' | 'point' | 'line' | 'polygon'>('none');
  const [currentDrawing, setCurrentDrawing] = useState<any[]>([]);
  const [currentTrack, setCurrentTrack] = useState<any[]>([]);
  const [userLocation, setUserLocation] = useState<{lat: number, lon: number, accuracy: number} | null>(null);
  const [isFollowing, setIsFollowing] = useState(false);
  const [activeFolderId, setActiveFolderId] = useState<number | null>(null);
  const [showProjectSelector, setShowProjectSelector] = useState(true);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [installStatus, setInstallStatus] = useState<'idle' | 'installing' | 'installed'>('idle');
  const [trackStats, setTrackStats] = useState({ distance: 0, time: 0, speed: 0 });
  const [showLayers, setShowLayers] = useState(false);
  const [showFires, setShowFires] = useState(false);
  const [firePoints, setFirePoints] = useState<any[]>([]);
  const [isLoadingFires, setIsLoadingFires] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  
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
            attribution: 'Esri, Maxar'
          }
        },
        layers: [{
          id: 'satellite',
          type: 'raster',
          source: 'esri-satellite',
          paint: {}
        }]
      }
    },
    { id: 'hybrid', name: 'Híbrido (ESRI)', type: 'Raster', style: {
        version: 8,
        sources: {
          'esri-satellite': {
            type: 'raster',
            tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'],
            tileSize: 256,
            attribution: 'Esri'
          },
          'esri-reference': {
            type: 'raster',
            tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}'],
            tileSize: 256
          },
          'esri-transport': {
            type: 'raster',
            tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Transportation/MapServer/tile/{z}/{y}/{x}'],
            tileSize: 256
          }
        },
        layers: [
          { id: 'satellite', type: 'raster', source: 'esri-satellite', paint: {} },
          { id: 'transport', type: 'raster', source: 'esri-transport', paint: {} },
          { id: 'reference', type: 'raster', source: 'esri-reference', paint: {} }
        ]
      }
    }
  ];
  const [activeMapStyle, setActiveMapStyle] = useState<any>(BASE_MAPS[2].style);
  const [centerTo, setCenterTo] = useState<{lat: number, lon: number, timestamp: number} | null>(null);
  const [isLocating, setIsLocating] = useState(false);

  const [showExportModal, setShowExportModal] = useState(false);
  const [exportFilename, setExportFilename] = useState('mis_datos_terere');

  const [showServiceModal, setShowServiceModal] = useState(false);
  const [newServiceName, setNewServiceName] = useState('');
  const [newServiceUrl, setNewServiceUrl] = useState('');

  const [showNewFolderModal, setShowNewFolderModal] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [newFolderLinkedMapId, setNewFolderLinkedMapId] = useState<number | 'none'>('none');

  // Lógica de visibilidad en cascada
  const visiblePoints = React.useMemo(() => {
    return points.filter(p => {
      if (!p.folderId) return true;
      const folder = folders.find(f => f.id === p.folderId);
      if (!folder || !folder.visible) return false;
      if (folder.linkedLayerId) {
        const layer = customLayers.find(l => l.id === folder.linkedLayerId);
        if (layer && !layer.visible) return false;
      }
      return true;
    });
  }, [points, folders, customLayers]);

  const visibleGeometries = React.useMemo(() => {
    return geometries.filter(g => {
      if (!g.folderId) return true;
      const folder = folders.find(f => f.id === g.folderId);
      if (!folder || !folder.visible) return false;
      if (folder.linkedLayerId) {
        const layer = customLayers.find(l => l.id === folder.linkedLayerId);
        if (layer && !layer.visible) return false;
      }
      return true;
    });
  }, [geometries, folders, customLayers]);


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

  // Guardar datos en localforage (IndexedDB) para evitar límite de 5MB
  React.useEffect(() => {
    localforage.setItem('mt_points', points).catch(console.error);
  }, [points]);

  React.useEffect(() => {
    localforage.setItem('mt_geometries', geometries).catch(console.error);
  }, [geometries]);

  React.useEffect(() => {
    localforage.setItem('mt_custom_layers', customLayers).catch(console.error);
  }, [customLayers]);

  React.useEffect(() => {
    localforage.setItem('mt_folders', folders).catch(console.error);
  }, [folders]);

  React.useEffect(() => {
    localforage.setItem('mt_active_map_style', activeMapStyle).catch(console.error);
  }, [activeMapStyle]);

  React.useEffect(() => {
    // Detectar si ya está instalada
    if (window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone) {
      setIsInstalled(true);
    }

    // Detectar iOS
    const isIOSDevice = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
    setIsIOS(isIOSDevice);

    const handleBeforeInstall = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setIsInstalled(false);
    };

    const handleAppInstalled = () => {
      setDeferredPrompt(null);
      setIsInstalled(true);
      setInstallStatus('installed');
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    
    setInstallStatus('installing');
    deferredPrompt.prompt();
    
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      // Instalación aceptada
    } else {
      setInstallStatus('idle');
    }
    setDeferredPrompt(null);
  };

  // Monitoreo constante de la ubicación GPS para navegación
  React.useEffect(() => {
    if (!navigator.geolocation) return;

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        const loc = {
          lat: position.coords.latitude,
          lon: position.coords.longitude,
          accuracy: position.coords.accuracy
        };
        setUserLocation(loc);
        
        // Auto-centrado si el modo seguimiento está activo
        if (isFollowing) {
          setCenterTo({ lat: loc.lat, lon: loc.lon, timestamp: Date.now() });
        }
      },
      (error) => console.error('Error GPS Global:', error),
      { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, [isFollowing]);

  const handleAddCustomService = () => {
    if (!newServiceName || !newServiceUrl) return;
    setCustomLayers(prev => [...prev, { 
      id: Date.now(), 
      name: newServiceName, 
      type: 'xyz', 
      url: newServiceUrl, 
      visible: true 
    }]);
    setShowServiceModal(false);
    setNewServiceName('');
    setNewServiceUrl('');
  };

  React.useEffect(() => {
    let watchId: number | null = null;

    if (isRecording && !isPaused) {
      if (!navigator.geolocation) {
        alert('Geolocalización no soportada');
        setIsRecording(false);
        return;
      }

      setLastResumeTime(Date.now());

      watchId = navigator.geolocation.watchPosition(
        (position) => {
          const newPoint = { 
            lat: position.coords.latitude, 
            lon: position.coords.longitude,
            timestamp: position.timestamp 
          };

          setCurrentTrack(prev => {
            if (prev.length > 0) {
              const lastPoint = prev[prev.length - 1];
              
              if (position.coords.accuracy > 30) return prev;

              const distStr = GeoService.calculateDistance([lastPoint, newPoint]);
              if (!distStr) return prev;

              const isMeters = distStr.includes('m');
              const value = parseFloat(distStr.split(' ')[0]) || 0;
              const distInKm = isMeters ? value / 1000 : value;

              if (distInKm < 0.002) return prev;
              
              setTrackStats(s => ({
                distance: s.distance + distInKm,
                time: accumulatedTime + Math.floor((Date.now() - (lastResumeTime || Date.now())) / 1000),
                speed: position.coords.speed ? position.coords.speed * 3.6 : s.speed
              }));
            }
            return [...prev, newPoint];
          });
        },
        (error) => console.error('GPS Error:', error),
        { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
      );
    } else if (isRecording && isPaused) {
      // Al pausar, guardamos el tiempo acumulado hasta ahora
      setAccumulatedTime(prev => prev + Math.floor((Date.now() - lastResumeTime) / 1000));
    }

    return () => {
      if (watchId !== null) navigator.geolocation.clearWatch(watchId);
    };
  }, [isRecording, isPaused]);

  const handleMapClick = (e: any) => {
    const { lngLat } = e;
    if (drawMode === 'point') {
      setEditingFeature({
        id: Date.now(),
        type: 'point',
        lat: lngLat.lat,
        lon: lngLat.lng,
        name: `Punto ${points.length + 1}`,
        description: '',
        icon: 'default',
        attributes: [],
        photos: [],
        folderId: activeFolderId
      });
      setDrawMode('none');
    } else if (drawMode !== 'none') {
      setCurrentDrawing(prev => [...prev, { lat: lngLat.lat, lon: lngLat.lng }]);
    } else {
      // Por defecto, clic en el mapa también puede crear un punto o podemos dejarlo solo para los modos
      setEditingFeature({
        id: Date.now(),
        type: 'point',
        lat: lngLat.lat,
        lon: lngLat.lng,
        name: `Punto ${points.length + 1}`,
        description: '',
        icon: 'default',
        attributes: [],
        photos: [],
        folderId: activeFolderId
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
        attributes: [],
        folderId: activeFolderId
      });
    }
    setDrawMode('none');
    setCurrentDrawing([]);
  };

  const handleSaveFeature = (data: any, newFolder?: { name: string, linkedLayerId?: number }) => {
    let targetFolderId = data.folderId;

    if (newFolder) {
      const folder: Folder = {
        id: Date.now(),
        name: newFolder.name,
        linkedLayerId: newFolder.linkedLayerId,
        visible: true
      };
      setFolders(prev => [...prev, folder]);
      targetFolderId = folder.id;
    }

    const featureWithFolder = { ...data, folderId: targetFolderId };

    if (data.type === 'point') {
      const exists = points.find(p => p.id === data.id);
      if (exists) {
        setPoints(points.map(p => p.id === data.id ? featureWithFolder : p));
      } else {
        setPoints([...points, featureWithFolder]);
      }
    } else {
      const exists = geometries.find(g => g.id === data.id);
      if (exists) {
        setGeometries(geometries.map(g => g.id === data.id ? featureWithFolder : g));
      } else {
        setGeometries([...geometries, featureWithFolder]);
      }
    }
    setEditingFeature(null);
  };

  const handleDeleteFeature = (id: number) => {
    setPoints(points.filter(p => p.id !== id));
    setGeometries(geometries.filter(g => g.id !== id));
    setEditingFeature(null);
  };

  const handleCreateFolder = () => {
    if (!newFolderName) return;
    const newFolder: Folder = {
      id: Date.now(),
      name: newFolderName,
      linkedLayerId: newFolderLinkedMapId === 'none' ? undefined : newFolderLinkedMapId,
      visible: true
    };
    setFolders(prev => [...prev, newFolder]);
    setActiveFolderId(newFolder.id);
    setNewFolderName('');
    setNewFolderLinkedMapId('none');
    setShowNewFolderModal(false);
    setShowProjectSelector(false);
  };

  const handleImportMap = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const isRaster = file.name.toLowerCase().match(/\.(tif|tiff)$/);
      const isVector = file.name.toLowerCase().match(/\.(kml|kmz|geojson|json)$/);
      
      if (!isRaster && !isVector) {
        alert('Por favor selecciona un archivo .tif, .kml, .kmz o .geojson válido.');
        return;
      }

      if (isRaster) {
        try {
          const result = await GeoService.parseGeoTIFF(file);
          setCustomLayers(prev => [...prev, {
            id: Date.now(),
            name: file.name.split('.')[0],
            type: 'tiff',
            url: result.dataUrl,
            coordinates: result.coordinates as any,
            visible: true
          }]);
          setCenterTo({ ...result.center, timestamp: Date.now() });
        } catch (error: any) {
          if (error.message === "PROJECTION_ERROR") {
            alert('Tu mapa está usando coordenadas proyectadas (probablemente UTM) y esto hace que la aplicación falle. Por favor, abre tu archivo en QGIS, expórtalo cambiando el SRC a "WGS 84 (EPSG:4326)" y vuelve a subirlo.');
          } else {
            alert('Error al leer el GeoTIFF. Asegúrate de que no esté corrupto. Detalle: ' + error.message);
          }
        }
      } else if (isVector) {
        try {
          const result = await GeoService.importVectorFile(file);
          if (result.points.length === 0 && result.geometries.length === 0) {
            alert("No se encontraron geometrías válidas en el archivo.");
            return;
          }
          setPoints(prev => [...prev, ...result.points]);
          setGeometries(prev => [...prev, ...result.geometries]);
          alert(`Se importaron ${result.points.length} puntos y ${result.geometries.length} geometrías.`);
          
          if (result.points.length > 0) {
            setCenterTo({ lat: result.points[0].lat, lon: result.points[0].lon, timestamp: Date.now() });
          } else if (result.geometries.length > 0 && result.geometries[0].coordinates.length > 0) {
            setCenterTo({ lat: result.geometries[0].coordinates[0].lat, lon: result.geometries[0].coordinates[0].lon, timestamp: Date.now() });
          }
        } catch (error: any) {
          alert('Error al importar archivo vectorial: ' + error.message);
        }
      }
    }
    // Limpiar input para permitir importar el mismo archivo de nuevo si es necesario
    if (e.target) e.target.value = '';
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
            MODO DIBUJO: {drawMode === 'line' ? 'LÍNEA' : drawMode === 'polygon' ? 'POLÍGONO' : 'PUNTO'}
            <span style={{ fontSize: '0.75rem', fontWeight: 400, marginLeft: '0.5rem' }}>
              {drawMode === 'point' ? 'Toca el mapa para ubicar' : 'Toca para añadir vértices'}
            </span>
          </div>
        ) : (
          <>
            <Search size={20} className="text-on-surface-variant" />
            <input type="text" placeholder="Buscar lugares o coordenadas..." />
            {userLocation && (
              <div style={{ 
                marginLeft: 'auto', 
                fontSize: '0.7rem', 
                background: userLocation.accuracy < 15 ? 'rgba(34, 197, 94, 0.2)' : 'rgba(234, 179, 8, 0.2)',
                color: userLocation.accuracy < 15 ? 'var(--primary-dark)' : 'var(--warning)',
                padding: '2px 8px',
                borderRadius: '10px',
                fontWeight: 700,
                whiteSpace: 'nowrap'
              }}>
                ±{userLocation.accuracy.toFixed(0)}m
              </div>
            )}
          </>
        )}
      </div>

      {/* Measurement Overlay y Botón de Guardar Dibujo */}
      {currentDrawing.length > 0 && drawMode !== 'none' && (
        <div style={{
          position: 'absolute',
          top: '80px',
          left: '50%',
          transform: 'translateX(-50%)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '0.5rem',
          zIndex: 100
        }}>
          <div className="glass" style={{
            padding: '0.5rem 1rem',
            borderRadius: '1rem',
            boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            color: 'var(--text)'
          }}>
            {drawMode === 'polygon' ? <Pentagon size={16} color="var(--primary)" /> : <Route size={16} color="var(--primary)" />}
            <span>{drawMode === 'polygon' ? 'Área:' : 'Distancia:'} {currentMeasurement}</span>
          </div>
          
          <button 
            className="btn btn-primary" 
            style={{ borderRadius: '2rem', padding: '0.5rem 1.5rem', boxShadow: '0 4px 12px rgba(37, 99, 235, 0.3)' }}
            onClick={() => {
              setEditingFeature({
                id: Date.now(),
                type: drawMode,
                coordinates: [...currentDrawing],
                name: '',
                description: '',
                attributes: [],
                photos: []
              });
              setDrawMode('none');
              setCurrentDrawing([]);
            }}
          >
            Finalizar y Guardar
          </button>
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
        ref={mapRef}
        points={visiblePoints}
        firePoints={firePoints}
        showFires={showFires}
        track={currentTrack}
        geometries={visibleGeometries}
        currentDrawing={currentDrawing}
        editingFeature={editingFeature}
        drawMode={drawMode}
        centerTo={centerTo}
        mapStyle={activeMapStyle}
        customLayers={customLayers}
        onMapClick={handleMapClick}
        onEditFeature={setEditingFeature}
        onDrawingUpdate={setCurrentDrawing}
        onFeatureUpdate={setEditingFeature}
        userLocation={userLocation}
      />

      {/* Panel de Grabación */}
      {isRecording && (
        <div className="recording-panel">
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <span className={isPaused ? '' : 'pulse'} style={{ background: isPaused ? 'var(--on-surface-variant)' : 'var(--error)' }}></span>
            <span style={{ fontWeight: 700, color: isPaused ? 'var(--on-surface-variant)' : 'var(--error)' }}>
              {isPaused ? 'TRACK PAUSADO' : 'GRABANDO TRACK'}
            </span>
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
          
          <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
            <button 
              className="btn" 
              style={{ 
                flex: 1, 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center', 
                gap: '0.5rem',
                background: isPaused ? 'var(--primary)' : 'var(--surface-highest)',
                color: isPaused ? 'white' : 'inherit'
              }}
              onClick={() => setIsPaused(!isPaused)}
            >
              {isPaused ? <Play size={20} /> : <Pause size={20} />}
              <span>{isPaused ? 'Reanudar' : 'Pausar'}</span>
            </button>
            <button 
              className="btn btn-primary" 
              style={{ flex: 1, background: 'var(--error)' }}
              onClick={() => {
                const trackData = {
                  id: Date.now(),
                  type: 'line',
                  coordinates: [...currentTrack],
                  name: `Track ${new Date().toLocaleTimeString()}`,
                  description: `Grabado el ${new Date().toLocaleDateString()}`,
                  attributes: [
                    { key: 'Distancia', value: `${trackStats.distance.toFixed(2)} km` },
                    { key: 'Tiempo', value: `${Math.floor(trackStats.time / 60)}:${(trackStats.time % 60).toString().padStart(2, '0')}` }
                  ]
                };
                setEditingFeature(trackData);
                setIsRecording(false);
              }}
            >
              Detener
            </button>
          </div>
        </div>
      )}

      {/* Panel de Mis Mapas y Capas Base */}
      {showMaps && (
        <div className="modal-overlay" onClick={() => setShowMaps(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxHeight: '80vh', overflowY: 'auto' }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--primary-dark)' }}>Mapas Base y Capas</h2>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              {BASE_MAPS.map(map => (
                <div 
                  key={map.id} 
                  className="coords-box"
                  style={{ 
                    cursor: 'pointer', 
                    border: activeMapStyle === map.style ? '2px solid var(--primary)' : '2px solid transparent',
                    background: activeMapStyle === map.style ? 'rgba(34, 197, 94, 0.1)' : 'var(--surface-low)',
                    color: activeMapStyle === map.style ? 'var(--primary-dark)' : 'inherit'
                  }}
                  onClick={() => setActiveMapStyle(map.style)}
                >
                  <p style={{ fontWeight: 600 }}>{map.name}</p>
                  <p style={{ fontSize: '0.75rem', opacity: 0.8 }}>{map.type}</p>
                </div>
              ))}
            </div>

            <h3 style={{ fontSize: '1rem', marginTop: '1rem', fontWeight: 700 }}>Mis Mapas Importados</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {customLayers.length === 0 && <p style={{ fontSize: '0.85rem', opacity: 0.6 }}>No hay mapas importados.</p>}
              {customLayers.map(layer => (
                <div 
                  key={layer.id} 
                  className="coords-box"
                  style={{ 
                    flexDirection: 'row', 
                    justifyContent: 'space-between', 
                    alignItems: 'center',
                    background: 'var(--surface-low)'
                  }}
                >
                  <div style={{ flex: 1 }}>
                    <p style={{ fontWeight: 600 }}>{layer.name}</p>
                    <p style={{ fontSize: '0.75rem', opacity: 0.8 }}>{layer.type === 'xyz' ? 'Servicio Web XYZ' : 'GeoTIFF'}</p>
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        setCustomLayers(customLayers.map(l => l.id === layer.id ? { ...l, visible: !l.visible } : l));
                      }}
                      style={{ background: 'none', border: 'none', color: layer.visible ? 'var(--primary)' : 'var(--on-surface-variant)', cursor: 'pointer', padding: '0.5rem' }}
                    >
                      {layer.visible ? <Eye size={20} /> : <EyeOff size={20} />}
                    </button>
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        if (confirm('¿Eliminar este mapa? Los datos dibujados sobre él NO se borrarán.')) {
                          setCustomLayers(customLayers.filter(s => s.id !== layer.id));
                        }
                      }}
                      style={{ background: 'none', border: 'none', color: 'var(--error)', cursor: 'pointer', padding: '0.5rem' }}
                    >
                      <Trash size={20} />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <button 
              className="btn btn-primary" 
              style={{ width: '100%', marginTop: '1rem' }}
              onClick={() => setShowServiceModal(true)}
            >
              <Plus size={18} /> Añadir Servicio Web (XYZ)
            </button>
          </div>
        </div>
      )}

      {/* Panel de Mis Datos (Carpetas y Listas) */}
      {showDataList && (
        <div className="modal-overlay" onClick={() => setShowDataList(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxHeight: '85vh', overflowY: 'auto' }}>
            <div className="editor-header" style={{ padding: '0 0 1rem 0' }}>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 700 }}>Mis Datos</h2>
              <button className="icon-button" onClick={() => setShowDataList(false)}>
                <X size={20} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {/* Carpeta General */}
              <div className="folder-container glass" style={{ borderRadius: '1rem', overflow: 'hidden' }}>
                <div style={{ padding: '1rem', background: 'var(--surface-low)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Folder size={20} color="var(--primary-dark)" />
                    <span style={{ fontWeight: 700 }}>General (Sin Carpeta)</span>
                  </div>
                </div>
                <div style={{ padding: '0.5rem' }}>
                  {points.filter(p => !p.folderId).map(p => (
                    <div key={p.id} className="layer-item" onClick={() => { setEditingFeature(p); setShowDataList(false); }}>
                      <MapPin size={16} /> <span style={{ flex: 1 }}>{p.name}</span>
                    </div>
                  ))}
                  {geometries.filter(g => !g.folderId).map(g => (
                    <div key={g.id} className="layer-item" onClick={() => { setEditingFeature(g); setShowDataList(false); }}>
                      {g.type === 'line' ? <Route size={16} /> : <Pentagon size={16} />} 
                      <span style={{ flex: 1 }}>{g.name}</span>
                    </div>
                  ))}
                  {points.filter(p => !p.folderId).length === 0 && geometries.filter(g => !g.folderId).length === 0 && (
                    <p style={{ fontSize: '0.8rem', opacity: 0.5, padding: '0.5rem' }}>No hay elementos en esta carpeta.</p>
                  )}
                </div>
              </div>

              {/* Carpetas del Usuario */}
              {folders.map(folder => (
                <div key={folder.id} className="folder-container glass" style={{ borderRadius: '1rem', overflow: 'hidden', borderLeft: folder.visible ? '4px solid var(--primary)' : '4px solid var(--surface-highest)' }}>
                  <div style={{ padding: '1rem', background: 'var(--surface-low)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <Folder size={20} color={folder.visible ? 'var(--primary-dark)' : 'var(--on-surface-variant)'} />
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <span style={{ fontWeight: 700 }}>{folder.name}</span>
                        {folder.linkedLayerId && (
                          <span style={{ fontSize: '0.65rem', opacity: 0.7 }}>
                            Vínculo: {customLayers.find(l => l.id === folder.linkedLayerId)?.name || 'Mapa eliminado'}
                          </span>
                        )}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <button 
                        onClick={() => setFolders(folders.map(f => f.id === folder.id ? { ...f, visible: !f.visible } : f))}
                        style={{ background: 'none', border: 'none', color: folder.visible ? 'var(--primary)' : 'var(--on-surface-variant)', cursor: 'pointer' }}
                      >
                        {folder.visible ? <Eye size={20} /> : <EyeOff size={20} />}
                      </button>
                      <button 
                        onClick={() => {
                          if (confirm(`¿Eliminar carpeta "${folder.name}"? Los datos se moverán a General.`)) {
                            setPoints(points.map(p => p.folderId === folder.id ? { ...p, folderId: undefined } : p));
                            setGeometries(geometries.map(g => g.folderId === folder.id ? { ...g, folderId: undefined } : g));
                            setFolders(folders.filter(f => f.id !== folder.id));
                          }
                        }}
                        style={{ background: 'none', border: 'none', color: 'var(--error)', cursor: 'pointer' }}
                      >
                        <Trash size={18} />
                      </button>
                    </div>
                  </div>
                  <div style={{ padding: '0.5rem' }}>
                    {points.filter(p => p.folderId === folder.id).map(p => (
                      <div key={p.id} className="layer-item" onClick={() => { setEditingFeature(p); setShowDataList(false); }}>
                        <MapPin size={16} /> <span style={{ flex: 1 }}>{p.name}</span>
                      </div>
                    ))}
                    {geometries.filter(g => g.folderId === folder.id).map(g => (
                      <div key={g.id} className="layer-item" onClick={() => { setEditingFeature(g); setShowDataList(false); }}>
                        {g.type === 'line' ? <Route size={16} /> : <Pentagon size={16} />} 
                        <span style={{ flex: 1 }}>{g.name}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Barra de Herramientas Inferior */}
      <div className="toolbar glass" style={{ gap: '0.5rem', padding: '0.75rem 1rem' }}>
        <button className={`tool-button ${showDataList ? 'text-primary' : ''}`} onClick={() => setShowDataList(!showDataList)}>
          <Folder size={22} />
          <span>Datos</span>
        </button>
        <button className={`tool-button ${drawMode === 'point' ? 'text-primary' : ''}`} onClick={() => setDrawMode(drawMode === 'point' ? 'none' : 'point')}>
          <MapPin size={22} />
          <span>Puntos</span>
        </button>
        <button 
          className={`tool-button ${drawMode === 'line' ? 'text-primary' : ''}`} 
          onClick={() => setDrawMode(drawMode === 'line' ? 'none' : 'line')}
        >
          <Route size={22} />
          <span>Líneas</span>
        </button>
        <button 
          className={`tool-button ${drawMode === 'polygon' ? 'text-primary' : ''}`} 
          onClick={() => setDrawMode(drawMode === 'polygon' ? 'none' : 'polygon')}
        >
          <Pentagon size={22} />
          <span>Polígonos</span>
        </button>
        <button className={`tool-button ${isRecording ? 'text-error' : activeTab === 'track' ? 'text-primary' : ''}`} onClick={() => {
          if (isRecording) {
            // Ya se maneja en el panel de grabación
          } else {
            setIsRecording(true);
            setIsPaused(false);
            setAccumulatedTime(0);
            setLastResumeTime(Date.now());
            setTrackStats({ distance: 0, time: 0, speed: 0 });
            setCurrentTrack([]);
          }
        }}>
          <CircleDot size={22} color={isRecording ? 'var(--error)' : 'currentColor'} />
          <span>{isRecording ? 'Grabando' : 'Grabar'}</span>
        </button>
      </div>

      {/* Botón Flotante Principal (Importar Mapa) */}
      <input 
        type="file" 
        ref={fileInputRef} 
        style={{ display: 'none' }} 
        accept=".tif,.tiff,.kml,.kmz,.geojson,.json"
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
          style={{ width: '48px', height: '48px', opacity: isLocating ? 0.7 : 1, position: 'static', color: isFollowing ? 'white' : 'inherit', background: isFollowing ? 'var(--primary)' : 'var(--surface)' }}
          onClick={() => {
            if (isFollowing) {
              setIsFollowing(false);
            } else {
              handleCenterLocation();
              setIsFollowing(true);
            }
          }}
          title={isFollowing ? "Desactivar seguimiento" : "Activar seguimiento"}
        >
          <Navigation size={24} className={isFollowing ? '' : isLocating ? 'pulse' : ''} />
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

      {/* Service Web Modal */}
      {showServiceModal && (
        <div className="modal-overlay" onClick={() => setShowServiceModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '400px' }}>
            <div className="editor-header" style={{ marginBottom: '1rem' }}>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 700 }}>Añadir Capa Web</h2>
              <button className="icon-button" onClick={() => setShowServiceModal(false)}>
                <X size={20} />
              </button>
            </div>
            <p style={{ fontSize: '0.875rem', color: 'var(--on-surface-variant)', marginBottom: '1rem' }}>
              Usa mosaicos estándar XYZ para cargar imágenes pesadas pre-procesadas (ej: desde QGIS).
            </p>
            <div className="form-group" style={{ marginBottom: '1.5rem' }}>
              <label>Nombre de la capa</label>
              <input 
                type="text" 
                value={newServiceName} 
                onChange={(e) => setNewServiceName(e.target.value)} 
                placeholder="Ej. Mi Ortofoto XYZ"
              />
            </div>
            <div className="form-group" style={{ marginBottom: '1.5rem' }}>
              <label>URL del Servicio (formato XYZ)</label>
              <input 
                type="text" 
                value={newServiceUrl} 
                onChange={(e) => setNewServiceUrl(e.target.value)} 
                placeholder="https://.../{z}/{x}/{y}.png"
              />
            </div>
            <button 
              className="btn btn-primary" 
              onClick={handleAddCustomService}
              disabled={!newServiceName || !newServiceUrl}
            >
              Guardar y Añadir
            </button>
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
          folders={folders}
          customLayers={customLayers}
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
      {/* Selector de Proyecto Inicial */}
      {showProjectSelector && (
        <div className="modal-overlay" style={{ background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(10px)' }}>
          <div className="modal-content" style={{ maxWidth: '450px', background: 'var(--surface)', padding: '2rem' }}>
            <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
              <img 
                src="./logo-terere.png" 
                alt="Mapping Terere Logo" 
                style={{ 
                  width: '140px', 
                  height: '140px', 
                  borderRadius: '24px', 
                  marginBottom: '1rem', 
                  boxShadow: '0 10px 25px rgba(0,0,0,0.15)',
                  border: '4px solid white'
                }} 
              />
              <h1 style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--primary-dark)', marginBottom: '0.5rem' }}>Mapping Terere</h1>
              <p style={{ opacity: 0.7 }}>Gestión de Proyectos GIS</p>
            </div>

            <h2 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '1rem' }}>Seleccionar Proyecto</h2>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', maxHeight: '40vh', overflowY: 'auto', marginBottom: '1.5rem', paddingRight: '0.5rem' }}>
              <div 
                className="coords-box" 
                style={{ cursor: 'pointer', border: activeFolderId === null ? '2px solid var(--primary)' : '1px solid var(--surface-highest)' }}
                onClick={() => {
                  setActiveFolderId(null);
                  setShowProjectSelector(false);
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <Folder size={24} color="var(--primary)" />
                  <div>
                    <p style={{ fontWeight: 700 }}>General</p>
                    <p style={{ fontSize: '0.75rem', opacity: 0.6 }}>Todos los datos sin categorizar</p>
                  </div>
                </div>
              </div>

              {folders.map(folder => (
                <div 
                  key={folder.id} 
                  className="coords-box" 
                  style={{ cursor: 'pointer', border: activeFolderId === folder.id ? '2px solid var(--primary)' : '1px solid var(--surface-highest)' }}
                  onClick={() => {
                    setActiveFolderId(folder.id);
                    setShowProjectSelector(false);
                    
                    // 1. Activar la capa vinculada si existe
                    if (folder.linkedLayerId) {
                      setCustomLayers(layers => layers.map(l => l.id === folder.linkedLayerId ? { ...l, visible: true } : l));
                    }

                    // 2. Centrar el mapa
                    // Prioridad A: Capa vinculada
                    const linkedLayer = customLayers.find(l => l.id === folder.linkedLayerId);
                    if (linkedLayer && linkedLayer.center) {
                      setCenterTo({ lat: linkedLayer.center.lat, lon: linkedLayer.center.lon, timestamp: Date.now() });
                    } 
                    // Prioridad B: Puntos o geometrías del proyecto
                    else {
                      const folderPoints = points.filter(p => p.folderId === folder.id);
                      const folderGeoms = geometries.filter(g => g.folderId === folder.id);
                      
                      if (folderPoints.length > 0) {
                        setCenterTo({ lat: folderPoints[0].lat, lon: folderPoints[0].lon, timestamp: Date.now() });
                      } else if (folderGeoms.length > 0 && folderGeoms[0].coordinates?.length > 0) {
                        setCenterTo({ lat: folderGeoms[0].coordinates[0].lat, lon: folderGeoms[0].coordinates[0].lon, timestamp: Date.now() });
                      }
                    }
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <Folder size={24} color="var(--primary)" />
                    <div>
                      <p style={{ fontWeight: 700 }}>{folder.name}</p>
                      {folder.linkedLayerId && (
                        <p style={{ fontSize: '0.75rem', opacity: 0.6 }}>
                          Vínculo: {customLayers.find(l => l.id === folder.linkedLayerId)?.name || 'Mapa'}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div style={{ borderTop: '1px solid var(--surface-highest)', paddingTop: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {!isInstalled && deferredPrompt && (
                <button 
                  className="btn" 
                  style={{ 
                    width: '100%', 
                    padding: '1rem', 
                    borderRadius: '1rem', 
                    background: installStatus === 'installing' ? 'var(--surface-highest)' : 'var(--primary-dark)',
                    color: 'white',
                    fontWeight: 700,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.5rem',
                    boxShadow: '0 4px 12px rgba(37, 99, 235, 0.3)'
                  }}
                  onClick={handleInstallClick}
                  disabled={installStatus === 'installing'}
                >
                  <Download size={20} />
                  {installStatus === 'installing' ? 'Instalando...' : 'Instalar en mi Móvil'}
                </button>
              )}

              {!isInstalled && !deferredPrompt && isIOS && (
                <div style={{ 
                  padding: '1rem', 
                  background: 'var(--surface-low)', 
                  borderRadius: '1rem',
                  fontSize: '0.8rem',
                  border: '1px solid var(--primary-light)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.5rem'
                }}>
                  <p style={{ fontWeight: 700, color: 'var(--primary-dark)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Download size={16} /> Instalar en iPhone/iPad
                  </p>
                  <p>1. Toca el botón <b>Compartir</b> (cuadrado con flecha ↑)</p>
                  <p>2. Selecciona <b>"Añadir a la pantalla de inicio"</b></p>
                </div>
              )}

              {!isInstalled && !deferredPrompt && !isIOS && (
                <div style={{ 
                  padding: '1rem', 
                  background: 'var(--surface-low)', 
                  borderRadius: '1rem',
                  fontSize: '0.8rem',
                  border: '1px solid var(--primary-light)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.5rem'
                }}>
                  <p style={{ fontWeight: 700, color: 'var(--primary-dark)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Download size={16} /> ¿Cómo instalar?
                  </p>
                  <p>1. Toca los <b>tres puntos (⋮)</b> de Chrome</p>
                  <p>2. Selecciona <b>"Instalar aplicación"</b></p>
                </div>
              )}
              
              {installStatus === 'installed' && (
                <div style={{ 
                  padding: '0.75rem', 
                  background: 'rgba(34, 197, 94, 0.1)', 
                  color: 'var(--primary-dark)', 
                  borderRadius: '0.75rem',
                  fontSize: '0.85rem',
                  textAlign: 'center',
                  fontWeight: 600
                }}>
                  ✅ ¡Instalación completada! Abre Mapping Terere desde tu menú.
                </div>
              )}

              <button 
                className="btn btn-primary" 
                style={{ width: '100%', padding: '1rem', borderRadius: '1rem' }}
                onClick={() => setShowNewFolderModal(true)}
              >
                <Plus size={20} />
                Nuevo Proyecto
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Nuevo Proyecto */}
      {showNewFolderModal && (
        <div className="modal-overlay" style={{ zIndex: 2000 }}>
          <div className="modal-content" style={{ maxWidth: '400px' }}>
            <div className="editor-header" style={{ marginBottom: '1.5rem' }}>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 700 }}>Crear Nuevo Proyecto</h2>
              <button className="icon-button" onClick={() => setShowNewFolderModal(false)}>
                <X size={20} />
              </button>
            </div>
            
            <div className="form-group" style={{ marginBottom: '1.5rem' }}>
              <label>Nombre del Proyecto</label>
              <input 
                type="text" 
                value={newFolderName} 
                onChange={(e) => setNewFolderName(e.target.value)} 
                placeholder="Ej: Relevamiento Chaco"
                autoFocus
              />
            </div>

            <div className="form-group" style={{ marginBottom: '1.5rem' }}>
              <label>Vincular a Mapa Base (Opcional)</label>
              <select 
                value={newFolderLinkedMapId} 
                onChange={(e) => setNewFolderLinkedMapId(e.target.value === 'none' ? 'none' : Number(e.target.value))}
                className="select-input"
                style={{ width: '100%', padding: '0.75rem', borderRadius: '0.5rem', border: '1px solid var(--border-color)', background: 'var(--surface)', color: 'var(--text-primary)' }}
              >
                <option value="none">Ninguno (Visible siempre)</option>
                {customLayers.map(l => (
                  <option key={l.id} value={l.id}>{l.name} ({l.type === 'tiff' ? 'GeoTIFF' : 'XYZ'})</option>
                ))}
              </select>
              <p style={{ fontSize: '0.7rem', marginTop: '0.5rem', opacity: 0.7 }}>
                El proyecto se activará automáticamente al cargar este mapa.
              </p>
            </div>

            <div style={{ display: 'flex', gap: '1rem' }}>
              <button 
                className="btn btn-secondary" 
                style={{ flex: 1 }}
                onClick={() => setShowNewFolderModal(false)}
              >
                Cancelar
              </button>
              <button 
                className="btn btn-primary" 
                style={{ flex: 2 }}
                onClick={handleCreateFolder}
                disabled={!newFolderName}
              >
                Crear Proyecto
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
