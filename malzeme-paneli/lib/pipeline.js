/**
 * Sunucusuz paket üretimi.
 *
 * Kural seti ve malzeme kataloğu sunucu sürümüyle AYNI dosyalardan gelir
 * (`server/prompt.js`, `server/materials.js`); bu iki modül saf JavaScript'tir ve
 * tarayıcıda da çalışır. Böylece iki sürüm arasında kural farkı oluşmaz.
 */

import { buildPackagePrompt, PACKAGE_QC_CHECKLIST } from '../../server/prompt.js';
import { combinationLabel, resolveColor, resolveMaterial, resolveSurface } from '../../server/materials.js';
import { ASPECT_RATIOS, finalize, inspect, prepareInput, preview } from './image.js';
import { generate, providerById } from './provider.js';

const INPUT_LONG_EDGE = 1536;

/**
 * Bir paketi uçtan uca üretir.
 *
 * @param {object} options
 * @param {Blob} options.renderBlob        Referans render
 * @param {Array<object>} options.regions  [{ number, label, x, y, surface, material, color, note, swatchBlob }]
 * @param {(key:string, label:string)=>void} [options.onStep]
 */
export async function renderPackage(options) {
  const {
    renderBlob,
    regions,
    packageName = '',
    scene = 'auto',
    time = 'auto',
    weather = 'auto',
    aspect = 'source',
    userPrompt = '',
    providerId = 'gemini',
    apiKey = '',
    outputLongEdge = 3840,
    onStep = () => {}
  } = options;

  const provider = providerById(providerId);

  onStep('analyzing', 'Referans render ve işaretlenen bölgeler okunuyor');
  const sourceMeta = await inspect(renderBlob);
  const prepared = await prepareInput(renderBlob, INPUT_LONG_EDGE);

  const resolved = regions.map((region) => ({
    number: region.number,
    label: region.label,
    x: region.x,
    y: region.y,
    surfaceRule: region.surface ? resolveSurface({ id: region.surface }).rule : '',
    material: resolveMaterial(region.material ?? null),
    color: resolveColor(region.color ?? null),
    note: region.note || '',
    swatchBlob: region.swatchBlob || null
  }));

  if (!resolved.some((region) => region.material || region.color || region.swatchBlob)) {
    throw new Error('Bu paket hiçbir bölge için malzeme, renk veya doku görseli içermiyor.');
  }

  const swatchCount = resolved.filter((region) => region.swatchBlob).length;
  if (swatchCount) onStep('materials', `${swatchCount} malzeme görseli hazırlanıyor`);

  const references = [];
  const promptRegions = [];
  for (const region of resolved) {
    let swatchRef = null;
    if (region.swatchBlob) {
      const out = await prepareInput(region.swatchBlob, INPUT_LONG_EDGE);
      const index = references.length + 2; // 1 numaralı görsel her zaman referans renderdır
      swatchRef = `Referans görsel ${index}`;
      references.push({
        base64: out.base64,
        mime: 'image/png',
        name: `bolge-${region.number}-malzeme`,
        caption:
          `${swatchRef} — BÖLGE ${region.number}${region.label ? ` (${region.label})` : ''} için malzeme referansı. ` +
          'Yalnızca doku, desen, renk ve yüzey karakteri kaynağıdır; geometrisi, perspektifi, arka planı ve ' +
          'üzerindeki yazılar sahneye taşınmaz.'
      });
    }
    promptRegions.push({ ...region, swatchRef });
  }

  const { instruction } = buildPackagePrompt({
    regions: promptRegions,
    packageName,
    scene,
    time,
    weather,
    aspect,
    userPrompt,
    swatchCount,
    source: { width: sourceMeta.width, height: sourceMeta.height }
  });

  const aspectValue = aspect === 'source' ? sourceMeta.aspect : ASPECT_RATIOS[aspect] ?? sourceMeta.aspect;

  onStep('generating', `${provider.label} ile "${packageName || 'alternatif'}" versiyonu render ediliyor`);
  const generated = await generate({
    providerId,
    image: { base64: prepared.base64, mime: prepared.mime, blob: prepared.blob },
    references,
    instruction,
    aspect: aspect === 'source' ? null : aspect,
    aspectValue,
    scene,
    apiKey,
    model: provider.model
  });

  onStep('upscaling', `Çıktı ${outputLongEdge}px uzun kenara yükseltiliyor ve PNG olarak kodlanıyor`);
  const finalImage = await finalize(generated.blob, { longEdge: outputLongEdge, targetAspect: aspectValue });

  onStep('done', 'Tamamlandı');

  return {
    packageName,
    blob: finalImage.blob,
    downloadUrl: URL.createObjectURL(finalImage.blob),
    fileName: buildFileName(packageName, finalImage.width, finalImage.height),
    previewUrl: await preview(finalImage.blob),
    sourcePreviewUrl: await preview(renderBlob),
    width: finalImage.width,
    height: finalImage.height,
    bytes: finalImage.bytes,
    source: { width: sourceMeta.width, height: sourceMeta.height },
    modelNative: finalImage.native,
    upscaled: finalImage.upscaled,
    scaleFactor: finalImage.scaleFactor,
    aspectMismatch: finalImage.aspectMismatch,
    provider: { id: provider.id, label: provider.label },
    providerText: generated.providerText,
    resolutionNote: resolutionNote(finalImage),
    checklist: PACKAGE_QC_CHECKLIST,
    legend: promptRegions.map((region) => ({
      number: region.number,
      label: region.label,
      material: region.material?.label || null,
      color: region.color ? { name: region.color.name, hex: region.color.hex } : null,
      swatch: Boolean(region.swatchBlob),
      summary: combinationLabel(region) || 'korunacak',
      note: region.note
    })),
    instruction
  };
}

function resolutionNote(finalImage) {
  const target = `${finalImage.width}×${finalImage.height}`;
  if (!finalImage.upscaled) {
    return `Çıktı ${target} PNG. Model bu çözünürlüğü doğrudan üretti.`;
  }
  return (
    `Çıktı ${target} PNG. Modelin ürettiği gerçek çözünürlük ${finalImage.native.width}×${finalImage.native.height}; ` +
    `görsel ${finalImage.scaleFactor}× yükseltildi. Yükseltme detay üretmez, ölçek büyütür. ` +
    'Bu sunucusuz sürümde yükseltme tarayıcıda (canvas) yapılır; sunucu sürümündeki Lanczos kadar keskin değildir.'
  );
}

function buildFileName(packageName, width, height) {
  const slug = String(packageName || 'alternatif')
    .replace(/[^\p{L}\p{N}._-]+/gu, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40) || 'alternatif';
  const stamp = new Date().toISOString().slice(0, 10);
  return `render_${slug}_${width}x${height}_${stamp}.png`;
}
