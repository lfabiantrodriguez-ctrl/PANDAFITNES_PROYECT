const CONSULTADATOS_TOKEN = process.env.CONSULTADATOS_TOKEN || "";

class DniService {
    static async lookup(dni) {
        if (!CONSULTADATOS_TOKEN) {
            throw new Error("CONSULTADATOS_TOKEN no esta configurado en el backend");
        }

        const response = await fetch(`https://api.decolecta.com/v1/reniec/dni?numero=${dni}`, {
            method: "GET",
            headers: {
                Authorization: `Bearer ${CONSULTADATOS_TOKEN}`,
            },
            redirect: "follow",
        });

        const text = await response.text();

        return {
            ok: response.ok,
            status: response.status,
            text,
        };
    }
}

module.exports = DniService;
