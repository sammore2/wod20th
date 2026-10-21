import { openRollDialog, rollWoD, t } from '../scripts/dice.mjs';
import { loadDisciplines } from '../scripts/disciplines-data.mjs';
import { loadThemeConfig } from '../scripts/theme-config.mjs';
import {
  WEREWOLF_FORMS,
  getActiveWerewolfAttributes,
  MAGE_SPHERES,
  calculateMagickDifficulty,
  calculateInitiative,
  calculateSoakPool,
  getVampireGenerationLimits
} from '../scripts/creature-rules.mjs';

import { LoomActorSheet, LoomHandlebarsMixin, LoomDialog, sheets, windowManager, api } from '/_loom/sdk/index.js';

function setPath(obj, path, value) {
  const parts = path.split('.');
  let cur = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    if (!cur[parts[i]] || typeof cur[parts[i]] !== 'object') {
      cur[parts[i]] = {};
    }
    cur = cur[parts[i]];
  }
  cur[parts[parts.length - 1]] = value;
}

/**
 * WoDActorSheet - Ficha de Personagem Modular de Alta Performance para WoD 20th
 */
// Faixa de fundo do cabeçalho (modo banner do Loom): arco próprio, sem arte de terceiros
const HEADER_BANNER = `data:image/svg+xml;utf8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%20800%20160%22%20preserveAspectRatio%3D%22none%22%3E%3Cpath%20d%3D%22M40%20150%20V70%20Q40%2012%20400%2012%20Q760%2012%20760%2070%20V150%22%20fill%3D%22none%22%20stroke%3D%22%23000%22%20stroke-width%3D%222%22%2F%3E%3Cpath%20d%3D%22M70%20150%20V76%20Q70%2040%20400%2040%20Q730%2040%20730%2076%20V150%22%20fill%3D%22none%22%20stroke%3D%22%23000%22%20stroke-width%3D%221%22%2F%3E%3Cpath%20d%3D%22M0%20150%20H800%22%20stroke%3D%22%23000%22%20stroke-width%3D%222%22%2F%3E%3Cpath%20d%3D%22M400%204%20L408%2012%20L400%2020%20L392%2012%20Z%22%20fill%3D%22%23000%22%2F%3E%3C%2Fsvg%3E`;

export class WoDActorSheet extends LoomHandlebarsMixin(LoomActorSheet) {
  static PARTS = {
    sheet: {
      template: '/marketplace/rulesets/wod20th/templates/character-sheet.hbs'
    }
  };

  static DEFAULT_OPTIONS = {
    id: 'wod20th-actor-sheet',
    bannerImage: HEADER_BANNER,
    classes: ['wod20th', 'sheet', 'actor', 'wod20th-gothic-sheet'],
    template: '/marketplace/rulesets/wod20th/templates/character-sheet.hbs',
    width: 840,
    height: 820,
    resizable: true,
    submitOnChange: true
  };

  constructor(options = {}) {
    super(options);
    this._selectedAttribute = null;
    this._activeTab = 'stats';
    this._openDisciplines = new Set();
  }

  async mount() {
    if (typeof super.mount === 'function') await super.mount();
    this._applyActiveTab();
    this._detachSideTabs();
  }

  _postRender() {
    if (typeof super._postRender === 'function') super._postRender();
    this._applyActiveTab();
    this._detachSideTabs();
  }

  onClose() {
    this._cleanupSideTabs();
    if (typeof super.onClose === 'function') super.onClose();
  }

  /**
   * Padrão canônico e estável do SDR5E para abas laterais flutuantes:
   * Desanexa o elemento `.cp-side-tabs` do interior da janela e re-anexa como
   * irmão direto no container de janelas (`#windows`).
   * Sincroniza a posição e o z-index exato a cada frame via requestAnimationFrame,
   * garantindo que nunca seja cortado por overflow, nunca caia atrás do canvas
   * e NUNCA sobreponha janelas ativas que estiverem em foco acima dela.
   */
  _detachSideTabs() {
    const nav = this.element?.querySelector('.cp-side-tabs');
    if (!nav) return;
    this._cleanupSideTabs();
    const container = this.element?.parentElement;
    if (!container) return;
    container.appendChild(nav);
    nav.style.position = 'fixed';

    nav.addEventListener('pointerdown', () => {
      if (typeof this.bringToTop === 'function') this.bringToTop();
      else if (this.element?.focus) this.element.focus();
    });

    nav.addEventListener('click', (event) => {
      const btn = event.target instanceof Element ? event.target.closest('[data-action], [data-tab]') : null;
      if (!btn) return;
      if (btn.dataset.action === 'quick-roll') {
        openRollDialog({ actor: this.document });
        return;
      }
      const tab = btn.dataset.tab;
      if (tab) {
        this._activeTab = tab;
        this._applyActiveTab();
      }
      const action = btn.dataset.action;
      const id = btn.dataset.id || btn.closest('[data-id]')?.dataset.id || null;
      if (action && action !== 'tab' && typeof this.onAction === 'function') this.onAction(action, id, btn);
    });

    this._sideTabsEl = nav;
    const sync = () => {
      if (!this._sideTabsEl?.isConnected || !this.element?.isConnected) return;
      const r = this.element.getBoundingClientRect();
      const winZ = this.element.style.zIndex || window.getComputedStyle(this.element).zIndex;
      if (winZ && winZ !== 'auto') {
        this._sideTabsEl.style.zIndex = winZ;
      }
      // Encostado na borda esquerda da janela (trilho de 40px de largura)
      this._sideTabsEl.style.left = `${r.left - 40}px`;
      this._sideTabsEl.style.top = `${r.top + 36}px`;
      this._sideTabsRaf = requestAnimationFrame(sync);
    };
    sync();
  }

  _cleanupSideTabs() {
    if (this._sideTabsRaf) cancelAnimationFrame(this._sideTabsRaf);
    this._sideTabsRaf = null;
    this._sideTabsEl?.remove();
    this._sideTabsEl = null;
  }

  _applyActiveTab() {
    const root = this.element;
    if (!root) return;
    const tab = this._activeTab || 'stats';
    (this._sideTabsEl || root).querySelectorAll('.wod-tab-btn').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.tab === tab);
    });
    root.querySelectorAll('.wod-tab-pane').forEach((panel) => {
      panel.classList.toggle('active', panel.dataset.tab === tab);
    });
  }

  async _prepareContext(options) {
    const base = (typeof super._prepareContext === 'function') ? await super._prepareContext(options) : {};
    const data = await this.getData(options);
    return { ...base, ...data };
  }

  async getData(options = {}) {
    const context = (typeof super.getData === 'function') ? await super.getData(options) : {};
    const system = this.document?.systemData || {};
    const derived = system.derived || {};
    const actorType = this.document?.type || 'mortal';

    context.system = system;
    context.derived = derived;
    context.actor = this.document;
    context.isEditable = this.isEditable;
    context.activeTab = this._activeTab;
    const themes = await loadThemeConfig();
    context.themeConfig = themes[actorType] || {};
    const doc = this.document || {};
    const defaultPortrait = '/icons/svg/adventurer.svg';
    const portraitUrl = doc.avatarUrl || doc.imgUrl || doc.img || defaultPortrait;
    const hasCustomPortrait = Boolean(doc.avatarUrl || doc.imgUrl || doc.img);

    context.img = portraitUrl;
    context.portraitUrl = portraitUrl;
    context.hasCustomPortrait = hasCustomPortrait;
    context.hasCustomPortrait = hasCustomPortrait;

    // Flags de criatura
    context.isVampire = actorType === 'vampire';
    context.isWerewolf = actorType === 'werewolf';
    context.isMage = actorType === 'mage';
    context.isChangeling = actorType === 'changeling';
    context.isWraith = actorType === 'wraith';
    context.isMortal = actorType === 'mortal';
    context.isHunter = actorType === 'hunter';

    // 1. Atributos & Habilidades (Comuns)
    context.attributeGroups = this._prepareAttributeGroups(system.attributes || {}, derived.activeAttributes);
    context.abilityGroups = this._prepareAbilityGroups(system.abilities || {});

    // 2. Vitalidade (Comum)
    context.healthTrack = this._prepareHealthTrack(system.health || {});

    // 3. Força de Vontade (Comum)
    context.willpowerDots = this._buildDotsArray(system.willpower?.max || 1, 10);
    context.willpowerBoxes = this._buildBoxesArray(system.willpower?.value || 0, system.willpower?.max || 10);

    // 4. Recursos de Vampiro
    if (context.isVampire) {
      const genLimits = getVampireGenerationLimits(system.profile?.generation || '13ª');
      derived.bloodMax = genLimits.maxBlood;
      derived.bloodPerTurn = genLimits.bloodPerTurn;
      derived.maxTrait = genLimits.maxTrait;

      context.virtuesList = this._prepareVirtues(system.virtues || {});
      context.humanityDots = this._buildDotsArray(system.humanity?.value || 1, 10);
      const catalog = await loadDisciplines();
      await this._migrateDisciplineRatings(catalog);
      const fullTree = this._prepareDisciplineTree(system, derived.activeAttributes || system.attributes || {}, catalog);
      context.disciplineTree = fullTree.filter(d => d.dots > 0);
      context.availableDisciplines = fullTree.filter(d => d.dots === 0).map(d => ({ key: d.key, name: d.name }));
      const currentBlood = system.blood?.value !== undefined ? system.blood.value : genLimits.maxBlood;
      context.bloodBoxes = this._buildBoxesArray(currentBlood, genLimits.maxBlood);
    }

    // 5. Recursos de Lobisomem
    if (context.isWerewolf) {
      context.rageDots = this._buildDotsArray(system.rage?.max || 1, 10);
      context.rageBoxes = this._buildBoxesArray(system.rage?.value || 0, 10);
      context.gnosisDots = this._buildDotsArray(system.gnosis?.max || 1, 10);
      context.gnosisBoxes = this._buildBoxesArray(system.gnosis?.value || 0, 10);

      const activeFormKey = system.activeForm || 'homid';
      context.activeFormKey = activeFormKey;
      context.activeFormDetails = WEREWOLF_FORMS[activeFormKey] || WEREWOLF_FORMS.homid;
      context.werewolfFormsList = this._prepareWerewolfForms(activeFormKey);
    }

    // 6. Recursos de Mago
    if (context.isMage) {
      context.areteDots = this._buildDotsArray(system.arete?.value || 1, 10);
      context.quintessenceBoxes = this._buildBoxesArray(system.quintessence?.value || 0, 20);
      context.paradoxBoxes = this._buildBoxesArray(system.paradox?.value || 0, 20);
      // Roda de 20 posições: cada posição tem uma caixa de quintessência e uma de paradoxo
      const quintVal = parseInt(system.quintessence?.value, 10) || 0;
      const paradoxVal = parseInt(system.paradox?.value, 10) || 0;
      // Roda: duas trilhas de 20 posições em anel (quintessência por fora, paradoxo por dentro)
      const ring = (value, r) => Array.from({ length: 20 }, (_, i) => {
        const a = (-90 + i * 18) * Math.PI / 180;
        return {
          index: i + 1,
          filled: value >= i + 1,
          x: (50 + r * Math.cos(a)).toFixed(2),
          y: (50 + r * Math.sin(a)).toFixed(2)
        };
      });
      context.quintessenceRing = Array.from({ length: 20 }, (_, s) => {
        const a = (180 + s * 18) * Math.PI / 180;
        const quintOn = s < quintVal;
        const paradoxOn = s >= 20 - paradoxVal;
        return {
          index: s + 1,
          quintOn,
          paradoxOn,
          cancelled: quintOn && paradoxOn,
          x: (50 + 42 * Math.cos(a)).toFixed(2),
          y: (50 + 42 * Math.sin(a)).toFixed(2)
        };
      });
      context.paradoxValue = paradoxVal;
      context.quintessenceValue = quintVal;
      context.mageSpheresList = this._prepareMageSpheres(system.spheres || {});
    }

    // 7. Recursos de Changeling
    if (context.isChangeling) {
      context.glamourBoxes = this._buildBoxesArray(system.glamour?.value || 0, 10);
      context.banalityDots = this._buildDotsArray(system.banality?.value || 1, 10);
      context.nightmareDots = this._buildDotsArray(system.nightmare?.value || 0, 10);
    }

    // 8. Recursos de Wraith
    if (context.isWraith) {
      context.corpusBoxes = this._buildBoxesArray(system.corpus?.value || 0, 10);
      context.pathosBoxes = this._buildBoxesArray(system.pathos?.value || 0, 10);
      context.angstDots = this._buildDotsArray(system.angst?.value || 0, 10);
    }

    // 9. Recursos de Mortal / Hunter
    if (context.isMortal || context.isHunter) {
      context.virtuesList = context.isHunter ? this._prepareHunterVirtues(system.virtues || {}) : this._prepareVirtues(system.virtues || {});
      if (!context.isHunter) context.humanityDots = this._buildDotsArray(system.humanity?.value || 7, 10);
      if (context.isHunter) {
        context.convictionDots = this._buildDotsArray(system.conviction?.max || 10, 10);
        context.convictionBoxes = this._buildBoxesArray(system.conviction?.value || 3, 10);
      }
    }

    // 10a. Experiência: registro de ganhos e gastos (fonte dos totais de xp)
    const xpLog = Array.isArray(system.xpLog) ? system.xpLog : [];
    const xpEarned = xpLog.filter(e => e.kind === 'earn').reduce((a, e) => a + (parseInt(e.amount, 10) || 0), 0);
    const xpSpent = xpLog.filter(e => e.kind === 'spend').reduce((a, e) => a + (parseInt(e.amount, 10) || 0), 0);
    context.xpSummary = { earned: xpEarned, spent: xpSpent, available: xpEarned - xpSpent };
    context.xpLog = xpLog.map((e, idx) => ({ ...e, index: idx, isEarn: e.kind === 'earn' }));

    // 10. Categorização Completa dos 24 Itens
    const discCatalog = await loadDisciplines();
    context.itemsCategorized = this._prepareItems(discCatalog);

    // 11. Disciplinas Inline
    const rawDisciplines = Array.isArray(system.disciplines) ? system.disciplines : [];
    context.inlineDisciplines = rawDisciplines.map((d, idx) => ({
      idx,
      name: d?.name || '',
      value: parseInt(d?.value, 10) || 0,
      dots: this._buildDotsArray(parseInt(d?.value, 10) || 0, 5)
    }));

    // 12. Antecedentes Inline
    const rawBackgrounds = Array.isArray(system.backgrounds) ? system.backgrounds : [];
    context.inlineBackgrounds = rawBackgrounds.map((b, idx) => ({
      idx,
      name: b?.name || '',
      value: parseInt(b?.value, 10) || 0,
      dots: this._buildDotsArray(parseInt(b?.value, 10) || 0, 5)
    }));

    // 13. Rituais Inline
    const rawRituals = Array.isArray(system.rituals) ? system.rituals : [];
    context.inlineRituals = rawRituals.map((r, idx) => ({
      idx,
      name: r?.name || '',
      value: parseInt(r?.value, 10) || 1,
      dots: this._buildDotsArray(parseInt(r?.value, 10) || 1, 5)
    }));

    return context;
  }

  _buildDotsArray(value, max = 5) {
    const dots = [];
    for (let i = 1; i <= max; i++) {
      dots.push({ index: i, filled: i <= value });
    }
    return dots;
  }

  /**
   * Árvore fixa de disciplinas do catálogo V20. O personagem guarda só a
   * pontuação em `systemData.disciplineRatings[chave]`; os poderes vêm do catálogo.
   * Um poder fica ativo quando o nível do poder é <= pontos da disciplina.
   */
  _prepareDisciplineTree(system, attrs, catalog) {
    const ratings = system.disciplineRatings || {};
    const abilities = system.abilities || {};
    return Object.entries(catalog).map(([key, disc]) => {
      const dots = Math.min(5, parseInt(ratings[key], 10) || 0);
      return {
        key,
        name: disc.name,
        dots,
        open: this._openDisciplines.has(key),
        dotsArr: this._buildDotsArray(dots, 5),
        powers: disc.powers.map(p => {
          const attrVal = p.poolAttribute === 'willpower'
            ? (parseInt(system.willpower?.value, 10) || 0)
            : (parseInt(attrs[p.poolAttribute], 10) || 0);
          const abVal = p.poolAbility ? (parseInt(abilities[p.poolAbility]?.value, 10) || 0) : 0;
          const attrLabel = t(`system.attributes.${p.poolAttribute}`, p.poolAttribute);
          const abLabel = p.poolAbility ? t(`system.abilities.${p.poolAbility}`, p.poolAbility) : '';
          return {
            level: p.level,
            name: p.name,
            cost: p.cost,
            duration: p.duration,
            description: p.description,
            difficulty: p.difficulty,
            pool: Math.max(1, attrVal + abVal),
            poolText: abLabel ? `${attrLabel} + ${abLabel}` : attrLabel,
            active: p.level <= dots
          };
        })
      };
    });
  }

  _buildBoxesArray(value, max = 10) {
    const boxes = [];
    for (let i = 1; i <= max; i++) {
      boxes.push({ index: i, checked: i <= value });
    }
    return boxes;
  }

  _prepareAttributeGroups(attributes, activeFormAttributes) {
    // Se estiver em forma de Lobisomem com bônus, exibe o valor ativo
    const effective = activeFormAttributes || attributes;

    return [
      {
        key: 'physical',
        labelKey: 'system.attributes.physical',
        attributes: [
          { key: 'strength', labelKey: 'system.attributes.strength', path: 'attributes.strength', value: effective.strength || 1, baseValue: attributes.strength || 1, dots: this._buildDotsArray(attributes.strength || 1, 5) },
          { key: 'dexterity', labelKey: 'system.attributes.dexterity', path: 'attributes.dexterity', value: effective.dexterity || 1, baseValue: attributes.dexterity || 1, dots: this._buildDotsArray(attributes.dexterity || 1, 5) },
          { key: 'stamina', labelKey: 'system.attributes.stamina', path: 'attributes.stamina', value: effective.stamina || 1, baseValue: attributes.stamina || 1, dots: this._buildDotsArray(attributes.stamina || 1, 5) }
        ]
      },
      {
        key: 'social',
        labelKey: 'system.attributes.social',
        attributes: [
          { key: 'charisma', labelKey: 'system.attributes.charisma', path: 'attributes.charisma', value: effective.charisma || 1, baseValue: attributes.charisma || 1, dots: this._buildDotsArray(attributes.charisma || 1, 5) },
          { key: 'manipulation', labelKey: 'system.attributes.manipulation', path: 'attributes.manipulation', value: effective.manipulation ?? 1, baseValue: attributes.manipulation || 1, dots: this._buildDotsArray(attributes.manipulation || 1, 5) },
          { key: 'appearance', labelKey: 'system.attributes.appearance', path: 'attributes.appearance', value: effective.appearance ?? 1, baseValue: attributes.appearance || 1, dots: this._buildDotsArray(attributes.appearance || 1, 5) }
        ]
      },
      {
        key: 'mental',
        labelKey: 'system.attributes.mental',
        attributes: [
          { key: 'perception', labelKey: 'system.attributes.perception', path: 'attributes.perception', value: effective.perception || 1, baseValue: attributes.perception || 1, dots: this._buildDotsArray(attributes.perception || 1, 5) },
          { key: 'intelligence', labelKey: 'system.attributes.intelligence', path: 'attributes.intelligence', value: effective.intelligence || 1, baseValue: attributes.intelligence || 1, dots: this._buildDotsArray(attributes.intelligence || 1, 5) },
          { key: 'wits', labelKey: 'system.attributes.wits', path: 'attributes.wits', value: effective.wits || 1, baseValue: attributes.wits || 1, dots: this._buildDotsArray(attributes.wits || 1, 5) }
        ]
      }
    ];
  }

  _prepareAbilityGroups(abilities) {
    const talents = [
      { key: 'alertness', labelKey: 'system.abilities.alertness' },
      { key: 'athletics', labelKey: 'system.abilities.athletics' },
      { key: 'awareness', labelKey: 'system.abilities.awareness' },
      { key: 'brawl', labelKey: 'system.abilities.brawl' },
      { key: 'empathy', labelKey: 'system.abilities.empathy' },
      { key: 'expression', labelKey: 'system.abilities.expression' },
      { key: 'intimidation', labelKey: 'system.abilities.intimidation' },
      { key: 'leadership', labelKey: 'system.abilities.leadership' },
      { key: 'streetwise', labelKey: 'system.abilities.streetwise' },
      { key: 'subterfuge', labelKey: 'system.abilities.subterfuge' }
    ];

    const skills = [
      { key: 'animalKen', labelKey: 'system.abilities.animalKen' },
      { key: 'crafts', labelKey: 'system.abilities.crafts' },
      { key: 'drive', labelKey: 'system.abilities.drive' },
      { key: 'etiquette', labelKey: 'system.abilities.etiquette' },
      { key: 'firearms', labelKey: 'system.abilities.firearms' },
      { key: 'security', labelKey: 'system.abilities.security' },
      { key: 'melee', labelKey: 'system.abilities.melee' },
      { key: 'performance', labelKey: 'system.abilities.performance' },
      { key: 'stealth', labelKey: 'system.abilities.stealth' },
      { key: 'survival', labelKey: 'system.abilities.survival' }
    ];

    const knowledges = [
      { key: 'academics', labelKey: 'system.abilities.academics' },
      { key: 'computer', labelKey: 'system.abilities.computer' },
      { key: 'finance', labelKey: 'system.abilities.finance' },
      { key: 'investigation', labelKey: 'system.abilities.investigation' },
      { key: 'law', labelKey: 'system.abilities.law' },
      { key: 'medicine', labelKey: 'system.abilities.medicine' },
      { key: 'occult', labelKey: 'system.abilities.occult' },
      { key: 'politics', labelKey: 'system.abilities.politics' },
      { key: 'science', labelKey: 'system.abilities.science' },
      { key: 'technology', labelKey: 'system.abilities.technology' }
    ];

    const formatGroup = (groupKey, groupLabelKey, list) => ({
      key: groupKey,
      labelKey: groupLabelKey,
      abilities: list.map(item => {
        const raw = abilities[item.key];
        const val = typeof raw === 'object' && raw !== null ? (raw.value ?? 0) : (raw ?? 0);
        const spec = typeof raw === 'object' && raw !== null ? (raw.specialty || '') : '';
        return {
          key: item.key,
          labelKey: item.labelKey,
          path: `abilities.${item.key}`,
          value: val,
          specialty: spec,
          dots: this._buildDotsArray(val, 5)
        };
      })
    });

    return [
      formatGroup('talents', 'system.sheet.talents', talents),
      formatGroup('skills', 'system.sheet.skills', skills),
      formatGroup('knowledges', 'system.sheet.knowledges', knowledges)
    ];
  }

  /** Virtudes da 1ª edição do Caçador: Misericórdia, Visão e Zelo (escala de 1 a 10). */
  _prepareHunterVirtues(virtues) {
    const keys = ['mercy', 'vision', 'zeal'];
    return keys.map(key => ({
      key,
      labelKey: `system.virtues.${key}`,
      value: virtues[key] || 1,
      path: `virtues.${key}`,
      dots: this._buildDotsArray(virtues[key] || 1, 10)
    }));
  }

  _prepareVirtues(virtues) {
    return [
      { key: 'conscience', labelKey: 'system.virtues.conscience', value: virtues.conscience || 1, path: 'virtues.conscience', dots: this._buildDotsArray(virtues.conscience || 1, 5) },
      { key: 'selfControl', labelKey: 'system.virtues.selfControl', value: virtues.selfControl || 1, path: 'virtues.selfControl', dots: this._buildDotsArray(virtues.selfControl || 1, 5) },
      { key: 'courage', labelKey: 'system.virtues.courage', value: virtues.courage || 1, path: 'virtues.courage', dots: this._buildDotsArray(virtues.courage || 1, 5) }
    ];
  }

  _prepareWerewolfForms(activeFormKey) {
    return Object.values(WEREWOLF_FORMS).map(f => {
      const modsList = [];
      if (f.modifiers.strength) modsList.push(`For +${f.modifiers.strength}`);
      if (f.modifiers.dexterity) modsList.push(`Des +${f.modifiers.dexterity}`);
      if (f.modifiers.stamina) modsList.push(`Vig +${f.modifiers.stamina}`);
      if (f.modifiers.manipulation !== 0) modsList.push(`Man ${f.modifiers.manipulation}`);
      if (f.modifiers.appearance !== 0) modsList.push(`Apa ${f.modifiers.appearance}`);

      return {
        ...f,
        isActive: f.key === activeFormKey,
        modsText: modsList.join(', ')
      };
    });
  }

  _prepareMageSpheres(spheres) {
    return MAGE_SPHERES.map(sphereKey => {
      const val = spheres[sphereKey] || 0;
      return {
        key: sphereKey,
        labelKey: `system.mage.spheres.${sphereKey}`,
        value: val,
        dots: this._buildDotsArray(val, 5)
      };
    });
  }

  _prepareHealthTrack(health) {
    const defaultLevels = [
      { id: 'bruised', labelKey: 'system.health.bruised', penalty: 0 },
      { id: 'hurt', labelKey: 'system.health.hurt', penalty: -1 },
      { id: 'injured', labelKey: 'system.health.injured', penalty: -1 },
      { id: 'wounded', labelKey: 'system.health.wounded', penalty: -2 },
      { id: 'mauled', labelKey: 'system.health.mauled', penalty: -2 },
      { id: 'crippled', labelKey: 'system.health.crippled', penalty: -5 },
      { id: 'incapacitated', labelKey: 'system.health.incapacitated', penalty: 0 }
    ];

    const currentLevels = health.levels || {};
    return defaultLevels.map(lvl => {
      const state = currentLevels[lvl.id] || 'none';
      let symbol = '';
      if (state === 'bashing') symbol = '/';
      else if (state === 'lethal') symbol = 'X';
      else if (state === 'aggravated') symbol = '★';

      return {
        ...lvl,
        state,
        symbol,
        isPenalized: lvl.penalty < 0
      };
    });
  }

  async _migrateDisciplineRatings(catalog) {
    if (!this.isEditable) return;
    const system = this.document.systemData || {};
    const ratings = system.disciplineRatings;
    if (!ratings || typeof ratings !== 'object') return;
    const entries = Object.entries(ratings).filter(([k, v]) => parseInt(v, 10) > 0);
    if (!entries.length) return;

    const loomApi = api || window.Loom?.api;
    const actorId = this.actorId;
    if (!loomApi || !actorId) return;

    let itemsCreated = false;
    const currentItems = [...(this.document.items || [])];

    for (const [key, rating] of entries) {
      const disc = catalog[key] || { name: key, powers: [] };
      const exists = currentItems.some(i => (i.name || '').toLowerCase() === (disc.name || '').toLowerCase());
      if (!exists) {
        try {
          const data = {
            level: parseInt(rating, 10) || 1,
            maxLevel: 5,
            disciplineKey: key,
            powers: disc.powers || [],
            description: disc.description || ''
          };
          const res = await loomApi.post(`/actors/${actorId}/items`, {
            name: disc.name,
            type: 'discipline',
            data,
            systemData: data
          });
          const created = res?.data || res;
          if (created) {
            currentItems.push(created);
            itemsCreated = true;
          }
        } catch (err) {
          console.error('[wod20th] Erro ao migrar disciplina legada:', err);
        }
      }
    }

    try {
      await loomApi.put(`/actors/${actorId}`, {
        'systemData.disciplineRatings': null,
        ...(itemsCreated ? { items: currentItems } : {})
      });
      if (this.document.systemData) {
        delete this.document.systemData.disciplineRatings;
      }
      if (itemsCreated) {
        this.document.items = currentItems;
      }
    } catch (_) {}
  }

  _prepareItems(catalog = {}) {
    const rawItems = this.document.items || [];
    const attrs = this.document.systemData?.derived?.activeAttributes || this.document.systemData?.attributes || {};
    const abilities = this.document.systemData?.abilities || {};
    const willpower = this.document.systemData?.willpower || {};

    const items = rawItems.map(item => {
      const system = { ...(item.data || {}), ...(item.systemData || {}) };
      const level = Math.max(0, parseInt(system.level ?? system.rating ?? item.level ?? 1, 10));
      const maxLevel = Math.max(1, parseInt(system.maxLevel, 10) || 5);
      const dots = [];
      for (let d = 1; d <= maxLevel; d++) {
        dots.push({ index: d, filled: d <= level });
      }

      const itemId = item.id || item._id;

      // Se for disciplina, prepara poderes e pools para exibição e rolagem
      let powers = [];
      if (item.type === 'discipline') {
        const rawPowers = Array.isArray(system.powers) && system.powers.length > 0
          ? system.powers
          : (catalog[system.disciplineKey]?.powers ||
             Object.values(catalog).find(c => (c.name || '').toLowerCase() === (item.name || '').toLowerCase())?.powers ||
             []);

        powers = rawPowers.map(p => {
          const attrVal = p.poolAttribute === 'willpower'
            ? (parseInt(willpower.value, 10) || 0)
            : (parseInt(attrs[p.poolAttribute], 10) || 0);
          const abRaw = abilities[p.poolAbility];
          const abVal = p.poolAbility ? (parseInt(abRaw?.value ?? abRaw, 10) || 0) : 0;
          const attrLabel = t(`system.attributes.${p.poolAttribute}`, p.poolAttribute);
          const abLabel = p.poolAbility ? t(`system.abilities.${p.poolAbility}`, p.poolAbility) : '';
          const pool = Math.max(1, attrVal + abVal);
          return {
            level: p.level,
            name: p.name,
            cost: p.cost || '',
            duration: p.duration || '',
            description: p.description || '',
            difficulty: p.difficulty || 6,
            pool,
            poolText: abLabel ? `${attrLabel} + ${abLabel}` : attrLabel,
            active: p.level <= level
          };
        });
      }

      return {
        ...item,
        id: itemId,
        data: system,
        systemData: system,
        level,
        maxLevel,
        dots,
        powers,
        open: this._openDisciplines.has(itemId)
      };
    });

    return {
      weapons: items.filter(i => i.type === 'weapon'),
      armors: items.filter(i => i.type === 'armor'),
      disciplines: items.filter(i => i.type === 'discipline'),
      rituals: items.filter(i => i.type === 'ritual'),
      gifts: items.filter(i => i.type === 'gift'),
      rites: items.filter(i => i.type === 'rite'),
      fetishes: items.filter(i => i.type === 'fetish'),
      talens: items.filter(i => i.type === 'talen'),
      totems: items.filter(i => i.type === 'totem'),
      rotes: items.filter(i => i.type === 'rote'),
      wonders: items.filter(i => i.type === 'wonder' || i.type === 'talisman'),
      artifacts: items.filter(i => i.type === 'artifact'),
      grimoires: items.filter(i => i.type === 'grimoire'),
      arts: items.filter(i => i.type === 'art'),
      realms: items.filter(i => i.type === 'realm'),
      arcanoi: items.filter(i => i.type === 'arcanoi'),
      backgrounds: items.filter(i => i.type === 'background'),
      meritsFlaws: items.filter(i => i.type === 'merit' || i.type === 'flaw'),
      merits: items.filter(i => i.type === 'merit'),
      flaws: items.filter(i => i.type === 'flaw'),
      edges: items.filter(i => i.type === 'power' || i.type === 'edge'),
      gear: items.filter(i => i.type === 'gear' || i.type === 'condition'),
      derangements: items.filter(i => i.type === 'derangement'),
      passions: items.filter(i => i.type === 'passion')
    };
  }

  /**
   * Abre a interface visual de edição de arte do personagem oficial do LoomVTT.
   * Prioridade 1: Loom.openPortraitEditor(actor) (editor de token/retrato em camadas)
   * Prioridade 2: FilePickerWindow padrão do LoomVTT com persistência em avatarUrl e img
   */
  get actorId() {
    return this.document?.id || this.options?.actorId || this.options?.documentId || this.documentId;
  }

  async _reloadDocument() {
    const id = this.actorId;
    if (!id) return;
    const loomApi = api || window.Loom?.api;
    if (loomApi) {
      try {
        const row = await loomApi.get(`/actors/${id}?populate=true`);
        if (row) {
          this.document = (typeof this._runPrepareData === 'function') ? await this._runPrepareData(row) : row;
        }
      } catch (err) {
        console.error('[wod20th] Erro ao recarregar ator:', err);
      }
    }
    if (typeof this.rerenderBody === 'function') {
      this.rerenderBody();
    } else if (typeof this.render === 'function') {
      await this.render();
    }
  }

  async updateActor(patch = {}) {
    const actorId = this.actorId;
    if (!actorId) return;

    const loomApi = api || window.Loom?.api;
    const sd = JSON.parse(JSON.stringify(this.document?.systemData || {}));
    let hasSdUpdate = false;
    const topLevelUpdate = {};

    for (const [key, value] of Object.entries(patch)) {
      if (key.startsWith('systemData.')) {
        const subPath = key.slice('systemData.'.length);
        setPath(sd, subPath, value);
        hasSdUpdate = true;
      } else if (key === 'systemData') {
        Object.assign(sd, value);
        hasSdUpdate = true;
      } else {
        topLevelUpdate[key] = value;
      }
    }

    const submitData = { ...topLevelUpdate };
    if (hasSdUpdate) {
      const { derived: _drop, ...restSd } = sd;
      submitData.systemData = restSd;
    }

    if (loomApi) {
      try {
        await loomApi.put(`/actors/${actorId}`, submitData);
      } catch (err) {
        console.error('[wod20th] Falha ao persistir ator via API:', err);
      }
    }

    await this._reloadDocument();
  }

  _wireNativeFieldSave() {
    if (this._nativeFieldWired) return;
    this._nativeFieldWired = true;
    this.element.addEventListener('change', async (e) => {
      const target = e.target;
      if (!target || !target.name) return;
      if (!target.isConnected) return;
      const value = target.type === 'checkbox' ? target.checked
        : target.type === 'number' ? (Number(target.value) || 0)
        : target.value;

      if (target.name === 'name') {
        await this.updateActor({ name: value });
      } else if (target.name.startsWith('systemData.')) {
        await this.updateActor({ [target.name]: value });
      }
    });
  }

  async onEditPortrait(event) {
    if (event?.preventDefault) event.preventDefault();
    if (!this.isEditable) return;
    const actor = this.document;
    if (!actor) return;

    // 1. Editor de Retrato e Token integrado do LoomVTT
    if (typeof window.Loom?.openPortraitEditor === 'function' && actor.id) {
      window.Loom.openPortraitEditor(actor);
      return;
    }

    // 2. Seletor de Arquivos (FilePickerWindow) padrão do LoomVTT
    const Loom = window.Loom;
    if (Loom?.windowManager?.open && Loom?.windows?.FilePickerWindow) {
      Loom.windowManager.open('file-picker', Loom.windows.FilePickerWindow, {
        current: actor.avatarUrl || actor.imgUrl || actor.img || '',
        type: 'image',
        onSelect: async (path) => {
          await this.updateActor({
            avatarUrl: path,
            img: path
          });
        }
      });
      return;
    }

    // 3. Fallback para dispatcher da classe base
    if (typeof super.onAction === 'function') {
      super.onAction('pick-portrait', null, event?.currentTarget);
    }
  }

  async onAction(action, id, target) {
    if (action === 'pick-portrait' || action === 'editImage') {
      return this.onEditPortrait();
    }
    if (action === 'open-item') {
      return this.openItemSheet(id);
    }
    if (action === 'delete-item') {
      return this.deleteItem(id);
    }
    return super.onAction?.(action, id, target);
  }

  /**
   * Janela para registrar ganho ou gasto de experiência.
   * Os totais (xp.total e xp.unspent) são recalculados a partir do registro.
   */
  async openAddXpDialog() {
    if (!this.isEditable) return;
    const DialogClass = window.Loom?.LoomDialog || LoomDialog;
    if (!DialogClass?.wait) return;
    const cats = ['Sessão', 'Marco de história', 'Atributo', 'Habilidade', 'Disciplina', 'Virtude', 'Antecedente', 'Força de Vontade', 'Outro'];
    const options = cats.map(c => `<option value="${c}">${c}</option>`).join('');
    const result = await DialogClass.wait({
      window: { title: 'Registrar Experiência' },
      width: 420,
      content: `<div class="wod-xp-dialog">
        <label>Tipo</label>
        <select name="xp_kind" class="wod-select">
          <option value="earn">Ganho</option>
          <option value="spend">Gasto</option>
        </select>
        <label>Categoria</label>
        <select name="xp_cat" class="wod-select">${options}</select>
        <label>Descrição</label>
        <input type="text" name="xp_note" class="wod-select" />
        <label>Pontos</label>
        <input type="number" name="xp_amount" min="1" value="1" class="wod-select" />
      </div>`,
      buttons: [
        {
          action: 'add',
          label: 'Registrar',
          variant: 'primary',
          default: true,
          callback: (ev, btn, dlg) => {
            const body = dlg.getBody ? dlg.getBody() : dlg.element;
            const amount = parseInt(body?.querySelector('input[name="xp_amount"]')?.value, 10) || 0;
            if (amount <= 0) return null;
            return {
              kind: body?.querySelector('select[name="xp_kind"]')?.value || 'earn',
              category: body?.querySelector('select[name="xp_cat"]')?.value || 'Outro',
              note: body?.querySelector('input[name="xp_note"]')?.value?.trim() || '',
              amount
            };
          }
        },
        { action: 'cancel', label: 'Cancelar', variant: 'ghost', callback: () => null }
      ]
    });
    if (!result) return;
    await this._saveXpLog([...(this.document.systemData?.xpLog || []), result]);
  }

  /** Salva o registro e recalcula xp.total (ganho) e xp.unspent (não gasto). */
  async _saveXpLog(log) {
    const earned = log.filter(e => e.kind === 'earn').reduce((a, e) => a + (parseInt(e.amount, 10) || 0), 0);
    const spent = log.filter(e => e.kind === 'spend').reduce((a, e) => a + (parseInt(e.amount, 10) || 0), 0);
    await this.updateActor({
      'systemData.xpLog': log,
      'systemData.xp.total': earned,
      'systemData.xp.unspent': earned - spent
    });
  }

  /**
   * Pergunta se a rolagem de mudança de forma foi bem-sucedida.
   * O sistema ainda não recebe o resultado do dado, então o jogador confirma.
   */
  async _confirmFormShift(formLabel, question = `A rolagem para <strong>${formLabel}</strong> teve sucesso?`, hint = 'Confirme só se passou no teste. Sem sucesso, a forma não muda.', yesLabel = 'Sucesso, trocar forma') {
    const DialogClass = window.Loom?.LoomDialog || LoomDialog;
    if (!DialogClass?.wait) return false;
    const result = await DialogClass.wait({
      window: { title: 'Mudança de forma' },
      width: 380,
      content: `<div style="padding: 8px; font-size: 13px;">${question}<br/><span style="color:#9e9ea8;font-size:12px;">${hint}</span></div>`,
      buttons: [
        { action: 'yes', label: yesLabel, variant: 'primary', default: true, callback: () => true },
        { action: 'no', label: 'Falhou', variant: 'ghost', callback: () => false }
      ]
    });
    return result === true;
  }

  /**
   * Janela para escolher uma disciplina canônica ou criar customizada.
   * Cria um Item do tipo 'discipline' com poderes oficiais preenchidos e 1 ponto.
   */
  async openAddDisciplineDialog() {
    if (!this.isEditable) return;
    const catalog = await loadDisciplines();
    const existingDisciplines = (this.document.items || []).filter(i => i.type === 'discipline');
    const existingNames = new Set(existingDisciplines.map(d => (d.name || '').toLowerCase().trim()));
    const available = Object.entries(catalog).filter(([k, d]) => !existingNames.has((d.name || '').toLowerCase().trim()));

    let options = '<option value="__custom__">+ Nova / Personalizada...</option>';
    if (available.length) {
      options += available.map(([k, d]) => `<option value="${k}">${d.name} (${d.powers.length} poderes)</option>`).join('');
    }

    const DialogClass = window.Loom?.LoomDialog || LoomDialog;
    if (!DialogClass?.wait) {
      const id = await this.createItem('discipline', { level: 1, maxLevel: 5, powers: [] }, 'Nova Disciplina');
      if (id) await this.openItemSheet(id);
      return;
    }

    const key = await DialogClass.wait({
      window: { title: 'Adicionar Disciplina' },
      width: 420,
      content: `<div class="wod-disc-picker" style="padding: 10px 0;">
        <label class="wod-disc-pick-label" style="display: block; margin-bottom: 6px; font-weight: 600; color: var(--wod-gold, #c9a050);">Escolha a disciplina:</label>
        <select name="disc_pick" class="wod-select wod-disc-select" style="width: 100%;">${options}</select>
      </div>`,
      buttons: [
        {
          action: 'add',
          label: 'Adicionar',
          variant: 'primary',
          default: true,
          callback: (ev, btn, dlg) => {
            const body = dlg.getBody ? dlg.getBody() : dlg.element;
            return body?.querySelector('select[name="disc_pick"]')?.value || null;
          }
        },
        {
          action: 'cancel',
          label: 'Cancelar',
          variant: 'ghost',
          callback: () => null
        }
      ]
    });

    if (!key) return;

    if (key === '__custom__') {
      const id = await this.createItem('discipline', { level: 1, maxLevel: 5, powers: [] }, 'Nova Disciplina');
      if (id) await this.openItemSheet(id);
    } else {
      const disc = catalog[key];
      if (disc) {
        await this.createItem('discipline', {
          level: 1,
          maxLevel: 5,
          disciplineKey: key,
          powers: disc.powers || [],
          description: disc.description || ''
        }, disc.name);
      }
    }
  }

  async openItemSheet(itemId) {
    const item = (this.document?.items || []).find(i => (i.id === itemId || i._id === itemId));
    if (!item) return;
    const ItemSheetClass = sheets.get('item', item.type) || sheets.get('item', '*');
    if (!ItemSheetClass) return;
    const worldId = window.Loom?.world?.id || this.document?.worldId || '';
    await windowManager.open(`item-sheet-${itemId}`, ItemSheetClass, { itemId, document: item, worldId });
  }

  async createItem(type, extraData = {}, customName = null) {
    const actorId = this.actorId;
    if (!type || !actorId) return null;
    const defaultData = {
      level: 1,
      maxLevel: 5,
      poolAttribute: '',
      poolAbility: '',
      difficulty: 6,
      cost: '',
      description: '',
      ...extraData
    };
    const defaultName = customName || (
      type === 'discipline' ? 'Nova Disciplina' :
      type === 'ritual' ? 'Novo Ritual' :
      type === 'gift' ? 'Novo Dom' :
      type === 'rite' ? 'Novo Rito' :
      type === 'weapon' ? 'Nova Arma' :
      type === 'armor' ? 'Nova Armadura' :
      type === 'merit' ? 'Nova Qualidade' :
      type === 'flaw' ? 'Novo Defeito' :
      type === 'background' ? 'Novo Antecedente' :
      type === 'edge' ? 'Nova Borda' :
      type === 'derangement' ? 'Novo Distúrbio' :
      type === 'passion' ? 'Nova Paixão' :
      type === 'power' ? 'Nova Borda / Poder' :
      type === 'rote' ? 'Novo Rote' :
      type === 'grimoire' ? 'Novo Grimório' :
      type === 'wonder' ? 'Nova Maravilha' :
      type === 'fetish' ? 'Novo Fetiche' :
      type === 'talen' ? 'Novo Tali' :
      type === 'totem' ? 'Novo Totem' :
      type === 'art' ? 'Nova Arte' :
      type === 'realm' ? 'Novo Reino' :
      type === 'arcanoi' ? 'Novo Arcanoi' :
      type === 'artifact' ? 'Novo Artefato' :
      `Novo(a) ${type}`
    );

    let createdId = null;
    const loomApi = api || window.Loom?.api;
    if (loomApi) {
      try {
        const payload = {
          name: defaultName,
          type,
          data: defaultData,
          systemData: defaultData,
          imgUrl: ''
        };
        const res = await loomApi.post(`/actors/${actorId}/items`, payload);
        createdId = res?.id || res?.data?.id || res?._id || res?.data?._id;
        const newItem = res?.data || res || { ...payload, id: createdId };
        if (this.document.items && createdId) {
          this.document.items.push(newItem);
        }
      } catch (err) {
        console.error('[wod20th] Erro ao criar item via api:', err);
      }
    }

    await this._reloadDocument();
    return createdId;
  }

  async deleteItem(itemId) {
    if (!itemId) return;
    const loomApi = api || window.Loom?.api;
    if (loomApi) {
      try {
        await loomApi.delete(`/items/${itemId}`);
      } catch (err) {
        console.error('[wod20th] Erro ao excluir item via api:', err);
      }
      const actorId = this.actorId;
      if (actorId && this.document.items) {
        try {
          const nextItems = this.document.items.filter(it => it.id !== itemId && it._id !== itemId);
          await loomApi.put(`/actors/${actorId}`, { items: nextItems });
          this.document.items = nextItems;
        } catch (err) {
          console.warn('[wod20th] Aviso ao sincronizar remoção em actor.items:', err);
        }
      }
    }
    await this._reloadDocument();
  }

  async setItemLevel(itemId, level) {
    if (!itemId) return;
    const cleanLevel = Math.max(0, parseInt(level, 10) || 0);
    const item = (this.document.items || []).find(i => (i.id === itemId || i._id === itemId));
    if (!item) return;

    if (item.data) item.data.level = cleanLevel;
    if (item.systemData) item.systemData.level = cleanLevel;
    item.level = cleanLevel;

    const merged = { ...(item.data || {}), ...(item.systemData || {}), level: cleanLevel };
    const loomApi = api || window.Loom?.api;
    if (loomApi) {
      try {
        await loomApi.put(`/items/${itemId}`, { data: merged, systemData: merged });
      } catch (err) {
        console.error('[wod20th] Erro ao atualizar nível do item via api:', err);
      }
      const actorId = this.actorId;
      if (actorId && this.document.items) {
        try {
          const nextItems = this.document.items.map(it => {
            if (it.id === itemId || it._id === itemId) {
              return { ...it, data: merged, systemData: merged, level: cleanLevel };
            }
            return it;
          });
          await loomApi.put(`/actors/${actorId}`, { items: nextItems });
          this.document.items = nextItems;
        } catch (err) {
          console.warn('[wod20th] Aviso ao sincronizar item em actor.items:', err);
        }
      }
    }
    await this._reloadDocument();
  }

  async healWithBlood() {
    if (!this.isEditable) return;
    const currentBlood = parseInt(this.document.systemData?.blood?.value || 0, 10);
    if (currentBlood <= 0) {
      if (window.Loom?.notifications?.warn) {
        window.Loom.notifications.warn('Sem Pontos de Sangue suficientes para curar!');
      } else {
        alert('Sem Pontos de Sangue suficientes para curar!');
      }
      return;
    }

    const healthLevels = [
      'bruised', 'hurt', 'injured', 'wounded', 'mauled', 'crippled', 'incapacitated'
    ];
    const currentLevels = { ...(this.document.systemData?.health?.levels || {}) };

    // Cura o ferimento letal ou contundente de baixo para cima (mais recente/mais grave)
    let healedLevel = null;
    for (let i = healthLevels.length - 1; i >= 0; i--) {
      const lvl = healthLevels[i];
      const state = currentLevels[lvl];
      if (state === 'bashing' || state === 'lethal') {
        healedLevel = lvl;
        break;
      }
    }

    if (!healedLevel) {
      if (window.Loom?.notifications?.info) {
        window.Loom.notifications.info('Nenhum ferimento contundente ou letal para curar.');
      }
      return;
    }

    currentLevels[healedLevel] = 'none';
    const newBlood = Math.max(0, currentBlood - 1);

    await this.updateActor({
      'systemData.health.levels': currentLevels,
      'systemData.blood.value': newBlood
    });

    if (window.Loom?.notifications?.info) {
      window.Loom.notifications.info(`1 Ponto de Sangue gasto. Ferimento curado (${healedLevel})!`);
    }
  }

  async buffPhysicalAttribute() {
    if (!this.isEditable) return;
    const currentBlood = parseInt(this.document.systemData?.blood?.value || 0, 10);
    if (currentBlood <= 0) {
      if (window.Loom?.notifications?.warn) {
        window.Loom.notifications.warn('Sem Pontos de Sangue suficientes para bombar atributo!');
      } else {
        alert('Sem Pontos de Sangue suficientes para bombar atributo!');
      }
      return;
    }

    const DialogClass = window.Loom?.LoomDialog || LoomDialog;
    const content = `
      <div style="padding: 12px; font-family: 'Cinzel', serif; color: #f5eedf; background: #141216; border-radius: 6px;">
        <p style="font-size: 13px; margin-bottom: 12px; line-height: 1.4;">Gastar 1 Ponto de Sangue para aumentar temporariamente um Atributo Físico em +1 ponto pela duração de uma cena:</p>
        <div style="display: flex; flex-direction: column; gap: 8px; font-family: sans-serif; font-size: 13px;">
          <label style="cursor: pointer; display: flex; align-items: center; gap: 8px;"><input type="radio" name="buff_attr" value="strength" checked style="accent-color: #8b0000;" /> <strong>Força</strong></label>
          <label style="cursor: pointer; display: flex; align-items: center; gap: 8px;"><input type="radio" name="buff_attr" value="dexterity" style="accent-color: #8b0000;" /> <strong>Destreza</strong></label>
          <label style="cursor: pointer; display: flex; align-items: center; gap: 8px;"><input type="radio" name="buff_attr" value="stamina" style="accent-color: #8b0000;" /> <strong>Vigor</strong></label>
        </div>
      </div>
    `;

    if (DialogClass?.wait) {
      const choice = await DialogClass.wait({
        window: { title: '🩸 Bombar Atributo c/ Sangue' },
        width: 360,
        content,
        buttons: [
          {
            action: 'buff',
            label: '🩸 Bombar (+1)',
            variant: 'primary',
            default: true,
            callback: (ev, btn, dlg) => {
              const body = dlg.getBody ? dlg.getBody() : dlg.element;
              const sel = body?.querySelector('input[name="buff_attr"]:checked')?.value || 'strength';
              return sel;
            }
          },
          {
            action: 'cancel',
            label: 'Cancelar',
            variant: 'ghost',
            callback: () => null
          }
        ]
      });

      if (!choice) return;

      const currentVal = parseInt(this.document.systemData?.attributes?.[choice] || 1, 10);
      const newBlood = Math.max(0, currentBlood - 1);

      await this.updateActor({
        [`systemData.attributes.${choice}`]: currentVal + 1,
        'systemData.blood.value': newBlood
      });

      const attrNames = { strength: 'Força', dexterity: 'Destreza', stamina: 'Vigor' };
      if (window.Loom?.notifications?.info) {
        window.Loom.notifications.info(`1 Ponto de Sangue gasto! ${attrNames[choice]} aumentado para ${currentVal + 1} pela cena.`);
      }
    }
  }

  _onRender(context, options) {
    super._onRender?.(context, options);
    const root = this.element;
    if (!root) return;

    this._applyActiveTab();
    this._detachSideTabs();
    this._wireNativeFieldSave();

    // 0. Listener de Arte do Personagem (Editor de Retrato do Loom)
    const portraitFrame = root.querySelector('.wod-portrait-frame');
    if (portraitFrame) {
      portraitFrame.addEventListener('click', (e) => {
        this.onEditPortrait(e);
      });
    }

    // 1. Troca de Abas na Barra Lateral (cp-side-tabs)
    root.querySelectorAll('.wod-tab-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        if (btn.dataset.action === 'quick-roll') {
          openRollDialog({ actor: this.document });
          return;
        }
        const tab = btn.dataset.tab;
        if (!tab) return;
        this._activeTab = tab;
        root.querySelectorAll('.wod-tab-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
        root.querySelectorAll('.wod-tab-pane').forEach(p => p.classList.toggle('active', p.dataset.tab === tab));
      });
    });

    // 2. Bolinhas Clicáveis (Dots)
    root.querySelectorAll('.wod-dot').forEach(dot => {
      dot.addEventListener('click', async (e) => {
        e.preventDefault();
        if (!this.isEditable) return;

        const path = dot.dataset.path;
        const clickedIndex = parseInt(dot.dataset.index, 10);
        const minVal = parseInt(dot.dataset.min || '0', 10);

        // Suporte a arrays inline: "disciplines.0.value", "backgrounds.1.value", "rituals.2.value"
        const inlineMatch = path?.match(/^(disciplines|backgrounds|rituals)\.(\d+)\.value$/);
        if (inlineMatch) {
          const type = inlineMatch[1];
          const idx = parseInt(inlineMatch[2], 10);
          const list = Array.isArray(this.document.systemData?.[type]) ? [...this.document.systemData[type]] : [];
          while (list.length <= idx) {
            list.push({ name: '', value: 0 });
          }
          const currentVal = parseInt(list[idx]?.value, 10) || 0;
          let newVal = clickedIndex;
          if (clickedIndex === currentVal) {
            newVal = Math.max(minVal, clickedIndex - 1);
          }
          list[idx] = { ...list[idx], value: newVal };
          await this.updateActor({ [`systemData.${type}`]: list });
          return;
        }

        const parts = path.split('.');
        let current = this.document.systemData;
        for (const p of parts) {
          current = current ? current[p] : undefined;
        }
        const currentVal = typeof current === 'object' && current !== null ? (current.value || 0) : (current || 0);

        let newVal = clickedIndex;
        if (clickedIndex === currentVal) {
          newVal = Math.max(minVal, clickedIndex - 1);
        }

        const updateData = {};
        if (typeof current === 'object' && current !== null && 'value' in current) {
          updateData[`systemData.${path}.value`] = newVal;
        } else {
          updateData[`systemData.${path}`] = newVal;
        }

        await this.updateActor(updateData);
      });
    });

    // 3. Caixas de Marcação (Boxes)
    root.querySelectorAll('.wod-box').forEach(box => {
      box.addEventListener('click', async (e) => {
        e.preventDefault();
        if (!this.isEditable) return;

        const path = box.dataset.path;
        const clickedIndex = parseInt(box.dataset.index, 10);

        const parts = path.split('.');
        let current = this.document.systemData;
        for (const p of parts) {
          current = current ? current[p] : undefined;
        }
        const currentVal = typeof current === 'object' && current !== null ? (current.value || 0) : (current || 0);

        let newVal = clickedIndex;
        if (clickedIndex === currentVal) {
          newVal = clickedIndex - 1;
        }

        await this.updateActor({
          [`systemData.${path}.value`]: newVal
        });
      });
    });

    // 4. Caixas de Vitalidade (Ciclo de Dano)
    root.querySelectorAll('.wod-health-box').forEach(box => {
      box.addEventListener('click', async (e) => {
        e.preventDefault();
        if (!this.isEditable) return;

        const levelId = box.dataset.level;
        const currentState = this.document.systemData.health?.levels?.[levelId] || 'none';

        const cycle = {
          'none': 'bashing',
          'bashing': 'lethal',
          'lethal': 'aggravated',
          'aggravated': 'none'
        };
        const nextState = cycle[currentState] || 'none';

        await this.updateActor({
          [`systemData.health.levels.${levelId}`]: nextState
        });
      });
    });

    // 5. Rolagem de Atributo (A parada é definida pelo atributo clicado)
    root.querySelectorAll('.wod-roll-attr').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        const attrKey = btn.dataset.attr;
        const attrLabelKey = btn.dataset.labelKey;
        const attrLabel = t(attrLabelKey, attrKey);
        const attrVal = parseInt(btn.dataset.val, 10) || 1;
        openRollDialog({
          actor: this.document,
          traitType: 'attribute',
          traitKey: attrKey,
          traitLabel: attrLabel,
          traitValue: attrVal
        });
      });
    });

    // 6. Rolagem de Habilidade (A parada é definida pela habilidade clicada)
    root.querySelectorAll('.wod-roll-ability').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        const abKey = btn.dataset.ability;
        const abLabelKey = btn.dataset.labelKey;
        const abLabel = t(abLabelKey, abKey);
        const abVal = parseInt(btn.dataset.val, 10) || 0;
        openRollDialog({
          actor: this.document,
          traitType: 'ability',
          traitKey: abKey,
          traitLabel: abLabel,
          traitValue: abVal
        });
      });
    });

    // 7. Gerenciamento Canônico de Itens (Disciplinas, Antecedentes, Rituais, Dons, etc.)
    // 7.1 Botão Adicionar Item (abre a ficha do item imediatamente, SEM PROMPTS NATIVOS)
    root.querySelectorAll('.wod-btn-add-item').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.preventDefault();
        if (!this.isEditable) return;
        const type = btn.dataset.type || 'discipline';
        await this.createItem(type);
      });
    });

    // 7.2 Botão Excluir Item
    root.querySelectorAll('.wod-item-delete-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (!this.isEditable) return;
        const id = btn.dataset.id;
        if (id) await this.deleteItem(id);
      });
    });

    // 7.3 Botão Editar / Abrir Ficha do Item
    root.querySelectorAll('.wod-item-edit-btn, .wod-item-title-clickable, .wod-link-btn').forEach(el => {
      el.addEventListener('click', async (e) => {
        e.preventDefault();
        e.stopPropagation();
        const id = el.dataset.id;
        if (id) await this.openItemSheet(id);
      });
    });

    // 7.4 Bolinhas (Dots) de Nível do Item
    root.querySelectorAll('.wod-item-dot').forEach(dot => {
      dot.addEventListener('click', async (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (!this.isEditable) return;
        const id = dot.dataset.id;
        const clickedIndex = parseInt(dot.dataset.index, 10);
        const item = (this.document.items || []).find(i => (i.id === id || i._id === id));
        if (!item) return;
        const sys = { ...(item.data || {}), ...(item.systemData || {}) };
        const currentVal = parseInt(sys.level ?? item.level ?? 1, 10);
        let newVal = clickedIndex;
        if (clickedIndex === currentVal) {
          newVal = Math.max(0, clickedIndex - 1);
        }
        await this.setItemLevel(id, newVal);
      });
    });

    // 7.5 Rolagem de Poder do Item (Disciplinas, Rituais, Antecedentes, etc.)
    root.querySelectorAll('.wod-roll-item-power').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        const id = btn.dataset.id;
        const item = (this.document.items || []).find(i => i.id === id);
        const systemData = item?.systemData || {};
        const itemName = item?.name || btn.dataset.name || 'Poder';
        const itemLevel = parseInt(systemData.level || btn.dataset.level || 1, 10);
        const poolAttr = systemData.poolAttribute;
        const diff = parseInt(systemData.difficulty, 10) || 6;

        const attrs = this.document.systemData?.derived?.activeAttributes || this.document.systemData?.attributes || {};
        const powers = Array.isArray(systemData.powers) ? systemData.powers : [];

        // Se o item tiver poderes cadastrados (como Disciplinas ou Dons com sub-poderes por nível)
        if (powers.length > 0) {
          const DialogClass = window.Loom?.LoomDialog;
          if (powers.length === 1) {
            const p = powers[0];
            const attrVal = parseInt(attrs[p.poolAttribute] || 0, 10);
            const abVal = parseInt(this.document.systemData?.abilities?.[p.poolAbility]?.value ?? this.document.systemData?.abilities?.[p.poolAbility] ?? 0, 10);
            const pool = (attrVal + abVal) > 0 ? (attrVal + abVal) : itemLevel;
            openRollDialog({
              actor: this.document,
              title: `${itemName}: ${p.name}`,
              pool,
              difficulty: parseInt(p.difficulty, 10) || 6,
              traitLabel: `${itemName}: ${p.name}`,
              traitType: 'power'
            });
            return;
          }

          if (DialogClass?.wait) {
            const powerOptions = powers.map((p, idx) => 
              `<label style="cursor: pointer; display: flex; align-items: center; justify-content: space-between; padding: 6px 10px; background: rgba(255,255,255,0.04); border: 1px solid rgba(200,160,80,0.2); border-radius: 4px; margin-bottom: 6px;">
                <span><input type="radio" name="selected_power" value="${idx}" ${idx === 0 ? 'checked' : ''} style="margin-right: 8px; accent-color: #8b0000;" /> <strong>Nível ${p.level}: ${p.name}</strong></span>
                <span style="font-size: 11px; color: #c9a050;">${p.cost || 'Gratuito'} (Dif ${p.difficulty || 6})</span>
              </label>`
            ).join('');

            DialogClass.wait({
              window: { title: `🩸 ${itemName} - Escolha o Poder` },
              width: 380,
              content: `<div style="font-family: sans-serif; font-size: 13px; color: #f5eedf;">
                <p style="margin-bottom: 10px; line-height: 1.4;">Selecione o poder de <strong>${itemName}</strong> que deseja ativar:</p>
                <div>${powerOptions}</div>
              </div>`,
              buttons: [
                {
                  action: 'roll',
                  label: '🎲 Rolar Poder',
                  variant: 'primary',
                  default: true,
                  callback: (ev, b, dlg) => {
                    const body = dlg.getBody ? dlg.getBody() : dlg.element;
                    const selIdx = parseInt(body?.querySelector('input[name="selected_power"]:checked')?.value || '0', 10);
                    return powers[selIdx] || powers[0];
                  }
                },
                {
                  action: 'cancel',
                  label: 'Cancelar',
                  variant: 'ghost',
                  callback: () => null
                }
              ]
            }).then(chosenPower => {
              if (!chosenPower) return;
              const attrVal = parseInt(attrs[chosenPower.poolAttribute] || 0, 10);
              const abVal = parseInt(this.document.systemData?.abilities?.[chosenPower.poolAbility]?.value ?? this.document.systemData?.abilities?.[chosenPower.poolAbility] ?? 0, 10);
              const pool = (attrVal + abVal) > 0 ? (attrVal + abVal) : itemLevel;
              openRollDialog({
                actor: this.document,
                title: `${itemName}: ${chosenPower.name}`,
                pool,
                difficulty: parseInt(chosenPower.difficulty, 10) || 6,
                traitLabel: `${itemName}: ${chosenPower.name}`,
                traitType: 'power'
              });
            });
            return;
          }
        }

        // Fallback para poder simples sem lista de poderes
        let traitType = 'power';
        let traitKey = 'power';
        let traitLabel = itemName;
        let traitValue = itemLevel;

        if (poolAttr && poolAttr !== 'none' && attrs[poolAttr] !== undefined) {
          traitType = 'attribute';
          traitKey = poolAttr;
          const rawAttr = attrs[poolAttr];
          traitValue = (typeof rawAttr === 'object' && rawAttr !== null) ? (rawAttr.value || 1) : (parseInt(rawAttr, 10) || 1);
          traitLabel = `${itemName} [${t(`system.attributes.${poolAttr}`, poolAttr)}]`;
        }

        openRollDialog({
          actor: this.document,
          title: `Ativação: ${itemName}`,
          traitType,
          traitKey,
          traitLabel,
          traitValue,
          difficulty: diff
        });
      });
    });

    // 7.6 Rolagem de Virtudes Gerais
    root.querySelectorAll('.wod-roll-virtue').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        const vKey = btn.dataset.virtue;
        const vLabel = btn.title || btn.textContent.trim();
        const vVal = parseInt(btn.dataset.val, 10) || 1;
        openRollDialog({
          actor: this.document,
          title: `Rolagem: ${vLabel}`,
          traitType: 'virtue',
          traitKey: vKey,
          traitLabel: vLabel,
          traitValue: vVal,
          difficulty: 6
        });
      });
    });

    // 7.7 Ações Canônicas de Vampiro: Frenesi, Rötschreck, Degeneração/Remorso
    root.querySelectorAll('.wod-roll-frenzy').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        const virtues = this.document.systemData?.virtues || {};
        const val = virtues.selfControl?.value ?? (virtues.selfControl || 1);
        openRollDialog({
          actor: this.document,
          title: '🔥 Resistir ao Frenesi (Autocontrole)',
          traitType: 'virtue',
          traitKey: 'selfControl',
          traitLabel: 'Autocontrole',
          traitValue: val,
          difficulty: 6
        });
      });
    });

    root.querySelectorAll('.wod-roll-rotschreck').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        const virtues = this.document.systemData?.virtues || {};
        const val = virtues.courage?.value ?? (virtues.courage || 1);
        openRollDialog({
          actor: this.document,
          title: '☀️ Resistir ao Rötschreck (Coragem)',
          traitType: 'virtue',
          traitKey: 'courage',
          traitLabel: 'Coragem',
          traitValue: val,
          difficulty: 7
        });
      });
    });

    root.querySelectorAll('.wod-roll-remorse').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        const virtues = this.document.systemData?.virtues || {};
        const val = virtues.conscience?.value ?? (virtues.conscience || 1);
        openRollDialog({
          actor: this.document,
          title: '⚖️ Remorso / Degeneração (Consciência)',
          traitType: 'virtue',
          traitKey: 'conscience',
          traitLabel: 'Consciência',
          traitValue: val,
          difficulty: 8
        });
      });
    });

    // 7.8 Rolagem Direta de Humanidade & Força de Vontade
    root.querySelectorAll('.wod-roll-humanity').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        const humVal = this.document.systemData?.humanity?.value ?? 7;
        const pathName = this.document.systemData?.humanity?.pathName || 'Humanidade';
        openRollDialog({
          actor: this.document,
          title: `Rolagem de ${pathName}`,
          traitType: 'virtue',
          traitKey: 'humanity',
          traitLabel: pathName,
          traitValue: humVal,
          difficulty: 6
        });
      });
    });

    root.querySelectorAll('.wod-roll-willpower').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        const wpVal = this.document.systemData?.willpower?.value ?? 1;
        openRollDialog({
          actor: this.document,
          title: 'Rolagem de Força de Vontade Pura',
          traitType: 'virtue',
          traitKey: 'willpower',
          traitLabel: 'Força de Vontade',
          traitValue: wpVal,
          difficulty: 6
        });
      });
    });

    root.querySelectorAll('.wod-roll-conviction').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        const convVal = this.document.systemData?.conviction?.value ?? 3;
        openRollDialog({
          actor: this.document,
          title: '⚡ Rolar Convicção (Caçador)',
          traitType: 'virtue',
          traitKey: 'conviction',
          traitLabel: 'Convicção',
          traitValue: convVal,
          difficulty: 6
        });
      });
    });

    // 7.9 Ações de Sangue: Curar e Bombar Atributo
    root.querySelectorAll('.wod-vampire-heal').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.preventDefault();
        await this.healWithBlood();
      });
    });

    root.querySelectorAll('.wod-vampire-buff').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.preventDefault();
        await this.buffPhysicalAttribute();
      });
    });

    // 7.9-toggle: lembra quais disciplinas o jogador abriu, para o re-render não fechar nem abrir sozinho
    root.querySelectorAll('.wod-disc-tree').forEach(d => {
      d.addEventListener('toggle', () => {
        if (d.open) this._openDisciplines.add(d.dataset.key);
        else this._openDisciplines.delete(d.dataset.key);
      });
    });

    // 7.9w Roda de quintessência/paradoxo: clique esquerdo = quintessência (sentido horário);
    // clique direito = paradoxo (sentido anti-horário a partir do zero)
    root.querySelectorAll('.wod-ring-slot').forEach(slot => {
      slot.addEventListener('contextmenu', async (e) => {
        e.preventDefault();
        if (!this.isEditable) return;
        const idx = parseInt(slot.dataset.index, 10);
        if (!idx) return;
        const want = 21 - idx;
        const current = parseInt(this.document.systemData?.paradox?.value, 10) || 0;
        const next = current === want ? want - 1 : want;
        await this.updateActor({ 'systemData.paradox.value': next });
      });
    });

    // 7.9x Experiência: registrar e remover
    root.querySelectorAll('.wod-btn-add-xp').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.preventDefault();
        await this.openAddXpDialog();
      });
    });
    root.querySelectorAll('.wod-xp-delete').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.preventDefault();
        if (!this.isEditable) return;
        const idx = parseInt(btn.dataset.index, 10);
        const log = [...(this.document.systemData?.xpLog || [])];
        if (Number.isNaN(idx) || idx < 0 || idx >= log.length) return;
        log.splice(idx, 1);
        await this._saveXpLog(log);
      });
    });

    // 7.9a Adicionar disciplina ao personagem (abre a janela de seleção)
    root.querySelectorAll('.wod-btn-add-discipline').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.preventDefault();
        await this.openAddDisciplineDialog();
      });
    });

    // 7.9b Árvore de disciplinas: rola o poder do nível (pool já calculado no contexto)
    root.querySelectorAll('.wod-roll-tree-power').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        openRollDialog({
          actor: this.document,
          traitType: 'power',
          traitLabel: btn.dataset.label,
          traitValue: parseInt(btn.dataset.pool, 10) || 1,
          difficulty: parseInt(btn.dataset.diff, 10) || 6
        });
      });
    });

    // 7.9c Salva o estado expandido das disciplinas para manter aberto no re-render
    root.querySelectorAll('.wod-disc-tree').forEach(dt => {
      dt.addEventListener('toggle', () => {
        const id = dt.dataset.id || dt.dataset.key;
        if (!id) return;
        if (dt.open) {
          this._openDisciplines.add(id);
        } else {
          this._openDisciplines.delete(id);
        }
      });
    });

    // 7.10 Botões de Rolagem Rápida (Topo e Barra Lateral)
    root.querySelectorAll('.wod-quick-roll-btn, .wod-side-quick-roll-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        openRollDialog({
          title: t('system.dialog.generalRoll', 'Rolagem Geral'),
          actor: this.document
        });
      });
    });

    // 8. Combate: Rolar Iniciativa (Fórmula configurável pelo Narrador)
    const initBtn = root.querySelector('.wod-roll-initiative');
    if (initBtn) {
      initBtn.addEventListener('click', async (e) => {
        e.preventDefault();
        const system = this.document.systemData || {};
        const attrs = system.derived?.activeAttributes || system.attributes || {};
        const formulaChoice = system.derived?.initiativeFormula || (window.Loom?.settings?.get ? window.Loom.settings.get('wod20th', 'initiativeFormula') : 'dex_wits') || 'dex_wits';
        const alertnessVal = system.abilities?.alertness?.value ?? 0;
        const baseInit = calculateInitiative({ attributes: attrs, alertness: alertnessVal }, formulaChoice);
        const penalty = system.derived?.healthPenalty || 0;
        const totalBase = Math.max(1, baseInit + penalty);

        let formulaLabel = t('system.settings.initiativeFormula.dexWitsShort', 'Destreza + Raciocínio');
        if (formulaChoice === 'dex_alertness') {
          formulaLabel = t('system.settings.initiativeFormula.dexAlertnessShort', 'Destreza + Prontidão');
        } else if (formulaChoice === 'wits_alertness') {
          formulaLabel = t('system.settings.initiativeFormula.witsAlertnessShort', 'Raciocínio + Prontidão');
        }

        // Rolagem de 1d10 + Base de Iniciativa
        await rollWoD({
          pool: 1,
          difficulty: 1, // rola 1d10
          label: `${t('system.sheet.initiative', 'Iniciativa')} [${formulaLabel}] (${totalBase} + 1d10)`,
          actor: this.document
        });
      });
    }

    // 9. Combate: Rolar Absorção (Soak) (Vigor + Armadura vs Dif 6)
    const soakBtn = root.querySelector('.wod-roll-soak');
    if (soakBtn) {
      soakBtn.addEventListener('click', async (e) => {
        e.preventDefault();
        const soakPool = this.document.systemData?.derived?.soak || 1;
        openRollDialog({
          title: t('system.sheet.soak', 'Absorção de Dano (Soak)'),
          pool: soakPool,
          difficulty: 6,
          actor: this.document,
          label: t('system.sheet.soak', 'Absorção (Soak)')
        });
      });
    }

    // 10. Lobisomem: Metamorfose / Mudança de Forma
    root.querySelectorAll('.wod-form-shift-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.preventDefault();
        if (!this.isEditable) return;

        const targetForm = btn.dataset.form;
        const diff = parseInt(btn.dataset.diff, 10) || 6;
        const formLabel = t(`system.werewolf.forms.${targetForm}`, targetForm);

        // Prompt de rolagem de Mudança de Forma (Vigor + Instinto Primitivo)
        const stamina = this.document.systemData?.attributes?.stamina || 1;
        const primalUrge = this.document.systemData?.abilities?.survival?.value || 0;
        const shiftPool = stamina + primalUrge;

        // A forma só muda depois da rolagem, e só se o jogador confirmar o sucesso
        const rolled = await openRollDialog({
          title: `${t('system.werewolf.shiftTo', 'Mudar para')} ${formLabel}`,
          traitType: 'power',
          traitLabel: `${t('system.werewolf.shiftTo', 'Metamorfose')}: ${formLabel}`,
          traitValue: shiftPool,
          difficulty: diff,
          actor: this.document
        });
        if (!rolled) return;

        const succeeded = await this._confirmFormShift(formLabel);
        if (succeeded) {
          await this.updateActor({ 'systemData.activeForm': targetForm });
        }
      });
    });

    // 11. Lobisomem: Frenesi e Travessia da Película (Umbra)
    const frenzyBtn = root.querySelector('.wod-werewolf-frenzy');
    if (frenzyBtn) {
      frenzyBtn.addEventListener('click', (e) => {
        e.preventDefault();
        const ragePool = this.document.systemData?.rage?.value || 1;
        openRollDialog({
          title: t('system.werewolf.frenzyTest', 'Teste de Frenesi'),
          pool: ragePool,
          difficulty: 6,
          actor: this.document,
          label: t('system.werewolf.frenzyTest', 'Frenesi Garou')
        });
      });
    }

    const umbraBtn = root.querySelector('.wod-werewolf-umbra');
    if (umbraBtn) {
      umbraBtn.addEventListener('click', (e) => {
        e.preventDefault();
        const gnosisPool = this.document.systemData?.gnosis?.value || 1;
        openRollDialog({
          title: t('system.werewolf.stepSideways', 'Entrar na Umbra'),
          pool: gnosisPool,
          difficulty: 6, // Dificuldade varia pela película local (2 a 8)
          actor: this.document,
          label: t('system.werewolf.stepSideways', 'Travessia da Película')
        });
      });
    }

    // 12. Vampiro: Cura por Sangue
    const vampHealBtn = root.querySelector('.wod-vampire-heal');
    if (vampHealBtn) {
      vampHealBtn.addEventListener('click', async (e) => {
        e.preventDefault();
        if (!this.isEditable) return;

        const currentBlood = this.document.systemData?.blood?.value || 0;
        if (currentBlood <= 0) {
          window.Loom?.showToast?.(t('system.vampire.noBlood', 'Sem sangue disponível!'), 'warning');
          return;
        }

        // Procura o pior dano curável (contusão ou letal)
        const levels = this.document.systemData?.health?.levels || {};
        const healOrder = ['incapacitated', 'crippled', 'mauled', 'wounded', 'injured', 'hurt', 'bruised'];
        let healedLevel = null;

        for (const lvl of healOrder) {
          if (levels[lvl] === 'bashing' || levels[lvl] === 'lethal') {
            healedLevel = lvl;
            break;
          }
        }

        if (healedLevel) {
          await this.updateActor({
            [`systemData.health.levels.${healedLevel}`]: 'none',
            'systemData.blood.value': Math.max(0, currentBlood - 1)
          });
          window.Loom?.showToast?.(t('system.vampire.bloodHealed', '1 nível de dano curado com sangue.'), 'info');
        } else {
          window.Loom?.showToast?.(t('system.vampire.noWoundsToHeal', 'Nenhum dano de contusão ou letal para curar.'), 'info');
        }
      });
    }

    // 13. Mago: Disparo de Feitiço (Arete) e Cálculo Dinâmico
    const sphereLevelInput = root.querySelector('#wod-mage-sphere-level');
    const castTypeSelect = root.querySelector('#wod-mage-cast-type');
    const quintSpentInput = root.querySelector('#wod-mage-quint-spent');
    const diffPreview = root.querySelector('#wod-mage-diff-preview');

    const updateMagickDiff = () => {
      if (!sphereLevelInput || !castTypeSelect || !quintSpentInput || !diffPreview) return;
      const { finalDiff } = calculateMagickDifficulty({
        highestSphere: parseInt(sphereLevelInput.value, 10) || 1,
        castingType: castTypeSelect.value,
        quintessenceSpent: parseInt(quintSpentInput.value, 10) || 0
      });
      diffPreview.textContent = finalDiff;
    };

    if (sphereLevelInput) sphereLevelInput.addEventListener('input', updateMagickDiff);
    if (castTypeSelect) castTypeSelect.addEventListener('change', updateMagickDiff);
    if (quintSpentInput) quintSpentInput.addEventListener('input', updateMagickDiff);

    const castSpellBtn = root.querySelector('.wod-btn-cast-spell');
    if (castSpellBtn) {
      castSpellBtn.addEventListener('click', (e) => {
        e.preventDefault();
        const areteVal = this.document.systemData?.arete?.value || 1;
        const { finalDiff } = calculateMagickDifficulty({
          highestSphere: parseInt(sphereLevelInput?.value, 10) || 1,
          castingType: castTypeSelect?.value || 'coincidental',
          quintessenceSpent: parseInt(quintSpentInput?.value, 10) || 0
        });

        openRollDialog({
          title: t('system.mage.castSpell', 'Lançar Feitiço (Arete)'),
          pool: areteVal,
          difficulty: finalDiff,
          actor: this.document,
          label: `${t('system.mage.magick', 'Mágika')}: Arete (${castTypeSelect?.value})`
        });
      });
    }

    const backlashBtn = root.querySelector('.wod-mage-backlash');
    if (backlashBtn) {
      backlashBtn.addEventListener('click', (e) => {
        e.preventDefault();
        const paradoxPool = this.document.systemData?.paradox?.value || 1;
        openRollDialog({
          title: t('system.mage.backlash', 'Choque de Retorno (Paradoxo)'),
          pool: paradoxPool,
          difficulty: 6,
          actor: this.document,
          label: t('system.mage.backlash', 'Choque de Paradoxo')
        });
      });
    }

    // 14. Combate com Armas: Rolagem de Ataque
    root.querySelectorAll('.wod-weapon-attack-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        const itemId = btn.dataset.id;
        const weapon = this.document.items?.find(i => i.id === itemId);
        if (!weapon) return;

        const system = this.document.systemData || {};
        const attrs = system.derived?.activeAttributes || system.attributes || {};
        const abilities = system.abilities || {};
        const penalty = system.derived?.healthPenalty || 0;

        // Determina se usa Armas de Fogo ou Armas Brancas/Briga
        const isFirearm = (weapon.systemData?.category === 'firearms') ||
          weapon.name.toLowerCase().includes('pistola') ||
          weapon.name.toLowerCase().includes('revólver') ||
          weapon.name.toLowerCase().includes('espingarda') ||
          weapon.name.toLowerCase().includes('rifle') ||
          weapon.name.toLowerCase().includes('fuzil');

        const combatAbility = isFirearm
          ? (abilities.firearms?.value || 0)
          : (abilities.melee?.value || abilities.brawl?.value || 0);

        const abilityName = isFirearm ? t('system.abilities.firearms', 'Armas de Fogo') : t('system.abilities.melee', 'Armas Brancas');
        const attackPool = Math.max(1, (attrs.dexterity || 1) + combatAbility + penalty);
        const difficulty = parseInt(weapon.systemData?.difficulty, 10) || 6;

        openRollDialog({
          title: `${t('system.combat.attack', 'Ataque')}: ${weapon.name}`,
          pool: attackPool,
          difficulty: difficulty,
          actor: this.document,
          label: `${weapon.name} (${t('system.attributes.dexterity', 'Destreza')} + ${abilityName})`
        });
      });
    });

    // 15. Combate com Armas: Rolagem de Dano
    root.querySelectorAll('.wod-weapon-damage-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        const itemId = btn.dataset.id;
        const weapon = this.document.items?.find(i => i.id === itemId);
        if (!weapon) return;

        const system = this.document.systemData || {};
        const attrs = system.derived?.activeAttributes || system.attributes || {};
        const strVal = attrs.strength || 1;
        const dmgStr = String(weapon.systemData?.damage || 'For+1').trim();
        const dmgType = weapon.systemData?.damageType || 'lethal';

        // Calcula parada de dano a partir de For+X ou valor fixo
        let dmgPool = strVal;
        if (/for/i.test(dmgStr) || /str/i.test(dmgStr)) {
          const match = dmgStr.match(/[+-]\s*(\d+)/);
          const bonus = match ? parseInt(match[1], 10) : 0;
          dmgPool = strVal + bonus;
        } else {
          const num = parseInt(dmgStr, 10);
          dmgPool = !isNaN(num) && num > 0 ? num : strVal;
        }

        openRollDialog({
          title: `${t('system.combat.damage', 'Dano')}: ${weapon.name}`,
          pool: Math.max(1, dmgPool),
          difficulty: 6,
          actor: this.document,
          label: `${t('system.combat.damage', 'Dano')}: ${weapon.name} (${dmgType})`
        });
      });
    });

    // 16. Lobisomem: Mudança de Forma Instantânea por Fúria (1 Fúria)
    root.querySelectorAll('.wod-form-rage-shift-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.preventDefault();
        if (!this.isEditable) return;

        const targetForm = btn.dataset.form;
        const currentRage = this.document.systemData?.rage?.value || 0;
        if (currentRage <= 0) {
          window.Loom?.showToast?.(t('system.werewolf.noRage', 'Sem Fúria suficiente para mudar instantaneamente!'), 'warning');
          return;
        }

        const formLabel = t(`system.werewolf.forms.${targetForm}`, targetForm);
        const confirmed = await this._confirmFormShift(
          formLabel,
          `Gastar 1 Fúria e trocar para <strong>${formLabel}</strong>?`,
          'A Fúria só é gasta se você confirmar.',
          'Gastar e trocar'
        );
        if (!confirmed) return;

        await this.updateActor({
          'systemData.rage.value': currentRage - 1,
          'systemData.activeForm': targetForm
        });

        window.Loom?.showToast?.(`${t('system.werewolf.rageShiftSuccess', 'Forma alterada instantaneamente com 1 Fúria')}: ${formLabel}`, 'info');
      });
    });

    // 17. Lobisomem: Regeneração Garou (1 Nível por Turno)
    const garouRegenBtn = root.querySelector('.wod-werewolf-regen');
    if (garouRegenBtn) {
      garouRegenBtn.addEventListener('click', async (e) => {
        e.preventDefault();
        if (!this.isEditable) return;

        const levels = this.document.systemData?.health?.levels || {};
        const healOrder = ['incapacitated', 'crippled', 'mauled', 'wounded', 'injured', 'hurt', 'bruised'];
        let healedLevel = null;

        for (const lvl of healOrder) {
          if (levels[lvl] === 'bashing' || levels[lvl] === 'lethal') {
            healedLevel = lvl;
            break;
          }
        }

        if (healedLevel) {
          await this.updateActor({
            [`systemData.health.levels.${healedLevel}`]: 'none'
          });
          window.Loom?.showToast?.(t('system.werewolf.regenSuccess', '💚 1 nível de dano regenerado pela vitalidade Garou!'), 'info');
        } else {
          window.Loom?.showToast?.(t('system.werewolf.noRegenWounds', 'Nenhum dano de contusão ou letal para regenerar.'), 'info');
        }
      });
    }

    // 18. Lobisomem: Ações Extras por Fúria
    const extraActionsBtn = root.querySelector('.wod-werewolf-extra-actions');
    if (extraActionsBtn) {
      extraActionsBtn.addEventListener('click', async (e) => {
        e.preventDefault();
        if (!this.isEditable) return;

        const currentRage = this.document.systemData?.rage?.value || 0;
        if (currentRage <= 0) {
          window.Loom?.showToast?.(t('system.werewolf.noRage', 'Sem Fúria suficiente!'), 'warning');
          return;
        }

        await this.updateActor({
          'systemData.rage.value': currentRage - 1
        });
        window.Loom?.showToast?.(t('system.werewolf.extraActionDeclared', '⚡ 1 Ponto de Fúria gasto: Ação Extra declarada para este turno!'), 'info');
      });
    }

    // 19. Mago: Descarga de Paradoxo (Backlash)
    const paradoxBacklashBtn = root.querySelector('.wod-btn-paradox-backlash');
    if (paradoxBacklashBtn) {
      paradoxBacklashBtn.addEventListener('click', (e) => {
        e.preventDefault();
        const paradoxPool = this.document.systemData?.paradox?.value || 0;
        if (paradoxPool <= 0) {
          window.Loom?.showToast?.(t('system.mage.noParadox', 'Nenhum ponto de Paradoxo acumulado.'), 'info');
          return;
        }

        openRollDialog({
          title: t('system.mage.paradoxBacklash', 'Descarga de Paradoxo (Backlash)'),
          pool: paradoxPool,
          difficulty: 6,
          actor: this.document,
          label: `${t('system.mage.paradox', 'Paradoxo')}: Backlash (${paradoxPool}d10)`
        });
      });
    }

    // 20. Rolagem Direta de Itens (Dons, Ritos, Artes, Reinos, Arcanoi)
    root.querySelectorAll('.wod-item-roll').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        const itemId = btn.dataset.id;
        const item = this.document.items?.find(i => i.id === itemId);
        if (!item) return;

        const itemLevel = parseInt(item.systemData?.level, 10) || 1;
        const diff = parseInt(item.systemData?.difficulty, 10) || 6;

        openRollDialog({
          title: `${item.name} (${item.type})`,
          pool: itemLevel,
          difficulty: diff,
          actor: this.document,
          label: `${item.name} [${item.type}]`
        });
      });
    });

    // 21. Itens: Adicionar, Excluir e Editar (Compatibilidade de seletores)
    root.querySelectorAll('.wod-add-item-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.preventDefault();
        if (!this.isEditable) return;
        const itemType = btn.dataset.type || 'gear';
        await this.createItem(itemType);
      });
    });

    root.querySelectorAll('.wod-item-delete').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.preventDefault();
        if (!this.isEditable) return;
        const itemId = btn.dataset.id;
        if (itemId) await this.deleteItem(itemId);
      });
    });

    root.querySelectorAll('.wod-item-edit').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.preventDefault();
        const itemId = btn.dataset.id;
        if (itemId) await this.openItemSheet(itemId);
      });
    });
  }
}
