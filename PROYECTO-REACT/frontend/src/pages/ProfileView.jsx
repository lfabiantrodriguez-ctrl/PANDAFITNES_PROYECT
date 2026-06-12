import ViewTitle from '../components/ViewTitle'

export default function ProfileView({ user }) {
  const fields = [
    ['Nombre', `${user.nombre} ${user.apellido}`],
    ['DNI', user.dni],
    ['Correo', user.email],
    ['Telefono', user.telefono || 'No registrado'],
    ['Rol', user.rol === 'admin' ? 'Administrador / Recepcionista' : 'Socio / Cliente'],
  ]

  return (
    <>
      <ViewTitle
        title="Perfil de Usuario"
        text="Informacion principal de la cuenta autenticada en Panda Fitness."
      />
      <section className="profile-card">
        {fields.map(([label, value]) => (
          <div className="profile-row" key={label}>
            <span>{label}</span>
            <strong>{value}</strong>
          </div>
        ))}
      </section>
    </>
  )
}
