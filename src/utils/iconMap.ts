import { 
  MapPin, Coffee, Tent, TreeDeciduous, Mountain, Car, Bus, Fuel, ShoppingCart, 
  Utensils, Pizza, Beer, Home, Building, Hospital, GraduationCap, 
  Camera, Landmark, Info, AlertTriangle, 
  Wifi, Phone, Trash, Droplets, Wind, Sun,
  Flag, Anchor, Bike, Ship, Train, Plane,
  Hammer, Wrench, Shield, Key
} from 'lucide-react';

export const ICONS = [
  { id: 'default', icon: MapPin, label: 'Punto' },
  { id: 'tent', icon: Tent, label: 'Camping' },
  { id: 'tree', icon: TreeDeciduous, label: 'Bosque' },
  { id: 'mountain', icon: Mountain, label: 'Cerro' },
  { id: 'coffee', icon: Coffee, label: 'Café' },
  { id: 'utensils', icon: Utensils, label: 'Restaurante' },
  { id: 'pizza', icon: Pizza, label: 'Pizzería' },
  { id: 'beer', icon: Beer, label: 'Bar' },
  { id: 'shopping', icon: ShoppingCart, label: 'Tienda' },
  { id: 'car', icon: Car, label: 'Auto' },
  { id: 'bus', icon: Bus, label: 'Bus' },
  { id: 'fuel', icon: Fuel, label: 'Gasolina' },
  { id: 'bike', icon: Bike, label: 'Bici' },
  { id: 'home', icon: Home, label: 'Casa' },
  { id: 'building', icon: Building, label: 'Edificio' },
  { id: 'hospital', icon: Hospital, label: 'Hospital' },
  { id: 'school', icon: GraduationCap, label: 'Escuela' },
  { id: 'camera', icon: Camera, label: 'Foto' },
  { id: 'landmark', icon: Landmark, label: 'Monumento' },
  { id: 'info', icon: Info, label: 'Información' },
  { id: 'alert', icon: AlertTriangle, label: 'Alerta' },
  { id: 'wifi', icon: Wifi, label: 'WiFi' },
  { id: 'phone', icon: Phone, label: 'Teléfono' },
  { id: 'trash', icon: Trash, label: 'Basura' },
  { id: 'water', icon: Droplets, label: 'Agua' },
  { id: 'wind', icon: Wind, label: 'Viento' },
  { id: 'sun', icon: Sun, label: 'Sol' },
  { id: 'flag', icon: Flag, label: 'Bandera' },
  { id: 'anchor', icon: Anchor, label: 'Puerto' },
  { id: 'ship', icon: Ship, label: 'Barco' },
  { id: 'train', icon: Train, label: 'Tren' },
  { id: 'plane', icon: Plane, label: 'Avión' },
  { id: 'hammer', icon: Hammer, label: 'Herramienta' },
  { id: 'wrench', icon: Wrench, label: 'Reparación' },
  { id: 'shield', icon: Shield, label: 'Seguridad' },
  { id: 'key', icon: Key, label: 'Llave' },
];

export const getIconComponent = (id: string) => {
  const iconObj = ICONS.find(i => i.id === id);
  return iconObj ? iconObj.icon : MapPin;
};
