/**
 * Carrega o catálogo de disciplinas de data/disciplines.json (dados, não código).
 * O resultado fica em cache na sessão do navegador.
 */
const DATA_URL = '/marketplace/rulesets/wod20th/data/disciplines.json';

let cache = null;

export async function loadDisciplines() {
  if (cache) return cache;
  try {
    const res = await fetch(DATA_URL);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    cache = await res.json();
  } catch (err) {
    console.warn('[WoD20th] Não foi possível carregar data/disciplines.json:', err);
    return {};
  }
  return cache;
}
