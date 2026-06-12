export default function Metric({ value, label }) {
  return (
    <div>
      <span className="summary-value">{value}</span>
      <span className="summary-label">{label}</span>
    </div>
  )
}
