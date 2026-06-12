export default function InfoCard({ label, title, text }) {
  return (
    <article className="info-card">
      <p className="stat-label">{label}</p>
      <h3>{title}</h3>
      <p>{text}</p>
    </article>
  )
}
