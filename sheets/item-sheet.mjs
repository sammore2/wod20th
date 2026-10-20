import { LoomItemSheet, LoomHandlebarsMixin, api } from '/_loom/sdk/index.js';
import { openRollDialog } from '../scripts/dice.mjs';
import { loadDisciplines } from '../scripts/disciplines-data.mjs';

/**
 * WoDItemSheet - Ficha Universal de Itens para WoD 20th
 * Suporta Armas, Armaduras, Fetiches, Talis, Ritos, Totens, Rotes, Maravilhas, Grimórios, Disciplinas e Poderes por Nível.
 * Permite configuração livre de Paradas de Dados, Níveis e Efeitos, sem conteúdo proprietário embutido.
 */
export class WoDItemSheet extends LoomHandlebarsMixin(LoomItemSheet) {
  static PARTS = {
    sheet: {
      template: '/marketplace/rulesets/wod20th/templates/item-sheet.hbs'
    }
  };

  static DEFAULT_OPTIONS = {
    id: 'wod20th-item-sheet',
    classes: ['wod20th', 'sheet', 'item'],
    template: '/marketplace/rulesets/wod20th/templates/item-sheet.hbs',
    width: 700,
    height: 640,
    resizable: true,
    submitOnChange: true
  };

  constructor(options = {}) {
    super(options);
    this._activeTab = 'details';
  }

  get apiRoute() { return '/items'; }
  get documentName() { return 'item'; }

  async mount() {
    if (typeof super.mount === 'function') await super.mount();
    this._applyActiveTab();
    this._wireItemEvents();
  }

  _postRender() {
    if (typeof super._postRender === 'function') super._postRender();
    this._applyActiveTab();
    this._wireItemEvents();
  }

  _applyActiveTab() {
    const root = this.element;
    if (!root) return;
    const tab = this._activeTab || 'details';
    root.querySelectorAll('.wod-tab-btn').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.tab === tab);
    });
    root.querySelectorAll('.wod-tab-pane').forEach((panel) => {
      panel.classList.toggle('active', panel.dataset.tab === tab);
    });
  }

  async onAction(action, id, target) {
    if (action === 'set-level') {
      const path = target?.dataset?.path || 'level';
      const clickedIndex = parseInt(target?.dataset?.index, 10);
      const itemData = { ...(this.document?.data || {}), ...(this.document?.systemData || {}) };
      const currentVal = parseInt(itemData[path] ?? 1, 10);
      let newVal = clickedIndex;
      if (clickedIndex === currentVal) {
        newVal = Math.max(0, clickedIndex - 1);
      }
      await this.updateItem({ [path]: newVal });
      return;
    }
    if (action === 'tab' || action === 'item-tab') {
      const tab = target?.dataset?.tab;
      if (tab) {
        this._activeTab = tab;
        this._applyActiveTab();
      }
      return;
    }
    if (action === 'add-power') {
      const itemData = { ...(this.document?.data || {}), ...(this.document?.systemData || {}) };
      const powers = Array.isArray(itemData.powers) ? [...itemData.powers] : [];
      const nextLvl = Math.min(5, powers.length + 1);
      powers.push({
        name: `Poder de Nível ${nextLvl}`,
        level: nextLvl,
        poolAttribute: 'perception',
        poolAbility: 'alertness',
        difficulty: 6,
        cost: 'Gratuito',
        duration: '1 Cena',
        description: ''
      });
      await this.updateItem({ 'systemData.powers': powers });
      return;
    }
    if (action === 'delete-power') {
      const index = parseInt(target?.dataset?.index ?? id, 10);
      const itemData = { ...(this.document?.data || {}), ...(this.document?.systemData || {}) };
      const powers = Array.isArray(itemData.powers) ? [...itemData.powers] : [];
      if (!isNaN(index) && index >= 0 && index < powers.length) {
        powers.splice(index, 1);
        await this.updateItem({ 'systemData.powers': powers });
      }
      return;
    }
    if (action === 'load-canonical') {
      const select = this.element?.querySelector('select[name="canonical_disc_select"]');
      const key = select?.value;
      const catalog = await loadDisciplines();
      if (key && catalog[key]) {
        const disc = catalog[key];
        await this.updateItem({
          name: disc.name,
          'systemData.powers': JSON.parse(JSON.stringify(disc.powers))
        });
        if (window.Loom?.notifications?.info) {
          window.Loom.notifications.info(`Poderes de ${disc.name} carregados com sucesso!`);
        }
      }
      return;
    }
    if (action === 'roll-power') {
      const index = parseInt(target?.dataset?.index ?? id, 10);
      const itemData = { ...(this.document?.data || {}), ...(this.document?.systemData || {}) };
      const powers = Array.isArray(itemData.powers) ? itemData.powers : [];
      const power = powers[index];
      if (power) {
        await this.rollPower(power);
      }
      return;
    }
    return super.onAction?.(action, id, target);
  }

  async rollPower(power) {
    let actor = null;
    const actorId = this.document?.actorId || this.document?.parent?.id;
    const loomApi = api || window.Loom?.api;
    if (actorId && loomApi) {
      try {
        actor = await loomApi.get(`/actors/${actorId}`);
      } catch {}
    }

    const attrKey = power.poolAttribute;
    const abKey = power.poolAbility;
    const attrVal = parseInt(actor?.systemData?.attributes?.[attrKey] || 0, 10);
    const abilityVal = parseInt(actor?.systemData?.abilities?.[abKey]?.value ?? actor?.systemData?.abilities?.[abKey] ?? 0, 10);
    const pool = (attrVal + abilityVal) > 0 ? (attrVal + abilityVal) : 1;

    openRollDialog({
      actor: actor || { name: this.document?.name || 'Personagem' },
      pool,
      difficulty: parseInt(power.difficulty, 10) || 6,
      traitLabel: `${this.document?.name || 'Disciplina'}: ${power.name}`,
      traitKey: power.name,
      traitType: 'power'
    });
  }

  async _prepareContext(options) {
    const base = (typeof super._prepareContext === 'function') ? await super._prepareContext(options) : {};
    const data = await this.getData(options);
    return { ...base, ...data };
  }

  async getData(options = {}) {
    const context = (typeof super.getData === 'function') ? await super.getData(options) : {};
    const item = this.document || {};
    const system = { ...(item.data || {}), ...(item.systemData || {}) };

    context.item = item;
    context.system = system;
    context.data = system;
    context.isEditable = this.isEditable;
    context.activeTab = this._activeTab;

    // Flags por tipo de item
    context.isWeapon = item.type === 'weapon';
    context.isArmor = item.type === 'armor';
    context.isDiscipline = item.type === 'discipline';
    context.isRitual = item.type === 'ritual';
    context.isGift = item.type === 'gift';
    context.isRite = item.type === 'rite';
    context.isFetish = item.type === 'fetish';
    context.isTalen = item.type === 'talen';
    context.isTotem = item.type === 'totem';
    context.isRote = item.type === 'rote';
    context.isWonder = item.type === 'wonder' || item.type === 'talisman' || item.type === 'artifact';
    context.isGrimoire = item.type === 'grimoire';
    context.isBackground = item.type === 'background';
    context.isMeritFlaw = item.type === 'merit' || item.type === 'flaw';
    context.isPower = context.isDiscipline || context.isRitual || context.isGift || context.isRite || item.type === 'power' || item.type === 'edge' || item.type === 'art' || item.type === 'arcanoi';

    // Nível máximo configurável (padrão 5, pode ser 10 para anciões / mestres)
    const maxLevel = Math.max(1, parseInt(system.maxLevel || system.max || 5, 10));
    context.maxLevel = maxLevel;
    const levelVal = Math.min(maxLevel, parseInt(system.level ?? 1, 10));
    context.level = levelVal;

    // Dots de nível dinâmicos
    context.levelDots = [];
    for (let i = 1; i <= maxLevel; i++) {
      context.levelDots.push({
        index: i,
        filled: i <= levelVal
      });
    }

    // Listas para seleção de Reserva de Dados
    context.attributesList = [
      { key: 'none', label: '-- Nenhum --' },
      { key: 'strength', label: 'Força' },
      { key: 'dexterity', label: 'Destreza' },
      { key: 'stamina', label: 'Vigor' },
      { key: 'charisma', label: 'Carisma' },
      { key: 'manipulation', label: 'Manipulação' },
      { key: 'appearance', label: 'Aparência' },
      { key: 'perception', label: 'Percepção' },
      { key: 'intelligence', label: 'Inteligência' },
      { key: 'wits', label: 'Raciocínio' }
    ];

    context.abilitiesList = [
      { key: 'none', label: '-- Nenhuma --' },
      // Talentos
      { key: 'alertness', label: 'Prontidão (Talento)' },
      { key: 'athletics', label: 'Esportes (Talento)' },
      { key: 'awareness', label: 'Presciência (Talento)' },
      { key: 'brawl', label: 'Briga (Talento)' },
      { key: 'empathy', label: 'Empatia (Talento)' },
      { key: 'expression', label: 'Expressão (Talento)' },
      { key: 'intimidation', label: 'Intimidação (Talento)' },
      { key: 'leadership', label: 'Liderança (Talento)' },
      { key: 'streetwise', label: 'Manha (Talento)' },
      { key: 'subterfuge', label: 'Lábia (Talento)' },
      // Perícias
      { key: 'animalKen', label: 'Empatia c/ Animais (Perícia)' },
      { key: 'crafts', label: 'Ofícios (Perícia)' },
      { key: 'drive', label: 'Condução (Perícia)' },
      { key: 'etiquette', label: 'Etiqueta (Perícia)' },
      { key: 'firearms', label: 'Armas de Fogo (Perícia)' },
      { key: 'melee', label: 'Armas Brancas (Perícia)' },
      { key: 'performance', label: 'Performance (Perícia)' },
      { key: 'security', label: 'Furto (Perícia)' },
      { key: 'stealth', label: 'Furtividade (Perícia)' },
      { key: 'survival', label: 'Sobrevivência (Perícia)' },
      // Conhecimentos
      { key: 'academics', label: 'Acadêmicos (Conhecimento)' },
      { key: 'computer', label: 'Computador (Conhecimento)' },
      { key: 'finance', label: 'Finanças (Conhecimento)' },
      { key: 'investigation', label: 'Investigação (Conhecimento)' },
      { key: 'law', label: 'Direito (Conhecimento)' },
      { key: 'medicine', label: 'Medicina (Conhecimento)' },
      { key: 'occult', label: 'Ocultismo (Conhecimento)' },
      { key: 'politics', label: 'Política (Conhecimento)' },
      { key: 'science', label: 'Ciências (Conhecimento)' },
      { key: 'technology', label: 'Tecnologia (Conhecimento)' }
    ];

    // Lista de Poderes da Disciplina / Trilha / Arte
    const rawPowers = Array.isArray(system.powers) ? system.powers : [];
    context.powers = rawPowers.map((p, idx) => ({
      ...p,
      index: idx,
      dots: Array.from({ length: Math.min(10, Math.max(1, parseInt(p.level, 10) || 1)) }, (_, i) => i + 1)
    }));
    context.hasPowers = context.powers.length > 0;

    // Catálogo canônico para carregamento automático
    const catalog = await loadDisciplines();
    context.canonicalDisciplinesList = Object.entries(catalog).map(([k, v]) => ({
      key: k,
      name: v.name,
      englishName: v.englishName
    }));

    return context;
  }

  get itemId() {
    return this.document?.id || this.options?.itemId || this.options?.documentId || this.documentId;
  }

  async updateItem(patch = {}) {
    const id = this.itemId;
    if (!id) return;
    const loomApi = api || window.Loom?.api;
    const itemData = JSON.parse(JSON.stringify({ ...(this.document?.data || {}), ...(this.document?.systemData || {}) }));
    const topLevelUpdate = {};

    for (const [key, value] of Object.entries(patch)) {
      if (key.startsWith('systemData.') || key.startsWith('data.')) {
        const subPath = key.replace(/^(systemData|data)\./, '');
        const parts = subPath.split('.');
        let cur = itemData;
        for (let i = 0; i < parts.length - 1; i++) {
          if (!cur[parts[i]] || typeof cur[parts[i]] !== 'object') cur[parts[i]] = {};
          cur = cur[parts[i]];
        }
        cur[parts[parts.length - 1]] = value;
      } else if (key === 'systemData' || key === 'data') {
        Object.assign(itemData, value);
      } else if (key === 'name' || key === 'img' || key === 'imgUrl') {
        topLevelUpdate[key] = value;
      } else {
        const parts = key.split('.');
        let cur = itemData;
        for (let i = 0; i < parts.length - 1; i++) {
          if (!cur[parts[i]] || typeof cur[parts[i]] !== 'object') cur[parts[i]] = {};
          cur = cur[parts[i]];
        }
        cur[parts[parts.length - 1]] = value;
      }
    }

    const submitData = {
      ...topLevelUpdate,
      data: itemData,
      systemData: itemData
    };

    if (loomApi) {
      try {
        await loomApi.put(`/items/${id}`, submitData);
        if (this.document) {
          if (!this.document.data) this.document.data = {};
          if (!this.document.systemData) this.document.systemData = {};
          Object.assign(this.document.data, itemData);
          Object.assign(this.document.systemData, itemData);
        }
        if (typeof this._reloadDocument === 'function') {
          await this._reloadDocument();
        } else {
          const row = await loomApi.get(`/items/${id}`);
          if (row) this.document = row;
          if (typeof this.render === 'function') await this.render();
        }
      } catch (err) {
        console.error('[wod20th] Erro ao atualizar item:', err);
      }
    }
  }

  _wireItemEvents() {
    const root = this.element;
    if (!root || this._itemEventsWired) return;
    this._itemEventsWired = true;

    // Salvamento automático de campos nativos via delegação permanente
    root.addEventListener('change', async (e) => {
      const target = e.target;
      if (!target || !target.name || !target.isConnected) return;
      if (target.name === 'canonical_disc_select') return;

      const value = target.type === 'checkbox' ? target.checked
        : target.type === 'number' ? (Number(target.value) || 0)
        : target.value;

      // Suporte a campos de array de poderes: "powers.0.name", "powers.1.difficulty", etc.
      const powerMatch = target.name.match(/^powers\.(\d+)\.([a-zA-Z0-9_]+)$/);
      if (powerMatch) {
        const idx = parseInt(powerMatch[1], 10);
        const field = powerMatch[2];
        const itemData = { ...(this.document?.data || {}), ...(this.document?.systemData || {}) };
        const powers = Array.isArray(itemData.powers) ? JSON.parse(JSON.stringify(itemData.powers)) : [];
        if (powers[idx]) {
          powers[idx][field] = value;
          await this.updateItem({ 'systemData.powers': powers });
        }
        return;
      }

      if (target.name === 'name') {
        await this.updateItem({ name: value });
      } else {
        await this.updateItem({ [target.name]: value });
      }
    });

    // Clique em dots de nível, tabs e ações via delegação permanente
    root.addEventListener('click', async (e) => {
      // 1. Troca de abas
      const tabBtn = e.target.closest('.wod-tab-btn');
      if (tabBtn) {
        e.preventDefault();
        const tab = tabBtn.dataset.tab;
        if (tab) {
          this._activeTab = tab;
          this._applyActiveTab();
        }
        return;
      }

      // 2. Dots de nível do item
      const dot = e.target.closest('.wod-dot');
      if (dot && this.isEditable) {
        e.preventDefault();
        const path = dot.dataset.path || 'level';
        const clickedIndex = parseInt(dot.dataset.index, 10);
        const itemData = { ...(this.document?.data || {}), ...(this.document?.systemData || {}) };
        const currentVal = parseInt(itemData[path] ?? 1, 10);
        let newVal = clickedIndex;
        if (clickedIndex === currentVal) {
          newVal = Math.max(0, clickedIndex - 1);
        }
        await this.updateItem({ [path]: newVal });
        return;
      }

      // 3. Botões de Ação de Poderes (adicionar, excluir, carregar oficial, rolar)
      const actionBtn = e.target.closest('[data-action]');
      if (actionBtn && this.isEditable) {
        const action = actionBtn.dataset.action;
        const index = actionBtn.dataset.index;
        if (action === 'add-power' || action === 'delete-power' || action === 'load-canonical' || action === 'roll-power') {
          e.preventDefault();
          await this.onAction(action, index, actionBtn);
          return;
        }
      }
    });
  }

  _onRender(context, options) {
    super._onRender?.(context, options);
    this._applyActiveTab();
    this._wireItemEvents();
  }
}
