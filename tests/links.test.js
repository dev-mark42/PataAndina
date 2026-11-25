/* Comprueba que ningún enlace/recurso local apunte a un archivo inexistente (sin dependencias): node tests/links.test.js */
const fs = require('fs'), path = require('path'), root = path.resolve(__dirname, '..');
let bad = 0, n = 0; const fail = m => { bad++; console.log('  ✘ ' + m); };
const read = f => fs.readFileSync(path.join(root, f), 'utf8');
const files = ['index.html', 'app.html', 'guest.html', '404.html', 'manifest.json', 'sw.js', 'css/style.css', ...fs.readdirSync(path.join(root, 'js')).filter(f => f.endsWith('.js')).map(f => 'js/' + f)];
for (const f of files) for (const m of read(f).matchAll(/["'(]\.\/([\w\-./]+\.(?:html|json|js|css|png|svg|webp)(?![\w]))/g)) { n++; if (!fs.existsSync(path.join(root, m[1]))) fail(`${f} → ./${m[1]} no existe`); }
const sw = read('sw.js'); [...sw.matchAll(/'\.\/([\w\-./]+\.\w+)'/g)].forEach(m => { n++; if (!fs.existsSync(path.join(root, m[1]))) fail('sw.js precachea un archivo inexistente: ' + m[1]); });
['consulta', 'control', 'curaciones', 'odontologia', 'domicilio', 'gato', 'imagenologia', 'laboratorio', 'nutricion', 'peluqueria', 'prevencion', 'vacuna', 'cirugia'].forEach(i => { n++; if (!sw.includes(`'${i}'`)) fail('sw.js no precachea el icono ' + i); });
for (const m of read('supabase/schema.sql').matchAll(/,'([a-z]+)',(\d+)\)/g)) { n++; if (!fs.existsSync(path.join(root, `imagenes/${m[1]}.svg`))) fail('icono de servicio sin archivo: ' + m[1]); }
const views = [...read('js/app.js').matchAll(/const VIEWS = \{([^}]+)\}/g)][0][1].split(',').map(x => x.split(':')[0].trim());
for (const m of read('manifest.json').matchAll(/app\.html#(\w+)/g)) { n++; if (!views.includes(m[1])) fail('atajo del manifest a vista inexistente: #' + m[1]); }
console.log(`${n} referencias revisadas.`); console.log(bad ? `${bad} ENLACE(S) ROTO(S)` : 'SIN ENLACES ROTOS'); process.exit(bad ? 1 : 0);
