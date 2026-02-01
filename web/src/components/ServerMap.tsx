import { useEffect } from 'react'
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet'
import L from 'leaflet'
import pinUrl from '../assets/pin.svg'
import 'leaflet/dist/leaflet.css'

type Item = {
  ip: string
  ok: boolean
  error?: string
  lat: number
  lon: number
}

function FitBounds({ items }: { items: Item[] }) {
  const map = useMap()

  useEffect(() => {
    if (!items.length) return

    const bounds = L.latLngBounds(
      items.map((i) => [i.lat, i.lon])
    )

    map.fitBounds(bounds, {
      padding: [60, 60],
      maxZoom: 6,
    })
  }, [items, map])

  return null
}

export default function ServerMap({ items }: { items: Item[] }) {
  const icon = L.icon({
    iconUrl: pinUrl,
    iconSize: [30, 40],
    iconAnchor: [15, 40],
    popupAnchor: [0, -34],
    className: 'pin-icon',
  })
  return (
    <MapContainer
      className="map-container"
      center={[0, 0]}        // temporary, overridden by fitBounds
      zoom={2}
      minZoom={2}
      maxBounds={[[-90, -180], [90, 180]]}
      maxBoundsViscosity={1}
      style={{ height: '100%', width: '100%' }}
    >
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        subdomains={["a", "b", "c"]}
        className="bw-tiles"
        attribution="© OpenStreetMap contributors"
      />

      <FitBounds items={items} />

      {items.map((item, idx) => (
        <Marker key={idx} position={[item.lat, item.lon]} icon={icon}>
          <Popup>
            <strong>IP:</strong> {item.ip} <br />
            <strong>Status:</strong> {item.ok ? 'OK' : 'Fail'} <br />
            {item.error && (
              <>
                <strong>Error:</strong> {item.error}
              </>
            )}
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  )
}
