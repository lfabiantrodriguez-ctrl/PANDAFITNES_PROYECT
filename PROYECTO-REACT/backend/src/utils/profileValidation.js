function validateProfile(input, today = new Intl.DateTimeFormat('en-CA', {timeZone:'America/Lima'}).format(new Date())) {
    const errors = {};
    const text = key => typeof input?.[key] === 'string' ? input[key].normalize('NFC').trim() : '';
    const data = Object.fromEntries(['nombre','apellido','dni','email','telefono','fecha_nacimiento','direccion','contacto_emergencia','telefono_emergencia','avatar_url'].map(key=>[key,text(key)]));
    data.nombre=data.nombre.replace(/\s+/g,' ');
    data.apellido=data.apellido.replace(/\s+/g,' ');
    data.email=data.email.toLowerCase();
    const name = /^[\p{L}][\p{L}\p{M}]*(?:[ '\u2019-][\p{L}][\p{L}\p{M}]*)*$/u;
    for (const [key,label] of [['nombre','El nombre'],['apellido','Los apellidos']]) {
        if (!data[key]) errors[key]=`${label} ${key==='nombre'?'es obligatorio':'son obligatorios'}.`;
        else if (data[key].length>100 || !name.test(data[key])) errors[key]=`${label} ${key==='nombre'?'debe':'deben'} contener letras y espacios, hasta 100 caracteres.`;
    }
    if (!data.dni) errors.dni='El DNI es obligatorio.';
    else if (!/^\d{8}$/.test(data.dni)) errors.dni='El DNI debe tener exactamente 8 dígitos.';
    if (!data.email) errors.email='El correo electrónico es obligatorio.';
    else {
        const parts=data.email.split('@'),local=parts[0],domain=parts[1]||'',labels=domain.split('.');
        if (parts.length!==2 || data.email.length>150 || local.length>64 || !/^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+$/i.test(local)
            || local.startsWith('.') || local.endsWith('.') || local.includes('..') || labels.length<2
            || labels.some(label=>!/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i.test(label)) || !/^[a-z]{2,63}$/i.test(labels.at(-1)))
            errors.email='Ingresa un correo válido, de hasta 150 caracteres.';
    }
    if (!data.telefono) errors.telefono='El teléfono es obligatorio.';
    else if (!/^9\d{8}$/.test(data.telefono)) errors.telefono='Ingresa un celular de 9 dígitos que empiece con 9.';
    if (!data.fecha_nacimiento) errors.fecha_nacimiento='La fecha de nacimiento es obligatoria.';
    else {
        const date=data.fecha_nacimiento,match=/^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
        const parsed=match?new Date(Date.UTC(Number(match[1]),Number(match[2])-1,Number(match[3]))):null;
        if (!match || !Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0,10)!==date || date<'1900-01-01')
            errors.fecha_nacimiento='Ingresa una fecha válida a partir del 01/01/1900.';
        else if (date>today) errors.fecha_nacimiento='La fecha de nacimiento no puede ser futura.';
    }
    if (data.direccion.length>255 || /[\u0000-\u001f<>]/.test(data.direccion)) errors.direccion='Ingresa una dirección válida de hasta 255 caracteres.';
    if (data.contacto_emergencia && (data.contacto_emergencia.length>100 || !/\p{L}/u.test(data.contacto_emergencia) || !/^[\p{L}\p{M} '\u2019.\-]+$/u.test(data.contacto_emergencia)))
        errors.contacto_emergencia='Ingresa el nombre del contacto, sin números y hasta 100 caracteres.';
    if (data.telefono_emergencia && !/^9\d{8}$/.test(data.telefono_emergencia)) errors.telefono_emergencia='Ingresa un celular de emergencia de 9 dígitos que empiece con 9.';
    if (data.contacto_emergencia && !data.telefono_emergencia) errors.telefono_emergencia='Completa el teléfono de tu contacto de emergencia.';
    if (data.telefono_emergencia && !data.contacto_emergencia) errors.contacto_emergencia='Completa el nombre de tu contacto de emergencia.';
    const avatar=data.avatar_url;
    if (avatar && (avatar.length>7*1024*1024 || !(/^(?:https?:\/\/[^\s]+|\/(?!\/)[^\s]*)$/i.test(avatar)
        || /^data:image\/(?:png|jpe?g|webp|gif|avif);base64,[a-z0-9+/]+={0,2}$/i.test(avatar))))
        errors.avatar_url='Selecciona una imagen PNG, JPG, WEBP, GIF o AVIF de hasta 5 MB.';
    const preferences=input?.preferencias;
    if (preferences!==undefined && preferences!==null && (typeof preferences!=='object'||Array.isArray(preferences)
        || ['avisosMembresia','novedadesPandita','promocionesCorreo'].some(key=>preferences[key]!==undefined&&typeof preferences[key]!=='boolean')))
        errors.preferencias='Revisa las preferencias de tu cuenta.';
    data.preferencias=preferences||null;
    return {data,errors};
}
module.exports = { validateProfile };
