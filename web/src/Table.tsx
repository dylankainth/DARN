import './Table.css'

interface VerificationTableProps {
  data: any;
}

const VerificationTable = ({ data }: VerificationTableProps) => {
  return (
    <table className="verification-table">
      <thead>
        <tr>
          <th>IP</th>
          <th>Status</th>
          <th>Models</th>
          <th>Latency (ms)</th>
          <th>Error</th>
          <th>Checked At</th>
        </tr>
      </thead>
      <tbody>
        {data.items.map((row: any, index: number) => (
          <tr key={index}>
            <td>{row.ip}</td>
            <td>{row.ok ? '✓' : '✗'}</td>
            <td>{row.models.join(', ')}</td>
            <td>{row.latency_ms || '-'}</td>
            <td>{row.error || '-'}</td>
            <td>{row.checked_at}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
};

export default VerificationTable;