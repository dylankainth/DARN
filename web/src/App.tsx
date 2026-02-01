import { useEffect, useState } from 'react'
import './App.css'
import Navbar from'./Navbar'
import VerificationTable from './Table'

const API_BASE = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? 'http://localhost:8000'
const API_VERIFICATIONS = `${API_BASE.replace(/\/+$/, '')}/verifications`


interface VerificationData {
  count: number;
  items: Array<{
    ip: string;
    ok: boolean;
    models: string[];
    latency_ms: number | null;
    error: string | null;
    checked_at: string;
  }>;
}

function App() {
  const [data, setData] = useState<VerificationData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchData = async () => {
      try {
        const resp = await fetch(API_VERIFICATIONS)
        if (!resp.ok) {
          throw new Error(`Request failed with status ${resp.status}`)
        }
        const json = await resp.json()
        setData(json)
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error'
        setError(message)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [])

  return (
    <main className="app">
      <Navbar></Navbar>
      <h1>DARN Viewer</h1>
      <p>Fetching from {API_VERIFICATIONS}</p>
      {loading && <p>Loading...</p>}
      {error && <p className="error">Error: {error}</p>}
      {!loading && !error && data && data.items && (
      <VerificationTable data={data} />
      )}
    </main>
  )
}

export default App
