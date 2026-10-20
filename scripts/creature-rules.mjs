/**
 * World of Darkness 20th Edition - Creature Rules & Specific Mechanics
 * Contém tabelas, modificadores e regras de V20, W20 e M20.
 */

// 1. LOBISOMEM (W20) - TABELA DAS 5 FORMAS
export const WEREWOLF_FORMS = {
  homid: {
    key: 'homid',
    labelKey: 'system.werewolf.forms.homid',
    diff: 6,
    modifiers: {
      strength: 0,
      dexterity: 0,
      stamina: 0,
      manipulation: 0,
      appearance: 0,
      perceptionDiff: 0
    },
    damageType: 'normal',
    incitesDelirium: false,
    regenerates: false
  },
  glabro: {
    key: 'glabro',
    labelKey: 'system.werewolf.forms.glabro',
    diff: 7,
    modifiers: {
      strength: 2,
      dexterity: 0,
      stamina: 2,
      manipulation: -1,
      appearance: -1,
      perceptionDiff: 0
    },
    damageType: 'normal',
    incitesDelirium: false,
    regenerates: true
  },
  crinos: {
    key: 'crinos',
    labelKey: 'system.werewolf.forms.crinos',
    diff: 6,
    modifiers: {
      strength: 4,
      dexterity: 1,
      stamina: 3,
      manipulation: 0, // Inapto para fala social normal
      appearance: 0,   // Monstruoso
      perceptionDiff: 0
    },
    damageType: 'aggravated', // Garras e Presas causam Dano Agravado
    incitesDelirium: true,     // Causa Delírio em humanos
    regenerates: true          // 1 nível de dano não-agravado por turno
  },
  hispo: {
    key: 'hispo',
    labelKey: 'system.werewolf.forms.hispo',
    diff: 7,
    modifiers: {
      strength: 3,
      dexterity: 2,
      stamina: 3,
      manipulation: 0,
      appearance: 0,
      perceptionDiff: -1
    },
    biteDamageBonus: 1,
    damageType: 'aggravated',
    incitesDelirium: false,
    regenerates: true
  },
  lupus: {
    key: 'lupus',
    labelKey: 'system.werewolf.forms.lupus',
    diff: 6,
    modifiers: {
      strength: 1,
      dexterity: 2,
      stamina: 2,
      manipulation: 0,
      appearance: 0,
      perceptionDiff: -2 // Sentidos aguçados: -2 na dificuldade de Percepção
    },
    damageType: 'aggravated',
    incitesDelirium: false,
    regenerates: true
  }
};

/**
 * Calcula os atributos modificados pela forma ativa do Lobisomem
 */
export function getActiveWerewolfAttributes(baseAttributes = {}, activeForm = 'homid') {
  const form = WEREWOLF_FORMS[activeForm] || WEREWOLF_FORMS.homid;
  const mods = form.modifiers;

  const result = { ...baseAttributes };

  // Aplica modificadores
  result.strength = Math.max(1, (baseAttributes.strength || 1) + mods.strength);
  result.dexterity = Math.max(1, (baseAttributes.dexterity || 1) + mods.dexterity);
  result.stamina = Math.max(1, (baseAttributes.stamina || 1) + mods.stamina);

  // Manipulação e Aparência em formas bestiais viram 0 quando aplicável
  if (mods.manipulation === 0 && (activeForm === 'crinos' || activeForm === 'hispo' || activeForm === 'lupus')) {
    result.manipulation = 0;
  } else {
    result.manipulation = Math.max(0, (baseAttributes.manipulation || 1) + mods.manipulation);
  }

  if (mods.appearance === 0 && (activeForm === 'crinos' || activeForm === 'hispo' || activeForm === 'lupus')) {
    result.appearance = 0;
  } else {
    result.appearance = Math.max(0, (baseAttributes.appearance || 1) + mods.appearance);
  }

  return {
    attributes: result,
    form,
    perceptionDiffMod: mods.perceptionDiff || 0
  };
}

// 2. VAMPIRO (V20) - TABELA DE GERAÇÃO
export const VAMPIRE_GENERATION_TABLE = {
  15: { maxBlood: 10, bloodPerTurn: 1, maxTrait: 5 },
  14: { maxBlood: 10, bloodPerTurn: 1, maxTrait: 5 },
  13: { maxBlood: 10, bloodPerTurn: 1, maxTrait: 5 },
  12: { maxBlood: 11, bloodPerTurn: 1, maxTrait: 5 },
  11: { maxBlood: 12, bloodPerTurn: 1, maxTrait: 5 },
  10: { maxBlood: 13, bloodPerTurn: 1, maxTrait: 5 },
  9:  { maxBlood: 14, bloodPerTurn: 2, maxTrait: 5 },
  8:  { maxBlood: 15, bloodPerTurn: 3, maxTrait: 5 },
  7:  { maxBlood: 20, bloodPerTurn: 4, maxTrait: 6 },
  6:  { maxBlood: 30, bloodPerTurn: 6, maxTrait: 7 },
  5:  { maxBlood: 40, bloodPerTurn: 8, maxTrait: 8 },
  4:  { maxBlood: 50, bloodPerTurn: 10, maxTrait: 9 }
};

/**
 * Retorna os limites da geração de Vampiro
 */
export function getVampireGenerationLimits(genString = '13ª') {
  const genNum = parseInt(String(genString).replace(/\D/g, ''), 10) || 13;
  const clampedGen = Math.min(15, Math.max(4, genNum));
  return VAMPIRE_GENERATION_TABLE[clampedGen] || VAMPIRE_GENERATION_TABLE[13];
}

// 3. MAGO (M20) - CÁLCULO DE MÁGIKA & ESFERAS
export const MAGE_SPHERES = [
  'correspondence',
  'entropy',
  'forces',
  'matter',
  'mind',
  'prime',
  'life',
  'time',
  'spirit'
];

/**
 * Calcula a dificuldade do feitiço de acordo com as regras de M20
 * Coincidente: Maior Esfera + 3
 * Vulgar s/ testemunhas: Maior Esfera + 4
 * Vulgar c/ testemunhas: Maior Esfera + 5
 * Quintessência gasta reduz a dificuldade (máximo -3)
 */
export function calculateMagickDifficulty({
  highestSphere = 1,
  castingType = 'coincidental', // 'coincidental', 'vulgar', 'vulgar_witnessed'
  quintessenceSpent = 0
}) {
  let baseDiff = 3;
  if (castingType === 'vulgar') {
    baseDiff = 4;
  } else if (castingType === 'vulgar_witnessed') {
    baseDiff = 5;
  }

  const rawDiff = highestSphere + baseDiff;
  const quintReduction = Math.min(3, Math.max(0, parseInt(quintessenceSpent, 10) || 0));
  const finalDiff = Math.min(10, Math.max(3, rawDiff - quintReduction));

  return {
    rawDiff,
    quintReduction,
    finalDiff
  };
}

// 4. COMBATE UNIVERSAL WOD20
export const INITIATIVE_FORMULAS = {
  dex_wits: { key: 'dex_wits', labelKey: 'system.settings.initiativeFormula.dexWits' },
  dex_alertness: { key: 'dex_alertness', labelKey: 'system.settings.initiativeFormula.dexAlertness' },
  wits_alertness: { key: 'wits_alertness', labelKey: 'system.settings.initiativeFormula.witsAlertness' }
};

/**
 * Calcula a Iniciativa Base de acordo com a fórmula configurada pelo Narrador (GM).
 * Aceita objeto { dexterity, wits, alertness } ou argumentos posicionais.
 * Opções de fórmula:
 * - 'dex_wits': Destreza + Raciocínio (Livro padrão V20/W20)
 * - 'dex_alertness': Destreza + Prontidão
 * - 'wits_alertness': Raciocínio + Prontidão
 */
export function calculateInitiative(firstParam = 1, secondParam = 1, thirdParam = 0, formulaChoice = 'dex_wits') {
  if (typeof firstParam === 'object' && firstParam !== null) {
    const attrs = firstParam.attributes || firstParam;
    const dex = parseInt(attrs.dexterity, 10) || 1;
    const wits = parseInt(attrs.wits, 10) || 1;
    const alertness = parseInt(firstParam.alertness ?? firstParam.abilities?.alertness?.value ?? firstParam.abilities?.alertness ?? 0, 10) || 0;
    const choice = typeof secondParam === 'string' ? secondParam : (firstParam.formulaChoice || 'dex_wits');

    if (choice === 'dex_alertness') return dex + alertness;
    if (choice === 'wits_alertness') return wits + alertness;
    return dex + wits;
  }

  const dex = parseInt(firstParam, 10) || 1;
  const wits = parseInt(secondParam, 10) || 1;
  const alertness = typeof thirdParam === 'number' ? thirdParam : 0;
  const choice = typeof thirdParam === 'string' ? thirdParam : (typeof formulaChoice === 'string' ? formulaChoice : 'dex_wits');

  if (choice === 'dex_alertness') return dex + alertness;
  if (choice === 'wits_alertness') return wits + alertness;
  return dex + wits;
}

export function calculateSoakPool(stamina = 1, armorSoak = 0) {
  return (parseInt(stamina, 10) || 1) + (parseInt(armorSoak, 10) || 0);
}
