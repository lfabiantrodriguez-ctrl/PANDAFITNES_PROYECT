const encode = value => btoa(String.fromCharCode(...new Uint8Array(value))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const decode = value => Uint8Array.from(atob(value.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0));

async function request(token, path, body) {
  const response = await fetch(`/api/admin/dispositivos/${path}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.message || 'No se pudo verificar el dispositivo.');
  return result;
}

function serialize(credential) {
  return {
    id: credential.id,
    type: credential.type,
    response: {
      clientDataJSON: encode(credential.response.clientDataJSON),
      authenticatorData: encode(credential.response.authenticatorData),
      signature: encode(credential.response.signature),
    },
  };
}

/**
 * Extrae la clave pública SPKI DER en base64url de la credencial WebAuthn.
 * Compatible con navegadores que soportan getPublicKey() (Chrome PC) y aquellos
 * que no lo tienen (Chrome móvil / Android / Safari), leyendo attestationObject (COSE).
 */
export function extractSpkiPublicKey(credential) {
  // 1. Intento vía WebAuthn Level 3 getPublicKey()
  try {
    const raw = credential?.response?.getPublicKey?.();
    if (raw && (credential.response.getPublicKeyAlgorithm?.() === -7 || !credential.response.getPublicKeyAlgorithm)) {
      return encode(raw);
    }
  } catch (_) {}

  // 2. Extracción de coordenadas P-256 desde attestationObject (CBOR COSE)
  try {
    const attObj = credential?.response?.attestationObject;
    if (attObj) {
      const bytes = new Uint8Array(attObj);
      let x = null;
      let y = null;

      // Buscar las coordenadas x e y (-2 y -3) de la clave COSE EC2
      for (let i = 0; i < bytes.length - 35; i++) {
        // 0x21 (-2) seguido de 0x58 0x20 (cadena de 32 bytes)
        if (bytes[i] === 0x21 && bytes[i + 1] === 0x58 && bytes[i + 2] === 0x20) {
          x = bytes.subarray(i + 3, i + 35);
        }
        // 0x22 (-3) seguido de 0x58 0x20 (cadena de 32 bytes)
        if (bytes[i] === 0x22 && bytes[i + 1] === 0x58 && bytes[i + 2] === 0x20) {
          y = bytes.subarray(i + 3, i + 35);
        }
      }

      if (x && y && x.length === 32 && y.length === 32) {
        // Cabecera ASN.1 DER SPKI para curva prime256v1 (26 bytes) + 0x04 uncompressed
        const header = new Uint8Array([
          0x30, 0x59, 0x30, 0x13, 0x06, 0x07, 0x2a, 0x86, 0x48, 0xce, 0x3d, 0x02,
          0x01, 0x06, 0x08, 0x2a, 0x86, 0x48, 0xce, 0x3d, 0x03, 0x01, 0x07, 0x03,
          0x42, 0x00, 0x04,
        ]);
        const spki = new Uint8Array(header.length + 64);
        spki.set(header, 0);
        spki.set(x, header.length);
        spki.set(y, header.length + 32);
        return encode(spki.buffer);
      }
    }
  } catch (err) {
    console.warn('Extracción de attestationObject falló:', err);
  }

  return null;
}

async function assert(options, attachment = null) {
  const isIp = /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(options.rpID || '');
  const getOptions = {
    challenge: decode(options.challenge),
    timeout: 60000,
    userVerification: 'required',
  };
  if (options.rpID && !isIp) {
    getOptions.rpId = options.rpID;
  }

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
    return new Error('Este dispositivo no cuenta con sensor de huella biométrica activo.');
  }
  return error;
}

export const DeviceService = {
  encode,
  decode,

  async hasPlatformAuthenticator() {
    try {
      if (!window.PublicKeyCredential) return false;
      return Boolean(await window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable());
    } catch {
      return false;
    }
  },

  async status(token, id) {
    const response = await fetch(`/api/admin/dispositivos/${id}/status`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) {
      throw new Error(response.status === 404 ? 'Reinicia el servidor para habilitar el registro de huellas.' : 'No se pudo consultar el estado de la huella.');
    }
    return response.json();
  },

  /**
   * Registro biométrico nativo (1-touch):
   * En celulares activa directamente el sensor de huella nativo (estilo WhatsApp)
   */
  async register(token, dni, { attachment = null } = {}) {
    try {
      await available();
      const options = await request(token, 'register/options', { dni });

      // Si no se fuerza attachment, chequear si hay sensor nativo en el dispositivo
      let selectedAttachment = attachment;
      if (!selectedAttachment) {
        const hasPlatform = await this.hasPlatformAuthenticator();
        if (hasPlatform) {
          selectedAttachment = 'platform';
        }
      }

      const authenticatorSelection = {
        residentKey: 'required',
        requireResidentKey: true,
        userVerification: 'required',
      };
      if (selectedAttachment) {
        authenticatorSelection.authenticatorAttachment = selectedAttachment;
      }

      const isIp = /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(options.rpID || '');
      const rp = { name: 'Panda Fitness' };
      if (options.rpID && !isIp) {
        rp.id = options.rpID;
      }

      const credential = await navigator.credentials.create({
        publicKey: {
          challenge: decode(options.challenge),
          rp,
          user: { id: decode(options.userID), name: dni, displayName: `Socio ${dni}` },
          pubKeyCredParams: [{ type: 'public-key', alg: -7 }],
          timeout: 60000,
          attestation: 'none',
          authenticatorSelection,
        },
      });

      if (!credential) {
        throw new Error('No se detectó la huella o se canceló la lectura.');
      }

      const key = extractSpkiPublicKey(credential);
      if (!key) {
        throw new Error('No se pudo extraer la clave pública del sensor. Intenta nuevamente.');
      }

      // Registro en un solo toque mediante endpoint de completado directo
      const result = await request(token, 'register/complete', {
        ceremony: options.ceremony,
        credentialId: credential.id,
        publicKey: key,
      });

      return result;
    } catch (error) {
      throw explain(error);
    }
  },

  /**
   * Autenticación biométrica nativa (Check-in 1-touch):
   * En celulares activa directamente el sensor de huella nativo
   */
  async authenticate(token, dni = null, { attachment = null } = {}) {
    try {
      await available();
      const body = dni ? { dni: String(dni).trim() } : {};
      const options = await request(token, 'authenticate/options', body);

      let selectedAttachment = attachment;
      if (!selectedAttachment) {
        const hasPlatform = await this.hasPlatformAuthenticator();
        if (hasPlatform) {
          selectedAttachment = 'platform';
        }
      }

      const assertion = await assert(options, selectedAttachment);
      return await request(token, 'authenticate/verify', {
        ceremony: options.ceremony,
        assertion,
      });
    } catch (error) {
      throw explain(error);
    }
  },

  /**
   * Simulación visual del sensor biométrico para pruebas en PC
   */
  async simulateRegister(token, dni) {
    return await request(token, 'simulate/register', { dni });
  },

  async simulateAuthenticate(token, dni = null) {
    return await request(token, 'simulate/authenticate', { dni });
  },

  /**
   * Modo Sensor Móvil Remoto:
   * Permite que la computadora solicite la huella y el celular la capture
   */
  async createRemoteSession(token, { action, dni, socioNombre }) {
    return await request(token, 'remote-session/create', { action, dni, socioNombre });
  },

  async getRemoteSessionStatus(token, sessionId) {
    const response = await fetch(`/api/admin/dispositivos/remote-session/${sessionId}/status`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.message || 'Error consultando estado de sesión móvil');
    }
    return response.json();
  },

  async getActiveRemoteSession(token) {
    const response = await fetch('/api/admin/dispositivos/remote-session/active', {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) return { session: null };
    return response.json();
  },

  async completeRemoteSession(token, sessionId, result) {
    return await request(token, 'remote-session/complete', { sessionId, result });
  },

  async cancelRemoteSession(token, sessionId) {
    return await request(token, `remote-session/${sessionId}/cancel`, {});
  },
};
