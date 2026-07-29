import { localEnhance } from '../image.js';

export const id = 'mock';
export const label = 'Yerel demo (API anahtarsız)';

export function isConfigured() {
  return true;
}

export function describe() {
  return {
    id,
    label,
    model: 'sharp/local',
    configured: true,
    acceptsClientKey: false,
    note: 'Yapay zekâ üretimi DEĞİLDİR. Yalnızca ton, kontrast, doygunluk ve netlik düzeltmesi uygular; ' +
      'panelin uçtan uca çalıştığını doğrulamak içindir. Fotogerçekçileştirme için gemini veya openai seçin.'
  };
}

export async function generate({ image, scene = 'auto' }) {
  const buffer = await localEnhance(image.buffer, { scene });
  return {
    buffer,
    mime: 'image/png',
    providerText: 'Yerel demo modu: görüntü yapay zekâ ile yeniden üretilmedi, yalnızca ton/netlik düzeltmesi uygulandı.'
  };
}
