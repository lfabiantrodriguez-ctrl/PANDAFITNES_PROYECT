const encode = value => btoa(String.fromCharCode(...new Uint8Array(value))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const decode = value => Uint8Array.from(atob(value.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0));
async function request(token, path, body) {
  const response = await fetch(`/api/admin/dispositivos/${path}`, {
    method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.message || 'No se pudo verificar el dispositivo.');
  return result;
}
function serialize(credential) {
  return { id: credential.id, type: credential.type, response: {
    clientDataJSON: encode(credential.response.clientDataJSON),
    authenticatorData: encode(credential.response.authenticatorData),
    signature: encode(credential.response.signature),
  } };
}
async function assert(options) {
  const getOptions = {
    challenge: decode(options.challenge),
    rpId: options.rpID,
    timeout: 60000,
    userVerification: 'required',
  };

  const credIds = (options.credentialIds || (options.credentialId ? [options.credentialId] : []))
    .filter(Boolean);

  if (credIds.length > 0) {
    getOptions.allowCredentials = credIds.map(id => ({
      id: decode(id),
      type: 'public-key',
    }));
  }

  const credential = await navigator.credentials.get({ publicKey: getOptions });
  if (!credential) throw new Error('No se detectó la huella o se canceló la lectura.');
  return serialize(credential);
}

async function available() {
  if (!window.isSecureContext) {
    throw new Error('El sensor de huellas requiere un entorno seguro (HTTPS o localhost).');
  }
  if (!window.PublicKeyCredential) {
    throw new Error('Este navegador o dispositivo no es compatible con autenticación biométrica WebAuthn.');
  }
}

function explain(error) {
  if (error.name === 'NotAllowedError') {
    return new Error('Lectura de huella cancelada o tiempo de espera agotado.');
  }
  if (error.name === 'NotSupportedError') {
    return new Error('Este navegador o dispositivo no admite la lectura biométrica solicitada.');
  }
  return error;
}

export const DeviceService = {
  async status(token, id) {
    const response = await fetch(`/api/admin/dispositivos/${id}/status`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) {
      throw new Error(response.status === 404 ? 'Reinicia el servidor para habilitar el registro de huellas.' : 'No se pudo consultar el estado de la huella.');
    }
    return response.json();
  },

  async register(token, dni) {
    try {
      await available();
      const options = await request(token, 'register/options', { dni });
      const credential = await navigator.credentials.create({
        publicKey: {
          challenge: decode(options.challenge),
          rp: { id: options.rpID, name: 'Panda Fitness' },
          user: { id: decode(options.userID), name: dni, displayName: `Socio ${dni}` },
          pubKeyCredParams: [{ type: 'public-key', alg: -7 }],
          timeout: 60000,
          attestation: 'none',
          authenticatorSelection: {
            // Sin forzar 'platform' para permitir celulares vía cable USB / Bluetooth / QR, o directo en celular
            residentKey: 'required',
            requireResidentKey: true,
            userVerification: 'required',
          },
        },
      });

      const key = credential?.response.getPublicKey?.();
      if (!key || credential.response.getPublicKeyAlgorithm() !== -7) {
        throw new Error('El lector o navegador no proporcionó una clave compatible. Actualízalo.');
      }

      const proof = await request(token, 'register/proof', {
        ceremony: options.ceremony,
        credentialId: credential.id,
        publicKey: encode(key),
      });

      return await request(token, 'register/verify', {
        ceremony: proof.ceremony,
        assertion: await assert(proof),
      });
    } catch (error) {
      throw explain(error);
    }
  },

  async authenticate(token, dni = null) {
    try {
      await available();
      const body = dni ? { dni: String(dni).trim() } : {};
      const options = await request(token, 'authenticate/options', body);
      const assertion = await assert(options);
      return await request(token, 'authenticate/verify', {
        ceremony: options.ceremony,
        assertion,
      });
    } catch (error) {
      throw explain(error);
    }
  },
};
