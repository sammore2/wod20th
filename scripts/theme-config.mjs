/**
 * Configuração de cabeçalho por tema (data/themes.json).
 * Campo vazio = usa o texto padrão do idioma.
 */
const DATA_URL = '/marketplace/rulesets/wod20th/data/themes.json';

let cache = null;

export async function loadThemeConfig() {
  if (cache) return cache;
  try {
    const res = await fetch(DATA_URL);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    cache = await res.json();
  } catch (err) {
    console.warn('[WoD20th] Não foi possível carregar data/themes.json:', err);
    return {};
  }
  return cache;
}
