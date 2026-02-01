import { useEffect, useState } from 'react';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend);

interface ProbePoint {
  ip: string;
  latency_ms: number | null;
  timestamp: string; // ISO timestamp string from database
}

const LatencyChart = () => {
  const [chartData, setChartData] = useState<any>(null);

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const resp = await fetch('http://localhost:8000/probes');
        const data = await resp.json();

        const items: ProbePoint[] = data.items;

        // Debug: see raw data
        console.log('Probes raw data:', items);

        if (!items || items.length === 0) {
          console.log('No probe data available yet');
          setChartData(null);
          return;
        }

        // Group by IP
        const byIP = new Map<string, Array<{ timestamp: Date; latency: number }>>();
        items.forEach(item => {
          if (item.latency_ms !== null && item.timestamp) {
            const ts = new Date(item.timestamp);
            if (!byIP.has(item.ip)) byIP.set(item.ip, []);
            byIP.get(item.ip)!.push({ timestamp: ts, latency: item.latency_ms });
          }
        });

        // Collect all unique timestamps and sort
        const allTimestamps = Array.from(
          new Set(items.map(i => new Date(i.timestamp).getTime()))
        )
          .sort((a, b) => a - b)
          .map(ts => new Date(ts));

        // Build datasets
        const datasets = Array.from(byIP.entries())
          .map(([ip, points], index) => {
            const data = allTimestamps.map(ts => {
              const p = points.find(pt => pt.timestamp.getTime() === ts.getTime());
              return p ? p.latency : null;
            });
            // Skip IPs with no valid points
            if (data.every(d => d === null)) return null;

            return {
              label: ip,
              data,
              borderColor: `hsl(${index * 60}, 70%, 60%)`,
              backgroundColor: `hsla(${index * 60}, 70%, 60%, 0.1)`,
              spanGaps: true,
              tension: 0.4,
            };
          })
          .filter(Boolean);

        // Format timestamps for labels
        const labels = allTimestamps.map(ts => ts.toLocaleTimeString());

        setChartData({ labels, datasets });
      } catch (err) {
        console.error('Failed to fetch probe history:', err);
      }
    };

    fetchHistory();
    
    // Auto-refresh chart every 30 seconds
    const interval = setInterval(() => {
      fetchHistory();
    }, 30000);
    
    return () => clearInterval(interval);
  }, []);

  if (!chartData) return <div className="text-sm text-zinc-300">No probe data yet. Click "Run Probes" to collect latency data.</div>;

  return (
    <Line
      data={chartData}
      options={{
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'top', labels: { color: '#e4e4e7' } },
          title: { display: true, text: 'Latency Over Time', color: '#e4e4e7' },
        },
        scales: {
          y: { beginAtZero: true, title: { display: true, text: 'Latency (ms)', color: '#e4e4e7' }, ticks: { color: '#a1a1aa' }, grid: { color: '#27272a' } },
          x: { ticks: { color: '#a1a1aa' }, grid: { color: '#27272a' } },
        },
      }}
    />
  );
};

export default LatencyChart;