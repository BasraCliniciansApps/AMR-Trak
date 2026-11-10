// Builds desktop/app from the web app (web files are never modified).
// - copies the web app, - vendors every CDN library locally, - builds Tailwind CSS,
// - rewrites index.html to use local files only, - injects the desktop storage shim.
const fs = require('fs'), path = require('path'), { execSync } = require('child_process');
const root = path.join(__dirname, '..', '..');           // web app
const out = path.join(__dirname, '..', 'app');
const nm = p => path.join(__dirname, '..', 'node_modules', p);

fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(path.join(out, 'vendor'), { recursive: true });
fs.mkdirSync(path.join(out, 'vendor', 'images'), { recursive: true });

// 1) copy web app files needed by the PC (data entry) page
for (const f of ['index.html', 'icon.png', 'organisms_dictionary.json', 'specimens_dictionary.json', 'Antibiogram_5.xlsx'])
  fs.copyFileSync(path.join(root, f), path.join(out, f));
fs.cpSync(path.join(root, 'js'), path.join(out, 'js'), { recursive: true });
fs.cpSync(path.join(root, 'img'), path.join(out, 'img'), { recursive: true });
fs.cpSync(path.join(root, 'css'), path.join(out, 'css'), { recursive: true });
fs.mkdirSync(path.join(__dirname, '..', 'build'), { recursive: true });
fs.copyFileSync(path.join(root, 'icon.png'), path.join(__dirname, '..', 'build', 'icon.png'));

// 2) vendor libraries (url fragment -> node_modules file)
const libs = [
  ['xlsx/dist/xlsx.full.min.js', nm('xlsx/dist/xlsx.full.min.js'), 'xlsx.full.min.js'],
  ['code.jquery.com/jquery-3.7.0.min.js', nm('jquery/dist/jquery.min.js'), 'jquery.min.js'],
  ['jquery.dataTables.min.css', nm('datatables.net-dt/css/jquery.dataTables.min.css'), 'jquery.dataTables.min.css'],
  ['buttons.dataTables.min.css', nm('datatables.net-buttons-dt/css/buttons.dataTables.min.css'), 'buttons.dataTables.min.css'],
  ['jquery.dataTables.min.js', nm('datatables.net/js/jquery.dataTables.min.js'), 'jquery.dataTables.min.js'],
  ['dataTables.buttons.min.js', nm('datatables.net-buttons/js/dataTables.buttons.min.js'), 'dataTables.buttons.min.js'],
  ['jszip/3.10.1/jszip.min.js', nm('jszip/dist/jszip.min.js'), 'jszip.min.js'],
  ['buttons.html5.min.js', nm('datatables.net-buttons/js/buttons.html5.min.js'), 'buttons.html5.min.js'],
  ['buttons.print.min.js', nm('datatables.net-buttons/js/buttons.print.min.js'), 'buttons.print.min.js'],
  ['select2.min.css', nm('select2/dist/css/select2.min.css'), 'select2.min.css'],
  ['select2.min.js', nm('select2/dist/js/select2.min.js'), 'select2.min.js'],
  ['sweetalert2@11', nm('sweetalert2/dist/sweetalert2.all.min.js'), 'sweetalert2.all.min.js'],
  ['npm/chart.js', nm('chart.js/dist/chart.umd.js'), 'chart.umd.js'],
  ['xlsx-populate.min.js', nm('xlsx-populate/browser/xlsx-populate.min.js'), 'xlsx-populate.min.js'],
  ['FileSaver.min.js', nm('file-saver/dist/FileSaver.min.js'), 'FileSaver.min.js'],
  ['firebase-app-compat.js', nm('firebase/firebase-app-compat.js'), 'firebase-app-compat.js'],
  ['firebase-auth-compat.js', nm('firebase/firebase-auth-compat.js'), 'firebase-auth-compat.js'],
  ['firebase-firestore-compat.js', nm('firebase/firebase-firestore-compat.js'), 'firebase-firestore-compat.js'],
];
for (const [, src, name] of libs) fs.copyFileSync(src, path.join(out, 'vendor', name));
for (const f of fs.readdirSync(nm('datatables.net-dt/images')))
  fs.copyFileSync(path.join(nm('datatables.net-dt/images'), f), path.join(out, 'vendor', 'images', f));

// 3) Tailwind: static CSS replaces the CDN runtime (scans html + js for classes)
const twCfg = path.join(__dirname, 'tailwind.config.js');
fs.writeFileSync(path.join(__dirname, 'tw-input.css'), '@tailwind base;\n@tailwind components;\n@tailwind utilities;\n');
execSync(`npx tailwindcss -c "${twCfg}" -i "${path.join(__dirname, 'tw-input.css')}" -o "${path.join(out, 'vendor', 'tailwind.css')}" --minify`,
  { stdio: 'inherit', cwd: path.join(__dirname, '..') });

// 4) rewrite index.html
let html = fs.readFileSync(path.join(out, 'index.html'), 'utf8');
// drop Tailwind CDN script + its inline config block (replaced by static css)
html = html.replace(/<script src="https:\/\/cdn\.tailwindcss\.com"><\/script>/, '<link rel="stylesheet" href="vendor/tailwind.css">');
html = html.replace(/<script>\s*tailwind\.config\s*=[\s\S]*?<\/script>/, '');
// storage shim must run before everything else
html = html.replace(/<head>/i, '<head>\n<script src="vendor/storage-shim.js"></script>');
// map every remaining remote URL to its vendored file
html = html.replace(/(src|href)="(https?:\/\/[^"]+)"/g, (m, attr, url) => {
  const hit = libs.find(([frag]) => url.includes(frag));
  if (!hit) { console.warn('UNMAPPED remote URL:', url); return m; }
  return `${attr}="vendor/${hit[2]}"`;
});
fs.writeFileSync(path.join(out, 'index.html'), html);
fs.copyFileSync(path.join(__dirname, 'storage-shim.js'), path.join(out, 'vendor', 'storage-shim.js'));

const left = html.match(/(src|href)="https?:\/\/[^"]+"/g);
console.log(left ? 'REMAINING REMOTE:\n' + left.join('\n') : 'OK: no remote URLs left in index.html');
