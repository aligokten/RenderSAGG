/**
 * GitHub Pages sürümü `server/prompt.js` ve `server/materials.js` dosyalarını tarayıcıdan
 * DOĞRUDAN içe aktarır. Bu iki modül bu yüzden saf JavaScript kalmalıdır: Node'a özgü bir
 * modül (fs, path, node:...) veya npm bağımlılığı eklenirse Pages sürümü sessizce bozulur.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SHARED = ['server/prompt.js', 'server/materials.js'];

test('tarayıcıya giden modüller Node bağımlılığı içermez', async () => {
  for (const file of SHARED) {
    const source = await readFile(path.join(ROOT, file), 'utf8');
    const imports = [...source.matchAll(/^\s*import\s.+?from\s+['"](.+?)['"]/gm)].map((match) => match[1]);
    assert.deepEqual(imports, [], `${file} içe aktarım yapmamalı (tarayıcıda çözümlenemez): ${imports.join(', ')}`);
    assert.doesNotMatch(source, /\bprocess\.|\brequire\(/, `${file} Node çalışma zamanına başvurmamalı`);
  }
});

test('Pages sürümünün dosyaları yerinde', async () => {
  for (const file of [
    'index.html',
    '.nojekyll',
    'malzeme-paneli/index.html',
    'malzeme-paneli/app.js',
    'malzeme-paneli/lib/image.js',
    'malzeme-paneli/lib/provider.js',
    'malzeme-paneli/lib/pipeline.js'
  ]) {
    await readFile(path.join(ROOT, file));
  }
});

test('Pages sürümü ortak kural setini kopyalamaz, doğrudan içe aktarır', async () => {
  const pipeline = await readFile(path.join(ROOT, 'malzeme-paneli/lib/pipeline.js'), 'utf8');
  assert.match(pipeline, /from '\.\.\/\.\.\/server\/prompt\.js'/);
  assert.match(pipeline, /from '\.\.\/\.\.\/server\/materials\.js'/);
});
