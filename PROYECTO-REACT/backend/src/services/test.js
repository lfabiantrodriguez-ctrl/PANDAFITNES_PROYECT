const path = require('path');

require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

const DniService = require('./DniService');

async function probarConsulta() {
    try {
        const dniDePrueba = "60447035";
        console.log(`Iniciando consulta para el DNI: ${dniDePrueba}...`);
        
        const resultado = await DniService.lookup(dniDePrueba);

        console.log("\n--- Resultado de la Consulta ---");
        console.log(`¿Petición Exitosa? (ok): ${resultado.ok}`);
        console.log(`Código de Estado (status): ${resultado.status}`);
        console.log("Datos recibidos:");
        
        if (resultado.ok) {
            console.log(JSON.parse(resultado.text));
        } else {
            console.log(resultado.text);
        }
    } catch (error) {
        console.error("\nOcurrió un error durante la prueba:");
        console.error(error.message);
    }
}

probarConsulta();