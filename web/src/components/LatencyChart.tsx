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
  timestamp: string; 
}

const LatencyChart = () => {
  const [chartData, setChartData] = useState<any>(null);
  const [maxIPs, setMaxIPs] = useState<number>(10);

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const resp = await fetch('http://localhost:8000/probes?limit=200');
        const data = await resp.json();

        const items: ProbePoint[] = data.items;

        // debug
        console.log('Probes raw data:', items);

        if (!items || items.length === 0) {
          console.log('No probe data available yet');
          setChartData(null);
          return;
        }

        const byIP = new Map<string, Array<{ timestamp: Date; latency: number }>>();
        items.forEach(item => {
          if (item.latency_ms !== null && item.timestamp) {
            const ts = new Date(item.timestamp);
            if (!byIP.has(item.ip)) byIP.set(item.ip, []);
            byIP.get(item.ip)!.push({ timestamp: ts, latency: item.latency_ms });
          }
        });


        const ipsByRecency = Array.from(byIP.entries())
          .map(([ip, points]) => ({
            ip,
            points,
            lastSeen: Math.max(...points.map(p => p.timestamp.getTime()))
          }))
          .sort((a, b) => b.lastSeen - a.lastSeen)
          .slice(0, maxIPs)
          .reduce((map, item) => {
            map.set(item.ip, item.points);
            return map;
          }, new Map<string, Array<{ timestamp: Date; latency: number }>>());


        const allTimestamps = Array.from(
          new Set(items.map(i => new Date(i.timestamp).getTime()))
        )
          .sort((a, b) => a - b)
          .map(ts => new Date(ts));


        const datasets = Array.from(ipsByRecency.entries())
          .map(([ip, points], index) => {
            const data = allTimestamps.map(ts => {
              const p = points.find(pt => pt.timestamp.getTime() === ts.getTime());
              return p ? p.latency : null;
            });

            if (data.every(d => d === null)) return null;

            return {
              label: ip,
              data,
              borderColor: `hsl(${index * 36}, 70%, 60%)`,
              backgroundColor: `hsla(${index * 36}, 70%, 60%, 0.1)`,
              spanGaps: true,
              tension: 0.4,
            };
          })
          .filter(Boolean);

        const labels = allTimestamps.map(ts => ts.toLocaleTimeString());

        setChartData({ labels, datasets });
      } catch (err) {
        console.error('Failed to fetch probe history:', err);
      }
    };

    fetchHistory();
    
    // Auto refresh
    const interval = setInterval(() => {
      fetchHistory();
    }, 30000);
    
    return () => clearInterval(interval);
  }, [maxIPs]);

  if (!chartData) return <div className="text-sm text-zinc-300">No probe data yet. Click "Run Probes" to collect latency data.</div>;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs text-zinc-400">Showing top {maxIPs} most recent IPs • All data points</span>
        <select
          value={maxIPs}
          onChange={(e) => setMaxIPs(Number(e.target.value))}
          className="rounded-lg border border-[#3a3d44] bg-[#1b1d23] px-3 py-1 text-sm text-zinc-100 transition hover:border-zinc-400 focus:border-zinc-400 focus:outline-none"
        >
          <option value={5}>Top 5 IPs</option>
          <option value={10}>Top 10 IPs</option>
          <option value={15}>Top 15 IPs</option>
          <option value={20}>Top 20 IPs</option>
        </select>
      </div>
      <div className="h-[320px]">
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
      </div>
    </div>
  );
};

export default LatencyChart;