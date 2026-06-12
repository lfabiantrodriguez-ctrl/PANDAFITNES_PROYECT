export default function ViewTitle({ title, text }) {
  return (
    <div className="view-title-block">
      <h1>{title}</h1>
      <p>{text}</p>
    </div>
  )
}
