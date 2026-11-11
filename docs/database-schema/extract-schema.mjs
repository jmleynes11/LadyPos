// Offline documentation extractor. Never loads index.js/config/.env or opens a DB.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
import crypto from 'node:crypto';
const out = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(out, '../..');
const require = createRequire(path.join(root, 'backend/package.json'));
const mongoose = require('mongoose');
mongoose.connect = mongoose.createConnection = () => { throw new Error('Database connections prohibited in schema audit'); };
mongoose.set('autoCreate', false);
mongoose.set('autoIndex', false);
await import(pathToFileURL(path.join(root, 'backend/app.js')));
const startupModels = mongoose.modelNames().sort();
for (const file of fs.readdirSync(path.join(root, 'backend/models')).filter(x => x.endsWith('.js'))) {
  await import(pathToFileURL(path.join(root, 'backend/models', file)));
}
const clean = value => {
  if (value === undefined) return '<undefined>';
  if (typeof value === 'function') return value.toString();
  if (value instanceof RegExp) return value.toString();
  if (Array.isArray(value)) return value.map(clean);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([k,v]) => [k,clean(v)]));
  return value;
};
function fields(schema, prefix = '') {
  const result = [];
  schema.eachPath((name, p) => {
    const options = {};
    for (const key of ['required','default','enum','unique','sparse','index','ref','min','max','minlength','maxlength','trim','lowercase','uppercase','select','validate','set','immutable','match','auto']) {
      if (Object.hasOwn(p.options, key)) options[key] = clean(p.options[key]);
    }
    const field = { path: prefix + name, type: p.instance, options };
    if (p.$isMongooseDocumentArray) field.type = 'Array<EmbeddedDocument>';
    else if (p.schema) field.type = 'EmbeddedDocument';
    else if (p.instance === 'Array') field.type = `Array<${p.caster?.instance || p.$embeddedSchemaType?.instance || 'Mixed'}>`;
    if (p.defaultValue !== undefined && !Object.hasOwn(options, 'default')) {
      field.implicitDefault = p.instance === 'Array' ? '[] (Mongoose array default)' : clean(p.defaultValue);
    }
    result.push(field);
    if (p.schema) result.push(...fields(p.schema, prefix + name + (p.$isMongooseDocumentArray ? '[].' : '.')));
  });
  return result;
}
const models = mongoose.modelNames().sort().map(name => {
  const m = mongoose.model(name), s = m.schema;
  return { model: name, collection: m.collection.name, loadedByApp: startupModels.includes(name),
    options: clean({strict:s.options.strict, timestamps:s.options.timestamps, versionKey:s.options.versionKey, minimize:s.options.minimize}),
    fields: fields(s), indexes: clean(s.indexes()), virtuals: Object.keys(s.virtuals),
  };
});
function walk(dir) {
  return fs.readdirSync(dir, {withFileTypes:true}).flatMap(entry => {
    if (['node_modules','.git','dist'].includes(entry.name)) return [];
    const full = path.join(dir,entry.name);
    return entry.isDirectory() ? walk(full) : /\.(js|jsx|json)$/.test(entry.name) && !entry.name.includes('lock') ? [full] : [];
  });
}
const sourceFiles = walk(path.join(root,'backend')).filter(f => !f.includes(`${path.sep}tests${path.sep}`));
const manifest = sourceFiles.map(file => ({path:path.relative(root,file).replaceAll('\\','/'), sha256:crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')}));
const data = {auditDate:'2026-11-11', mongooseVersion:mongoose.version, connectionReadyState:mongoose.connection.readyState, startupModels, models, sourceManifest:manifest};
fs.writeFileSync(path.join(out,'schema-metadata.json'), JSON.stringify(data,null,2)+'\n');
console.log(JSON.stringify({declaredModels:models.length,startupModels:startupModels.length,collections:models.map(m=>m.collection),notLoadedByApp:models.filter(m=>!m.loadedByApp).map(m=>m.model),connectionReadyState:mongoose.connection.readyState},null,2));
