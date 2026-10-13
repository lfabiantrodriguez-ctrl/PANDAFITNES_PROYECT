const { spawn } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const net = require('node:net');
const http = require('node:http');

const root = path.resolve(__dirname, '..');
const runtime = path.join(__dirname, 'runtime');
const children = [];
let closing = false;
function stop() {
  if (closing) return;
  closing = true;
  for (const child of children) if (child.exitCode === null) child.kill();
}
process.on('SIGINT', () => { stop(); process.exit(0); });
process.on('SIGTERM', () => { stop(); process.exit(0); });
process.on('exit', stop);

function available(port, host) {
  return new Promise((resolve, reject) => {
    const socket = net.createServer();
    socket.once('error', error => reject(new Error(error.code === 'EADDRINUSE'
      ? `El puerto ${port} ya esta ocupado. Cierra la instancia anterior de Panda antes de volver a iniciar.`
      : `Windows no permite usar el puerto ${port}: ${error.code}.`)));
    socket.listen({ port, host, exclusive: true }, () => socket.close(resolve));
  });
}
function start(name, directory, args) {
  const logfile = path.join(runtime, `${name}.log`);
  fs.writeFileSync(logfile, '');
  const child = spawn(process.execPath, args, {
    cwd: path.join(root, directory), windowsHide: true,
    env: { ...process.env, HOST: '127.0.0.1', PORT: '3000' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  children.push(child);
  child.stdout.on('data', data => fs.appendFileSync(logfile, data));
  child.stderr.on('data', data => fs.appendFileSync(logfile, data));
  child.on('error', error => { child.failure = error; });
  child.on('exit', code => {
    if (!closing) console.log(`\n${name} se detuvo (codigo ${code}). Revisa ${logfile}`);
  });
  return { child, logfile };
}
function probe(url, backend) {
  return new Promise(resolve => {
    const request = http.get(url, response => {
      let body = '';
      response.on('data', data => { body += data; });
      response.on('end', () => {
        if (response.statusCode !== 200) return resolve(false);
        if (!backend) return resolve(body.includes('<html'));
        try { resolve(JSON.parse(body).ok === true); } catch { resolve(false); }
      });
    });
    request.setTimeout(1000, () => request.destroy());
    request.on('error', () => resolve(false));
  });
}
async function ready(service, url, backend) {
  for (let attempt = 0; attempt < 40; attempt++) {
    if (service.child.failure || service.child.exitCode !== null) break;
    if (await probe(url, backend)) return true;
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  console.log(`\nNo pudo iniciar ${backend ? 'el servidor de datos' : 'la pagina'}.`);
  if (service.child.failure) console.log(service.child.failure.message);
  console.log(fs.readFileSync(service.logfile, 'utf8').slice(-3500));
  console.log(`Registro completo: ${service.logfile}`);
  if (service.child.exitCode === null) service.child.kill();
  return false;
}
async function main() {
  if (!fs.existsSync(path.join(root, 'backend', '.env'))) throw new Error('Falta backend/.env con la conexion a la base de datos.');
  const vite = path.join(root, 'frontend', 'node_modules', 'vite', 'bin', 'vite.js');
  if (!fs.existsSync(vite)) throw new Error('Faltan las dependencias de la pagina.');
  await available(3000, '127.0.0.1');
  await available(8081, 'localhost');
  fs.mkdirSync(runtime, { recursive: true });
  console.log('Iniciando Panda Fitness. Mantén esta ventana abierta.\n');
  const backend = start('backend', 'backend', [path.join(root, 'backend', 'src', 'server.js')]);
  const frontend = start('frontend', 'frontend', [vite, '--host', 'localhost', '--port', '8081', '--strictPort']);
  const [apiOK, webOK] = await Promise.all([
    ready(backend, 'http://127.0.0.1:3000/api/health', true),
    ready(frontend, 'http://localhost:8081/', false),
  ]);
  if (webOK) console.log('\nPagina comprobada: http://localhost:8081/');
  if (apiOK && webOK) console.log('Servidor de datos conectado. Sistema listo.');
  else if (webOK) console.log('La pagina abre, pero el servidor de datos no esta disponible. Revisa el error anterior.');
  if (!webOK) { stop(); process.exitCode = 1; }
}
main().catch(error => { console.error(`\n${error.message}`); stop(); process.exitCode = 1; });
