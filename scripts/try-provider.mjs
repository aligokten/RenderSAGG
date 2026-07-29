#!/usr/bin/env node
/**
 * Gerçek sağlayıcıyla tek seferlik üretim testi — paneli açmadan, terminalden.
 *
 * Kullanım:
 *   GEMINI_API_KEY=... node scripts/try-provider.mjs --input render.png
 *   GEMINI_API_KEY=... node scripts/try-provider.mjs --input render.png \
 *       --mode presentation --scene exterior --time day --aspect 16:9 \
 *       --prompt "Cephedeki ahşap kaplama termowood olsun." --out sonuc.png
 *
 * Anahtar yalnızca ortam değişkeninden okunur; komut satırına yazılmaz, hiçbir yere kaydedilmez.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { decodeUpload, getJob, startJob } from '../server/pipeline.js';
import { config } from '../server/config.js';

const args = process.argv.slice(2);
const flag = (name, fallback = null) => {
  const index = args.indexOf(`--${name}`);
  return index === -1 || index === args.length - 1 ? fallback : args[index + 1];
};

const input = flag('input');
if (!input || args.includes('--help')) {
  console.log(`Kullanım: node scripts/try-provider.mjs --input <görsel> [seçenekler]

  --input <yol>        Ham render (PNG/JPG/WEBP)               [zorunlu]
  --out <yol>          Çıktı PNG yolu                          [varsayılan: <girdi>-sonuc.png]
  --provider <ad>      gemini | openai | mock                  [varsayılan: RENDER_PROVIDER]
  --mode <ad>          strict | presentation | revision | material   [varsayılan: strict]
  --scene <ad>         auto | exterior | interior              [varsayılan: auto]
  --time <ad>          auto | day | overcast | goldenHour | dusk | night
  --weather <ad>       auto | clear | cloudy | rain | snow
  --aspect <oran>      source | 16:9 | 3:2 | 4:3 | 1:1 | 9:16  [varsayılan: source]
  --long-edge <px>     Çıktı uzun kenarı                       [varsayılan: ${config.outputLongEdge}]
  --prompt "<metin>"   Ek istekler
  --ref <yol>          Referans görsel (birden fazla kez verilebilir)
  --show-instruction   Modele gönderilen talimatı da yazdır`);
  process.exit(input ? 0 : 1);
}

const references = [];
args.forEach((arg, index) => {
  if (arg === '--ref' && args[index + 1]) references.push(args[index + 1]);
});

const readAsUpload = async (filePath, role) => {
  const buffer = await fs.readFile(filePath);
  const ext = path.extname(filePath).slice(1).toLowerCase();
  const type = ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : ext === 'webp' ? 'image/webp' : 'image/png';
  return decodeUpload({ name: path.basename(filePath), type, data: buffer.toString('base64') }, { role });
};

const providerName = flag('provider', config.provider);
const outputLongEdge = Number(flag('long-edge', config.outputLongEdge));
const outPath = flag('out') || `${input.replace(/\.[^.]+$/, '')}-sonuc.png`;

console.log(`Sağlayıcı: ${providerName} | Mod: ${flag('mode', 'strict')} | Hedef uzun kenar: ${outputLongEdge}px`);
console.log('Üretiliyor…');

const startedAt = Date.now();
const job = startJob({
  render: await readAsUpload(input, 'render'),
  references: await Promise.all(references.map((file) => readAsUpload(file, 'reference'))),
  mode: flag('mode', 'strict'),
  scene: flag('scene', 'auto'),
  time: flag('time', 'auto'),
  weather: flag('weather', 'auto'),
  aspect: flag('aspect', 'source'),
  userPrompt: flag('prompt', ''),
  providerName,
  outputLongEdge
});

let seen = 0;
while (!['done', 'error'].includes(getJob(job.id).status)) {
  const current = getJob(job.id);
  while (seen < current.steps.length) console.log(`  · ${current.steps[seen++].label}`);
  await new Promise((resolve) => setTimeout(resolve, 250));
}

const finished = getJob(job.id);
while (seen < finished.steps.length) console.log(`  · ${finished.steps[seen++].label}`);

if (finished.status === 'error') {
  console.error(`\nHATA: ${finished.error}`);
  process.exit(1);
}

const result = finished.result;
await fs.writeFile(outPath, finished.png);

const seconds = ((Date.now() - startedAt) / 1000).toFixed(1);
console.log(`\nÇıktı: ${outPath}`);
console.log(`Süre: ${seconds} sn`);
console.log(`Kaynak: ${result.source.width}×${result.source.height}`);
console.log(`Modelin ürettiği gerçek çözünürlük: ${result.modelNative.width}×${result.modelNative.height}`);
const size = result.bytes >= 1024 * 1024 ? `${(result.bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.round(result.bytes / 1024)} KB`;
console.log(`Nihai dosya: ${result.width}×${result.height} (${size})`);
console.log(result.upscaled ? `Yükseltme: ${result.scaleFactor}× Lanczos` : 'Yükseltme: gerekmedi (model doğrudan üretti)');
if (result.aspectMismatch) {
  console.log(
    `Oran uyarısı: istenen ${result.aspectMismatch.requested}, üretilen ${result.aspectMismatch.produced} ` +
      `(%${result.aspectMismatch.deviationPct} sapma) — kırpma yapılmadı`
  );
}
if (result.providerText) console.log(`Model notu: ${result.providerText}`);

if (args.includes('--show-instruction')) {
  console.log(`\n--- Modele gönderilen talimat ---\n${result.instruction}`);
}

console.log('\nKalite kontrolü — çıktıyı bu maddelere göre gözden geçirin:');
result.checklist.forEach((item) => console.log(`  [ ] ${item}`));

process.exit(0);
