export default function ViewTitle({ text, subtitle }) {
  const description = text || subtitle
  if (!description) return null
  return (
    <div className="view-title-block">
      <p>{description}</p>
    </div>
  )
}
