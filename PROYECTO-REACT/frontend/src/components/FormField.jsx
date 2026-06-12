export default function FormField({ label, ...props }) {
  const id = label.toLowerCase().replaceAll(' ', '-')

  return (
    <div className="form-element">
      <label className="element-label" htmlFor={id}>{label}</label>
      <input id={id} className="input-field" required {...props} />
    </div>
  )
}
