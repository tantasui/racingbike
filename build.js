// Bundles src/*.js + Three.js into one self-contained HTML file.
// Usage: node build.js [path/to/three.min.js]   (three r149 UMD build; default: ./vendor/three.min.js)
const fs = require('fs'), path = require('path');
const threePath = process.argv[2] || path.join(__dirname, 'vendor', 'three.min.js');
const three = fs.readFileSync(threePath, 'utf8') + '\n' + fs.readFileSync(path.join(__dirname, 'vendor', 'three-loaders.r149.js'), 'utf8'); // GLTFLoader, SkeletonUtils, RoomEnvironment for r149
const src = fs.readdirSync(path.join(__dirname, 'src')).filter(f => f.endsWith('.js')).sort().map(f => fs.readFileSync(path.join(__dirname, 'src', f), 'utf8')).join('\n');
const html = fs.readFileSync(path.join(__dirname, 'src', 'template.html'), 'utf8').replace('/*__THREE__*/', () => three).replace('/*__GAME__*/', () => src);
fs.writeFileSync(path.join(__dirname, 'dreamfall.html'), html);
console.log('dreamfall.html', (html.length / 1024 | 0) + ' KB');
