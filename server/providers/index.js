import { config } from '../config.js';
import * as gemini from './gemini.js';
import * as openai from './openai.js';
import * as mock from './mock.js';

const REGISTRY = new Map([
  [gemini.id, gemini],
  [openai.id, openai],
  [mock.id, mock]
]);

export function listProviders() {
  return [...REGISTRY.values()].map((provider) => provider.describe());
}

/**
 * İstenen sağlayıcıyı döndürür; yapılandırılmamışsa açıklayıcı hata verir.
 * `clientKey` verilirse (panelden girilen kendi anahtarı) sunucu anahtarı olmadan da çalışır.
 */
export function getProvider(name = config.provider, clientKey = '') {
  const provider = REGISTRY.get(String(name).toLowerCase());
  if (!provider) {
    throw new Error(`Bilinmeyen sağlayıcı: ${name}. Seçenekler: ${[...REGISTRY.keys()].join(', ')}`);
  }
  if (!provider.isConfigured(clientKey)) {
    const clientHint = config.allowClientKey
      ? ' Panelden kendi API anahtarınızı da girebilirsiniz.'
      : '';
    throw new Error(
      `${provider.label} yapılandırılmamış. Sunucuya API anahtarını tanımlayın veya demo mod için "Yerel demo" sağlayıcısını seçin.${clientHint}`
    );
  }
  return provider;
}

export function activeProviderName() {
  return REGISTRY.has(config.provider) ? config.provider : 'mock';
}
