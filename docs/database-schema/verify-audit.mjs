// Documentation-only integrity checks. No Mongoose/app imports or DB access.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
const out = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(out, '../..');
const data = JSON.parse(fs.readFileSync(path.join(out,'schema-metadata.json'),'utf8'));
const report = fs.readFileSync(path.join(out,'database-schema-audit.md'),'utf8').replaceAll('\r\n','\n');
const chapter = fs.readFileSync(path.join(out,'chapter-26.2-database-documentation.md'),'utf8').replaceAll('\r\n','\n');
const diagram = fs.readFileSync(path.join(out,'database-erd.mmd'),'utf8').replaceAll('\r\n','\n');
assert.equal(data.models.length,23);
assert.equal(new Set(data.models.map(m=>m.collection)).size,23);
assert.equal(data.startupModels.length,22);
assert.deepEqual(data.models.filter(m=>!m.loadedByApp).map(m=>m.model),['Financial']);
assert.equal(data.connectionReadyState,0);
for(let n=1;n<=11;n++) assert.ok(report.includes(`## ${n}. `));
for(let n=1;n<=5;n++) assert.ok(chapter.includes(`## 26.2.${n} `));
let paths=0;
for(const m of data.models) {
  const structure = report.split(`### ${m.collection} — `)[1]?.split('\n### ')[0];
  const dictionary = report.split('## 8. Complete Data Dictionary')[1]?.split(`### ${m.collection}\n`)[1]?.split('\n### ')[0];
  assert.ok(structure && dictionary,`Missing tables: ${m.collection}`);
  for(const f of m.fields) {
    assert.ok(structure.includes(`| ${f.path} |`),`Missing structure ${m.collection}.${f.path}`);
    assert.ok(dictionary.includes(`| ${m.collection} | ${f.path} |`),`Missing dictionary ${m.collection}.${f.path}`);
    paths++;
  }
}
const entities=[...diagram.matchAll(/^    ([a-z]+) \{$/gm)].map(m=>m[1]);
assert.deepEqual(entities.toSorted(),data.models.map(m=>m.collection).toSorted());
assert.equal(diagram.match(/^    \}$/gm)?.length,23);
const ends=[];
for(const line of diagram.split('\n').filter(x=>/^    [a-z]+ [|}o]/.test(x))) {
  const match=line.match(/^    ([a-z]+) ([|o{}]+\.\.[|o{}]+) ([a-z]+) : "[^"]+"$/);
  assert.ok(match,`Malformed relationship line: ${line}`);
  assert.ok(entities.includes(match[1]) && entities.includes(match[3]));
  ends.push(line);
}
for(const link of report.matchAll(/\]\(\.\.\/\.\.\/([^#)]+)#L(\d+)\)/g)) {
  const file=path.join(root,link[1]);
  assert.ok(fs.existsSync(file),`Broken source link: ${file}`);
  assert.ok(Number(link[2])<=fs.readFileSync(file,'utf8').split('\n').length);
}
for(const entry of data.sourceManifest) {
  assert.equal(crypto.createHash('sha256').update(fs.readFileSync(path.join(root,entry.path))).digest('hex'),entry.sha256,`Backend source changed: ${entry.path}`);
}
const result={declaredModels:23,distinctCollectionMappings:23,appLoadedModels:22,definitionOnlyModels:['Financial'],schemaPathsVerifiedInBothTables:paths,diagramEntities:entities.length,diagramRelationships:ends.length,sourceFilesUnchanged:data.sourceManifest.length,connectionReadyState:0,diagramValidation:'Structural checks only; no Mermaid renderer/parser installed',productionDatabaseAccess:false};
fs.writeFileSync(path.join(out,'verification-results.json'),JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify(result,null,2));
