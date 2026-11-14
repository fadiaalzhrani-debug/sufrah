// ينسخ ملفات الويب إلى www لتطبيق الجوال المطلوب: node sync.js customer | family
// تطبيق الأسر يفتح على family.html كصفحة أولى (index.html داخل www)
const fs = require('fs'), path = require('path');
const app = process.argv[2];
if (!['customer', 'family'].includes(app)) { console.error('usage: node sync.js customer|family'); process.exit(1); }
const root = path.resolve(__dirname, '..');
const out = path.join(__dirname, app, 'www');
fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });
const copy = (rel, dest = rel) => {
  const src = path.join(root, rel);
  if (!fs.existsSync(src)) return;
  const d = path.join(out, dest);
  fs.mkdirSync(path.dirname(d), { recursive: true });
  if (fs.statSync(src).isDirectory()) fs.cpSync(src, d, { recursive: true }); else fs.copyFileSync(src, d);
};
['css', 'js', 'img', 'icons'].forEach((d) => copy(d));
['terms.html', 'privacy.html', 'delete-account.html', 'credits.html', 'join.html'].forEach((f) => copy(f));
if (app === 'customer') { copy('index.html'); copy('manifest.json'); }
else { copy('family.html', 'index.html'); copy('family.html'); copy('family.webmanifest'); copy('index.html', 'store.html'); }
// داخل التطبيق ما نحتاج Service Worker (التحديثات تجي مع ملفات الويب)
console.log(`www ready for ${app}:`, fs.readdirSync(out).join(', '));
