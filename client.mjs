import { SystemRegistry, defineSystem, sheets, settings } from '/_loom/sdk/index.js';
import { WoDActorSheet } from './sheets/actor-sheet.mjs';
import { WoDItemSheet } from './sheets/item-sheet.mjs';
import { registerWoDRollCard } from './scripts/dice.mjs';
import {
  getActiveWerewolfAttributes,
  getVampireGenerationLimits,
  calculateInitiative,
  calculateSoakPool,
  INITIATIVE_FORMULAS
} from './scripts/creature-rules.mjs';

const SYSTEM_ID = 'wod20th';
const ACTOR_TYPES = ['mortal', 'vampire', 'werewolf', 'mage', 'hunter', 'changeling', 'wraith', 'npc', 'group'];
const ITEM_TYPES = [
  'weapon', 'armor', 'gear', 'merit', 'flaw', 'background',
  'discipline', 'ritual', 'gift', 'rite', 'fetish', 'talen', 'totem',
  'rote', 'wonder', 'grimoire', 'talisman', 'artifact',
  'art', 'realm', 'arcanoi', 'power', 'edge', 'condition', 'path', 'derangement', 'passion'
];

// Registra Configuração Aberta de Fórmula de Iniciativa para o Narrador
const settingsRegistry = settings || window.Loom?.settings;
if (settingsRegistry?.register) {
  settingsRegistry.register(SYSTEM_ID, 'initiativeFormula', {
    name: 'system.settings.initiativeFormula.name',
    hint: 'system.settings.initiativeFormula.hint',
    scope: 'world',
    config: true,
    type: String,
    default: 'dex_wits',
    choices: {
      'dex_wits': 'system.settings.initiativeFormula.dexWits',
      'dex_alertness': 'system.settings.initiativeFormula.dexAlertness',
      'wits_alertness': 'system.settings.initiativeFormula.witsAlertness'
    }
  });
}

// 1. Registra o Sistema Central no LoomVTT
SystemRegistry.register(defineSystem({
  id: SYSTEM_ID,
  title: 'World of Darkness 20th Edition',
  version: '0.1.0',
  actorTypes: ACTOR_TYPES,
  itemTypes: ITEM_TYPES,

  getDefaultData(type) {
    const commonData = {
      profile: {
        player: '',
        chronicle: '',
        nature: '',
        demeanor: '',
        concept: ''
      },

      // 9 Atributos Clássicos do Storyteller System
      attributes: {
        strength: 1,
        dexterity: 1,
        stamina: 1,
        charisma: 1,
        manipulation: 1,
        appearance: 1,
        perception: 1,
        intelligence: 1,
        wits: 1
      },

      // 30 Habilidades Clássicas
      abilities: {
        alertness: { value: 0, specialty: '' },
        athletics: { value: 0, specialty: '' },
        brawl: { value: 0, specialty: '' },
        empathy: { value: 0, specialty: '' },
        expression: { value: 0, specialty: '' },
        intimidation: { value: 0, specialty: '' },
        leadership: { value: 0, specialty: '' },
        streetwise: { value: 0, specialty: '' },
        subterfuge: { value: 0, specialty: '' },
        awareness: { value: 0, specialty: '' },

        animalKen: { value: 0, specialty: '' },
        crafts: { value: 0, specialty: '' },
        drive: { value: 0, specialty: '' },
        etiquette: { value: 0, specialty: '' },
        firearms: { value: 0, specialty: '' },
        melee: { value: 0, specialty: '' },
        performance: { value: 0, specialty: '' },
        security: { value: 0, specialty: '' },
        stealth: { value: 0, specialty: '' },
        survival: { value: 0, specialty: '' },

        academics: { value: 0, specialty: '' },
        computer: { value: 0, specialty: '' },
        finance: { value: 0, specialty: '' },
        investigation: { value: 0, specialty: '' },
        law: { value: 0, specialty: '' },
        medicine: { value: 0, specialty: '' },
        occult: { value: 0, specialty: '' },
        politics: { value: 0, specialty: '' },
        science: { value: 0, specialty: '' },
        technology: { value: 0, specialty: '' }
      },

      // Força de Vontade
      willpower: {
        value: 3,
        max: 3
      },

      // Vitalidade (7 Níveis de Ferimento)
      health: {
        levels: {
          bruised: 'none',
          hurt: 'none',
          injured: 'none',
          wounded: 'none',
          mauled: 'none',
          crippled: 'none',
          incapacitated: 'none'
        }
      },

      bio: {
        history: '',
        appearance: '',
        contacts: ''
      },
      xp: {
        total: 0,
        unspent: 0
      },
      notes: ''
    };

    // Especializações por tipo
    if (type === 'vampire') {
      return {
        ...commonData,
        profile: {
          ...commonData.profile,
          clan: 'Brujah',
          generation: '13ª',
          sire: ''
        },
        virtues: { conscience: 1, selfControl: 1, courage: 1 },
        humanity: { pathName: 'Humanidade', value: 7 },
        blood: { value: 10, max: 10 }
      };
    }

    if (type === 'werewolf') {
      return {
        ...commonData,
        profile: {
          ...commonData.profile,
          breed: 'Hominídeo',
          auspice: 'Ahroun',
          tribe: 'Crias de Fenris',
          pack: '',
          totem: '',
          rank: 1
        },
        activeForm: 'homid',
        rage: { value: 3, max: 3 },
        gnosis: { value: 3, max: 3 },
        renown: {
          glory: { perm: 0, temp: 0 },
          honor: { perm: 0, temp: 0 },
          wisdom: { perm: 0, temp: 0 }
        }
      };
    }

    if (type === 'mage') {
      return {
        ...commonData,
        profile: {
          ...commonData.profile,
          essence: 'Dinâmica',
          tradition: 'Ordem de Hermes',
          affiliation: '',
          cabal: '',
          sect: ''
        },
        arete: { value: 1 },
        quintessence: { value: 5 },
        paradox: { value: 0 },
        spheres: {
          correspondence: 0,
          entropy: 0,
          forces: 0,
          matter: 0,
          mind: 0,
          prime: 0,
          life: 0,
          time: 0,
          spirit: 0
        }
      };
    }

    if (type === 'hunter') {
      return {
        ...commonData,
        profile: {
          ...commonData.profile,
          profession: '',
          residence: '',
          affiliation: ''
        },
        virtues: { mercy: 1, vision: 1, zeal: 1 },
        conviction: { value: 3, max: 10 }
      };
    }

    if (type === 'changeling') {
      return {
        ...commonData,
        profile: {
          ...commonData.profile,
          kith: 'Boggart',
          seeming: 'Childling',
          court: 'Seelie',
          house: '',
          motley: ''
        },
        glamour: { value: 4, max: 10 },
        banality: { value: 3, max: 10 },
        nightmare: { value: 0, max: 10 }
      };
    }

    if (type === 'wraith') {
      return {
        ...commonData,
        profile: {
          ...commonData.profile,
          guild: '',
          faction: '',
          legion: '',
          life: '',
          death: '',
          regret: ''
        },
        corpus: { value: 10, max: 10 },
        pathos: { value: 5, max: 10 },
        angst: { value: 0, max: 10 },
        shadowArchetype: 'Freak',
        psyche: 1
      };
    }

    if (type === 'group') {
      return {
        ...commonData,
        members: []
      };
    }

    // Mortal padrão
    return {
      ...commonData,
      profile: {
        ...commonData.profile,
        profession: '',
        residence: '',
        affiliation: ''
      },
      virtues: { conscience: 1, selfControl: 1, courage: 1 },
      humanity: { pathName: 'Humanidade', value: 7 }
    };
  },

  prepareData(actor) {
    if (!actor.systemData) return;

    const system = actor.systemData;
    const attrs = system.attributes || {};
    const healthLevels = system.health?.levels || {};

    // 1. Penalidade de Ferimentos
    let healthPenalty = 0;
    if (healthLevels.incapacitated && healthLevels.incapacitated !== 'none') {
      healthPenalty = -99;
    } else if (healthLevels.crippled && healthLevels.crippled !== 'none') {
      healthPenalty = -5;
    } else if (healthLevels.mauled && healthLevels.mauled !== 'none') {
      healthPenalty = -2;
    } else if (healthLevels.wounded && healthLevels.wounded !== 'none') {
      healthPenalty = -2;
    } else if (healthLevels.injured && healthLevels.injured !== 'none') {
      healthPenalty = -1;
    } else if (healthLevels.hurt && healthLevels.hurt !== 'none') {
      healthPenalty = -1;
    }

    let activeAttrs = { ...attrs };
    let bloodMax = 10;
    let bloodPerTurn = 1;

    // 2. Automação de Vampiro (Geração -> Limites de Sangue)
    if (actor.type === 'vampire') {
      const genLimits = getVampireGenerationLimits(system.profile?.generation || '13ª');
      bloodMax = genLimits.maxBlood;
      bloodPerTurn = genLimits.bloodPerTurn;
    }

    // 3. Automação de Lobisomem (Forma Ativa -> Modificadores de Atributos)
    if (actor.type === 'werewolf') {
      const formKey = system.activeForm || 'homid';
      const formResult = getActiveWerewolfAttributes(attrs, formKey);
      activeAttrs = formResult.attributes;
    }

    // 4. Estatísticas Derivadas
    const settingsTarget = settings || window.Loom?.settings;
    const formulaChoice = (settingsTarget?.get ? settingsTarget.get(SYSTEM_ID, 'initiativeFormula') : null) || 'dex_wits';
    const alertnessVal = system.abilities?.alertness?.value ?? 0;
    const initiative = calculateInitiative(
      { attributes: activeAttrs, alertness: alertnessVal },
      formulaChoice
    );
    // Soma bônus de absorção de armaduras equipadas
    let armorSoak = 0;
    if (Array.isArray(actor.items)) {
      for (const item of actor.items) {
        if (item.type === 'armor' && (item.systemData?.equipped ?? true)) {
          armorSoak += parseInt(item.systemData?.soak || item.systemData?.armorSoak || 0, 10);
        }
      }
    }
    const soak = calculateSoakPool(activeAttrs.stamina || 1, armorSoak);

    // Isola valores calculados em systemData.derived para prevenir o stuck-field bug
    actor.systemData.derived = {
      ...(actor.systemData.derived || {}),
      initiative,
      initiativeFormula: formulaChoice,
      soak,
      healthPenalty,
      activeAttributes: activeAttrs,
      bloodMax,
      bloodPerTurn
    };
  },

  getSheetSchema(actorType) {
    return {
      tabs: [
        {
          id: 'attributes',
          label: 'Atributos',
          fields: [
            { key: 'attributes.strength', label: 'Força', type: 'number' },
            { key: 'attributes.dexterity', label: 'Destreza', type: 'number' },
            { key: 'attributes.stamina', label: 'Vigor', type: 'number' }
          ]
        }
      ]
    };
  }
}));

// 2. Registra Fichas de Ator e de Itens no Catálogo do LoomVTT
const catalogTarget = sheets?.catalog ? sheets : window.Loom?.sheets;
if (catalogTarget?.catalog) {
  // Ficha de Ator para todos os tipos
  for (const type of [...ACTOR_TYPES, '*']) {
    catalogTarget.catalog('actor', type, WoDActorSheet);
  }

  // Ficha de Item para todos os tipos de itens
  for (const type of [...ITEM_TYPES, '*']) {
    catalogTarget.catalog('item', type, WoDItemSheet);
  }
}

// 2b. Toda rolagem que chega ao chat (inclusive /r) passa por este evento antes de o card ser montado.
//     Rolagens só de d10 e sem marcação de outro sistema são marcadas como deste sistema,
//     e o renderizador abaixo desenha o card do sistema.
const hookBus = window.LoomHooks || window.Loom?.hooks;
if (hookBus?.on) {
  hookBus.on('chat.roll', (roll) => {
    if (!roll || roll.meta?.system) return;
    const m = String(roll.formula || '').trim().match(/^([0-9]*)d10$/i);
    if (!m) return;
    roll.meta = {
      ...(roll.meta || {}),
      wod20th: true,
      system: 'wod20th',
      pool: Math.max(1, parseInt(m[1] || '1', 10)),
      difficulty: 6,
      label: 'Rolagem rápida'
    };
  });
}

// 3. Registra o Renderizador de Card de Chat Customizado
try {
  registerWoDRollCard();
} catch (err) {
  console.warn('[WoD20th] Aviso ao registrar roll card wrapper:', err);
}

// 4. Pré-carrega TODOS os Templates e Partials na Inicialização para Máxima Performance
if (window.Loom?.loadTemplates) {
  const templateList = [
    // Fichas mestres
    '/marketplace/rulesets/wod20th/templates/character-sheet.hbs',
    '/marketplace/rulesets/wod20th/templates/item-sheet.hbs',

    // Partials comuns
    '/marketplace/rulesets/wod20th/templates/partials/common/attributes.hbs',
    '/marketplace/rulesets/wod20th/templates/partials/common/abilities.hbs',
    '/marketplace/rulesets/wod20th/templates/partials/common/health-track.hbs',
    '/marketplace/rulesets/wod20th/templates/partials/common/combat-stats.hbs',
    '/marketplace/rulesets/wod20th/templates/partials/common/bio.hbs',
    '/marketplace/rulesets/wod20th/templates/partials/common/xp.hbs',

    // Cabeçalhos
    '/marketplace/rulesets/wod20th/templates/partials/headers/header-vampire.hbs',
    '/marketplace/rulesets/wod20th/templates/partials/headers/header-werewolf.hbs',
    '/marketplace/rulesets/wod20th/templates/partials/headers/header-mage.hbs',
    '/marketplace/rulesets/wod20th/templates/partials/headers/header-changeling.hbs',
    '/marketplace/rulesets/wod20th/templates/partials/headers/header-wraith.hbs',
    '/marketplace/rulesets/wod20th/templates/partials/headers/header-hunter.hbs',
    '/marketplace/rulesets/wod20th/templates/partials/headers/header-mortal.hbs',

    // Vantagens
    '/marketplace/rulesets/wod20th/templates/partials/advantages/advantages-vampire.hbs',
    '/marketplace/rulesets/wod20th/templates/partials/advantages/advantages-werewolf.hbs',
    '/marketplace/rulesets/wod20th/templates/partials/advantages/advantages-mage.hbs',
    '/marketplace/rulesets/wod20th/templates/partials/advantages/advantages-changeling.hbs',
    '/marketplace/rulesets/wod20th/templates/partials/advantages/advantages-wraith.hbs',
    '/marketplace/rulesets/wod20th/templates/partials/advantages/advantages-hunter.hbs',
    '/marketplace/rulesets/wod20th/templates/partials/advantages/advantages-mortal.hbs',

    // Abas especiais
    '/marketplace/rulesets/wod20th/templates/partials/special/werewolf-forms.hbs',
    '/marketplace/rulesets/wod20th/templates/partials/special/mage-magick.hbs'
  ];

  // Registra caminhos absolutos e relativos para garantir resolução idêntica no Handlebars
  const allTemplatePaths = [
    ...templateList,
    ...templateList.map(p => p.replace(/^\//, ''))
  ];

  window.Loom.loadTemplates(allTemplatePaths).catch(err => {
    console.warn('[WoD20th] Aviso ao pré-carregar partials:', err);
  });
}

console.log('[WoD20th] Sistema World of Darkness 20th Edition (.mjs) inicializado com todos os partials e itens.');
