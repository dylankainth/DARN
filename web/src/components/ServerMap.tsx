import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

export interface Server {
  ip: string;
  ok: boolean;
  models: string;
  latency_ms: number;
  error?: string;
  checked_at: string;
  lat?: number;
  lon?: number;
}

// Create a new icon instance with correct URLs
const defaultIcon = new L.Icon.Default({
  iconRetinaUrl:
    'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.3/images/marker-icon-2x.png',
  iconUrl:
    'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.3/images/marker-icon.png',
  shadowUrl:
    'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.3/images/marker-shadow.png',
});

// Then set globally for all markers
L.Marker.prototype.options.icon = defaultIcon;
interface Props {
  servers: Server[];
}

export const ServerMap: React.FC<Props> = ({ servers }) => {
  return (
    <MapContainer center={[20, 0]} zoom={2} style={{ height: '80vh', width: '100%' }}>
      <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
      {servers.map(
        (s, idx) =>
          s.lat &&
          s.lon && (
            <Marker key={idx} position={[s.lat, s.lon]}>
              <Popup>
                <strong>IP:</strong> {s.ip} <br />
                <strong>Models:</strong> {s.models} <br />
                <strong>Latency:</strong> {s.latency_ms} ms <br />
                <strong>Status:</strong> {s.ok ? 'OK' : 'Error'}
              </Popup>
            </Marker>
          )
      )}
    </MapContainer>
  );
};
