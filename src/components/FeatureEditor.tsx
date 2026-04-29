import React, { useState } from 'react';
import { GeoService } from '../services/GeoService';
import { X, Save, Trash2, Camera, Image } from 'lucide-react';
import { ICONS } from '../utils/iconMap';

interface FeatureEditorProps {
  feature: any;
  onSave: (feature: any) => void;
  onClose: () => void;
  onDelete?: (id: number) => void;
}


const getPosition = (): Promise<{lat: number, lon: number} | null> => {
  return new Promise((resolve) => {
    if (!navigator.geolocation) return resolve(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lon: pos.coords.longitude }),
      () => resolve(null),
      { enableHighAccuracy: true, timeout: 5000 }
    );
  });
};

const FeatureEditor: React.FC<FeatureEditorProps> = ({ feature, onSave, onClose, onDelete }) => {
  const [name, setName] = useState(feature.name || '');
  const [description, setDescription] = useState(feature.description || '');
  const [icon, setIcon] = useState(feature.icon || 'default');
  const [attributes, setAttributes] = useState(feature.attributes || []);
  const [photos, setPhotos] = useState<any[]>(() => {
    return (feature.photos || []).map((p: any) => typeof p === 'string' ? { dataUrl: p } : p);
  });

  const cameraInputRef = React.useRef<HTMLInputElement>(null);
  const galleryInputRef = React.useRef<HTMLInputElement>(null);

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Intentar obtener la ubicación mientras se procesa la imagen
      const posPromise = getPosition();

      const reader = new FileReader();
      reader.onloadend = async () => {
        const pos = await posPromise;
        setPhotos(prev => [...prev, {
          dataUrl: reader.result as string,
          lat: pos?.lat,
          lon: pos?.lon,
          timestamp: Date.now()
        }]);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRemovePhoto = (index: number) => {
    setPhotos(photos.filter((_, i) => i !== index));
  };

  const handleAddAttribute = () => {
    setAttributes([...attributes, { key: '', value: '' }]);
  };

  const handleUpdateAttribute = (index: number, field: 'key' | 'value', value: string) => {
    const newAttrs = [...attributes];
    newAttrs[index][field] = value;
    setAttributes(newAttrs);
  };

  const handleRemoveAttribute = (index: number) => {
    setAttributes(attributes.filter((_: any, i: number) => i !== index));
  };

  const handleSave = () => {
    onSave({
      ...feature,
      name,
      description,
      icon,
      attributes,
      photos
    });
  };

  const getTitle = () => {
    if (feature.type === 'line') return 'Editar Línea';
    if (feature.type === 'polygon') return 'Editar Polígono';
    return 'Editar Punto';
  };

  const getMeasurement = () => {
    if (feature.type === 'line') return GeoService.calculateDistance(feature.coordinates);
    if (feature.type === 'polygon') return GeoService.calculateArea(feature.coordinates);
    return null;
  };
  const measurement = getMeasurement();

  return (
    <div className="point-editor-overlay">
      <div className="point-editor-container">
        <div className="editor-header">
          <h2>{getTitle()}</h2>
          <button className="icon-button" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <div className="editor-body">
          <div className="form-group">
            <label>Nombre</label>
            <input 
              type="text" 
              value={name} 
              onChange={(e) => setName(e.target.value)} 
              placeholder="Ej: Mirador del Sol"
            />
          </div>

          <div className="form-group">
            <label>Descripción</label>
            <textarea 
              value={description} 
              onChange={(e) => setDescription(e.target.value)} 
              placeholder="Añade detalles sobre este lugar..."
              rows={3}
            />
          </div>

          {feature.type === 'point' && (
            <div className="form-group">
              <label>Icono</label>
              <div className="icon-grid">
                {ICONS.map(({ id, icon: IconComponent }) => (
                  <button 
                    key={id}
                    className={`icon-selector ${icon === id ? 'selected' : ''}`}
                    onClick={() => setIcon(id)}
                  >
                    <IconComponent size={20} />
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="form-group">
            <label>Fotos ({photos.length})</label>
            <div className="photo-grid">
              {photos.map((photo: any, index: number) => (
                <div key={index} className="photo-item" style={{ position: 'relative' }}>
                  <img src={typeof photo === 'string' ? photo : photo.dataUrl} alt={`Captura ${index}`} />
                  {photo.lat && photo.lon && (
                    <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: 'rgba(0,0,0,0.6)', color: 'white', fontSize: '0.65rem', padding: '4px', textAlign: 'center' }}>
                      {photo.lat.toFixed(5)}, {photo.lon.toFixed(5)}
                    </div>
                  )}
                  <button className="remove-photo" onClick={() => handleRemovePhoto(index)}>
                    <X size={12} />
                  </button>
                </div>
              ))}
              
              <button 
                className="add-photo-button" 
                onClick={() => cameraInputRef.current?.click()}
              >
                <Camera size={24} />
                <span>Cámara</span>
              </button>
              
              <button 
                className="add-photo-button" 
                onClick={() => galleryInputRef.current?.click()}
                style={{ background: 'var(--bg-secondary)', color: 'var(--text-primary)', border: '1px solid var(--border-color)' }}
              >
                <Image size={24} />
                <span>Galería</span>
              </button>
            </div>
            
            <input 
              type="file" 
              ref={cameraInputRef} 
              style={{ display: 'none' }} 
              accept="image/*" 
              capture="environment"
              onChange={handlePhotoUpload} 
            />
            <input 
              type="file" 
              ref={galleryInputRef} 
              style={{ display: 'none' }} 
              accept="image/*" 
              onChange={handlePhotoUpload} 
            />
          </div>

          <div className="form-group">
            <div className="label-with-action">
              <label>Atributos Extra</label>
              <button className="text-button" onClick={handleAddAttribute}>+ Añadir</button>
            </div>
            {attributes.map((attr: any, index: number) => (
              <div key={index} className="attribute-row">
                <input 
                  type="text" 
                  placeholder="Clave" 
                  value={attr.key} 
                  onChange={(e) => handleUpdateAttribute(index, 'key', e.target.value)}
                />
                <input 
                  type="text" 
                  placeholder="Valor" 
                  value={attr.value} 
                  onChange={(e) => handleUpdateAttribute(index, 'value', e.target.value)}
                />
                <button className="delete-attr" onClick={() => handleRemoveAttribute(index)}>
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>

          <div className="coords-display">
            {measurement && (
              <div style={{ background: 'var(--surface)', padding: '0.75rem', borderRadius: '0.5rem', marginBottom: '0.75rem', border: '1px solid var(--primary-light)' }}>
                <label style={{ margin: 0, color: 'var(--primary-dark)', display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 600 }}>
                  {feature.type === 'polygon' ? 'Área Total' : 'Distancia Total'}
                </label>
                <div style={{ fontSize: '1.25rem', fontWeight: 700, marginTop: '0.25rem', color: 'var(--text)' }}>
                  {measurement}
                </div>
              </div>
            )}
            {feature.type === 'point' ? (
              (() => {
                const utm = GeoService.toUTM(feature.lat, feature.lon);
                return utm ? (
                  <>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span>E: {utm.easting.toLocaleString()} m</span>
                      <span>N: {utm.northing.toLocaleString()} m</span>
                    </div>
                    <span className="coord-label">UTM Zona {utm.zone}</span>
                    <div style={{ fontSize: '0.7rem', opacity: 0.6, marginTop: '0.25rem' }}>
                      WGS84: {feature.lat.toFixed(6)}, {feature.lon.toFixed(6)}
                    </div>
                  </>
                ) : (
                  <span>Coordenadas no disponibles</span>
                );
              })()
            ) : (
              <span>{feature.coordinates.length} vértices capturados</span>
            )}
          </div>
        </div>

        <div className="editor-footer">
          {onDelete && (
            <button className="button button-danger" onClick={() => onDelete(feature.id)}>
              <Trash2 size={18} />
              <span>Eliminar</span>
            </button>
          )}
          <button className="button button-primary" onClick={handleSave}>
            <Save size={18} />
            <span>Guardar Cambios</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default FeatureEditor;
