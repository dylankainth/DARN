import './Table.css'

interface VerificationTableProps {
  data: any;
}

const VerificationTable = ({ data }: VerificationTableProps) => {
  return (
    <div className="table-wrapper">
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
            <td title={row.ip}>{row.ip}</td>
            <td>{row.ok ? '✓' : '✗'}</td>
            <td title={row.models.join(', ')}>{row.models.join(', ')}</td>
            <td>{row.latency_ms || '-'}</td>
            <td title={row.error || ''}>{row.error || '-'}</td>
            <td title={row.checked_at}>{row.checked_at}</td>
          </tr>
        ))}
      </tbody>
    </table>
    </div>
  );
};

export default VerificationTable;