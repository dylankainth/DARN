import { useEffect, useState } from 'react'
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import './App.css'

const API_BASE = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? 'http://localhost:8000'
const API_VERIFICATIONS = `${API_BASE.replace(/\/+$/, '')}/verifications`

function App() {
  const [data, setData] = useState<any[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
  const fetchData = async () => {
    try {
      const resp = await fetch(API_VERIFICATIONS)
      if (!resp.ok) throw new Error(`Request failed with status ${resp.status}`)
      const json = await resp.json()

      // For each IP, fetch lat/lon
      const itemsWithCoords = await Promise.all(json.items.map(async (item: any) => {
        try {
          const geoResp = await fetch(`http://ip-api.com/json/${item.ip}`)
          const geoData = await geoResp.json()
          return {
            ...item,
            lat: geoData.lat,
            lon: geoData.lon
          }
        } catch {
          return { ...item, lat: null, lon: null }
        }
      }))

      setData(itemsWithCoords)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }
  fetchData()
}, [])


  // Default map center
  const defaultPosition: [number, number] = [20, 0]

  return (
    <main className="app">
      <h1>DARN Viewer</h1>
      {loading && <p>Loading...</p>}
      {error && <p className="error">Error: {error}</p>}
      {!loading && !error && (
        <MapContainer 
          className="map-container" 
          center={defaultPosition} 
          zoom={3} 
          minZoom={2}               // Prevents zooming out into the void
          maxBounds={[[-90, -180], [90, 180]]} // Keeps the user within the world map
          maxBoundsViscosity={1.0}  // Makes the map bounce back if they try to drag past the edge
          style={{ height: '100%', width: '100%' }} // Ensure it uses the CSS flex space
        >
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution="&copy; OpenStreetMap contributors"
            noWrap={false}
          />
          {data.map((item, idx) => 
            item.lat && item.lon && (
              <Marker key={idx} position={[item.lat, item.lon]}>
                <Popup>
                  <strong>IP:</strong> {item.ip} <br/>
                  <strong>Status:</strong> {item.ok ? 'OK' : 'Fail'} <br/>
                  {item.error && <span><strong>Error:</strong> {item.error}</span>}
                </Popup>
              </Marker>
            )
          )}
        </MapContainer>
      )}
    </main>
  )
}

export default App
