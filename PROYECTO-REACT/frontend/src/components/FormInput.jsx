export default function FormInput({ label, value, onChange, type = 'text' }) {
  const id = label.toLowerCase().replaceAll(' ', '-')

  return (
    <div className="form-element">
      <label className="element-label" htmlFor={id}>{label}</label>
      <input
        id={id}
        className="input-field"
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        required={label !== 'Telefono'}
      />
    </div>
  )
}
