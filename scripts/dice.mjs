import { dispatchRoll, LoomDialog } from '/_loom/sdk/index.js';

/**
 * Localization helper for scripts
 */
export function t(key, fallback = '') {
  if (window.Loom?.i18n?.localize) {
    const res = window.Loom.i18n.localize(key);
    if (res && res !== key) return res;
  }
  return fallback || key;
}

/**
 * Storyteller System (WoD 20th) Dice Engine
 */
export function calculateWoDSuccesses(rolls, difficulty = 6, specialty = false, hasWillpower = false) {
  let rawSuccesses = 0;
  let ones = 0;
  let tens = 0;

  for (const die of rolls) {
    if (die >= difficulty) {
      rawSuccesses++;
      if (die === 10) tens++;
    }
    if (die === 1) {
      ones++;
    }
  }

  // Specialty: each 10 counts as two successes
  let specialtyBonus = 0;
  if (specialty) {
    specialtyBonus = tens;
    rawSuccesses += specialtyBonus;
  }

  // Willpower gives 1 automatic success that cannot be cancelled by 1s
  const wpSuccess = hasWillpower ? 1 : 0;

  // 1s cancel rolled successes (down to minimum 0)
  const remainingRolled = Math.max(0, rawSuccesses - ones);
  const totalSuccesses = remainingRolled + wpSuccess;

  // Botch check: No successes at all (excluding WP) AND at least one 1 rolled, AND no Willpower spent
  const isBotch = !hasWillpower && rawSuccesses === 0 && ones > 0;
  const isFailure = totalSuccesses === 0 && !isBotch;
  const isSuccess = totalSuccesses > 0;

  return {
    rawSuccesses,
    tens,
    ones,
    specialtyBonus,
    wpSuccess,
    totalSuccesses,
    isBotch,
    isFailure,
    isSuccess
  };
}

/**
 * Executes a WoD 20th roll and sends it to Loom chat
 */
export async function rollWoD({
  pool = 1,
  difficulty = 6,
  specialty = false,
  willpower = false,
  label = '',
  actor = null,
  actorName = ''
}) {
  const safePool = Math.max(1, parseInt(pool, 10) || 1);
  const safeDiff = Math.min(10, Math.max(2, parseInt(difficulty, 10) || 6));
  const finalActorName = actorName || actor?.name || t('system.sheet.name', 'Personagem');
  const finalLabel = label || t('system.dialog.generalRoll', 'Rolagem');

  const formula = `${safePool}d10`;

  await dispatchRoll({
    formula,
    actorId: actor?.id,
    meta: {
      wod20th: true,
      system: 'wod20th',
      label: finalLabel,
      difficulty: safeDiff,
      pool: safePool,
      specialty: Boolean(specialty),
      willpower: Boolean(willpower),
      actorName: finalActorName
    }
  });
}

/**
 * Opens an interactive roll dialog where the pool is defined by what the user clicked on the sheet.
 */
export async function openRollDialog({
  title = '',
  actor = null,
  actorName = '',
  traitType = 'general', // 'attribute' | 'ability' | 'power' | 'general'
  traitKey = '',
  traitLabel = '',
  traitValue = 0,
  difficulty = 6,
  specialty = false,
  willpower = false,
  label = ''
} = {}) {
  const system = actor?.systemData || {};
  const derived = system.derived || {};
  const attrs = derived.activeAttributes || system.attributes || {};
  const abilities = system.abilities || {};
  const healthPenalty = parseInt(derived.healthPenalty, 10) || 0;

  const attrList = [
    { key: 'strength', label: t('system.attributes.strength', 'Força'), group: 'Físicos' },
    { key: 'dexterity', label: t('system.attributes.dexterity', 'Destreza'), group: 'Físicos' },
    { key: 'stamina', label: t('system.attributes.stamina', 'Vigor'), group: 'Físicos' },
    { key: 'charisma', label: t('system.attributes.charisma', 'Carisma'), group: 'Sociais' },
    { key: 'manipulation', label: t('system.attributes.manipulation', 'Manipulação'), group: 'Sociais' },
    { key: 'appearance', label: t('system.attributes.appearance', 'Aparência'), group: 'Sociais' },
    { key: 'perception', label: t('system.attributes.perception', 'Percepção'), group: 'Mentais' },
    { key: 'intelligence', label: t('system.attributes.intelligence', 'Inteligência'), group: 'Mentais' },
    { key: 'wits', label: t('system.attributes.wits', 'Raciocínio'), group: 'Mentais' }
  ].map(a => {
    const rawVal = attrs[a.key];
    const val = (typeof rawVal === 'object' && rawVal !== null) ? (rawVal.value || 1) : (parseInt(rawVal, 10) || 1);
    return { ...a, value: val };
  });

  const abilityGroups = [
    {
      group: t('system.sheet.talents', 'Talentos'),
      items: [
        { key: 'alertness', label: t('system.abilities.alertness', 'Prontidão') },
        { key: 'athletics', label: t('system.abilities.athletics', 'Esportes') },
        { key: 'awareness', label: t('system.abilities.awareness', 'Presciência') },
        { key: 'brawl', label: t('system.abilities.brawl', 'Briga') },
        { key: 'empathy', label: t('system.abilities.empathy', 'Empatia') },
        { key: 'expression', label: t('system.abilities.expression', 'Expressão') },
        { key: 'intimidation', label: t('system.abilities.intimidation', 'Intimidação') },
        { key: 'leadership', label: t('system.abilities.leadership', 'Liderança') },
        { key: 'streetwise', label: t('system.abilities.streetwise', 'Manha') },
        { key: 'subterfuge', label: t('system.abilities.subterfuge', 'Lábia') }
      ]
    },
    {
      group: t('system.sheet.skills', 'Perícias'),
      items: [
        { key: 'animalKen', label: t('system.abilities.animalKen', 'Empatia c/ Animais') },
        { key: 'crafts', label: t('system.abilities.crafts', 'Ofícios') },
        { key: 'drive', label: t('system.abilities.drive', 'Condução') },
        { key: 'etiquette', label: t('system.abilities.etiquette', 'Etiqueta') },
        { key: 'firearms', label: t('system.abilities.firearms', 'Armas de Fogo') },
        { key: 'melee', label: t('system.abilities.melee', 'Armas Brancas') },
        { key: 'performance', label: t('system.abilities.performance', 'Performance') },
        { key: 'security', label: t('system.abilities.security', 'Furto') },
        { key: 'stealth', label: t('system.abilities.stealth', 'Furtividade') },
        { key: 'survival', label: t('system.abilities.survival', 'Sobrevivência') }
      ]
    },
    {
      group: t('system.sheet.knowledges', 'Conhecimentos'),
      items: [
        { key: 'academics', label: t('system.abilities.academics', 'Acadêmicos') },
        { key: 'computer', label: t('system.abilities.computer', 'Computador') },
        { key: 'finance', label: t('system.abilities.finance', 'Finanças') },
        { key: 'investigation', label: t('system.abilities.investigation', 'Investigação') },
        { key: 'law', label: t('system.abilities.law', 'Direito') },
        { key: 'medicine', label: t('system.abilities.medicine', 'Medicina') },
        { key: 'occult', label: t('system.abilities.occult', 'Ocultismo') },
        { key: 'politics', label: t('system.abilities.politics', 'Política') },
        { key: 'science', label: t('system.abilities.science', 'Ciências') },
        { key: 'technology', label: t('system.abilities.technology', 'Tecnologia') }
      ]
    }
  ];

  const primaryValue = parseInt(traitValue ?? pool, 10) || (
    traitType === 'attribute' ? (attrs[traitKey] || 1) :
    traitType === 'ability' ? (abilities[traitKey]?.value || abilities[traitKey] || 0) : 0
  );

  let secondarySelectHtml = '';
  let initialSecondaryVal = 0;
  let secondaryLabelText = 'Combinar com:';

  if (traitType === 'attribute') {
    secondaryLabelText = 'Combinar com Habilidade:';
    secondarySelectHtml = `<option value="none|0|Nenhuma" data-spec="">-- Nenhuma (0) --</option>`;
    for (const grp of abilityGroups) {
      secondarySelectHtml += `<optgroup label="${grp.group}">`;
      for (const item of grp.items) {
        const rawAb = abilities[item.key];
        const abVal = (typeof rawAb === 'object' && rawAb !== null) ? (rawAb.value || 0) : (parseInt(rawAb, 10) || 0);
        const spec = (typeof rawAb === 'object' && rawAb?.specialty) ? rawAb.specialty : '';
        secondarySelectHtml += `<option value="${item.key}|${abVal}|${item.label}" data-spec="${spec}">${item.label} (${abVal})${spec ? ' [' + spec + ']' : ''}</option>`;
      }
      secondarySelectHtml += `</optgroup>`;
    }
  } else if (traitType === 'ability' || traitType === 'power') {
    secondaryLabelText = 'Combinar com Atributo:';
    let defaultAttr = 'dexterity';
    if (traitKey === 'brawl' || traitKey === 'athletics' || traitKey === 'melee') defaultAttr = 'strength';
    else if (traitKey === 'subterfuge' || traitKey === 'intimidation' || traitKey === 'leadership') defaultAttr = 'manipulation';
    else if (traitKey === 'investigation' || traitKey === 'academics' || traitKey === 'occult') defaultAttr = 'intelligence';
    else if (traitKey === 'alertness' || traitKey === 'awareness') defaultAttr = 'perception';

    secondarySelectHtml = `<option value="none|0|Nenhum" data-spec="">-- Nenhum (0) --</option>`;
    for (const a of attrList) {
      const isSel = (traitType === 'ability') && (a.key === defaultAttr);
      if (isSel) initialSecondaryVal = a.value;
      secondarySelectHtml += `<option value="${a.key}|${a.value}|${a.label}" ${isSel ? 'selected' : ''}>${a.label} (${a.value})</option>`;
    }
  } else if (traitType === 'virtue' || traitType === 'fixed') {
    secondaryLabelText = 'Modificador / Traço Adicional:';
    secondarySelectHtml = `<option value="none|0|Nenhum" selected>-- Nenhum (0) --</option>`;
    secondarySelectHtml += `<optgroup label="Atributos">`;
    for (const a of attrList) {
      secondarySelectHtml += `<option value="${a.key}|${a.value}|${a.label}">${a.label} (${a.value})</option>`;
    }
    secondarySelectHtml += `</optgroup>`;
    secondarySelectHtml += `<optgroup label="Habilidades">`;
    for (const grp of abilityGroups) {
      for (const item of grp.items) {
        const rawAb = abilities[item.key];
        const abVal = (typeof rawAb === 'object' && rawAb !== null) ? (rawAb.value || 0) : (parseInt(rawAb, 10) || 0);
        secondarySelectHtml += `<option value="${item.key}|${abVal}|${item.label}">${item.label} (${abVal})</option>`;
      }
    }
    secondarySelectHtml += `</optgroup>`;
  } else {
    // General roll: Atributo + Habilidade
    secondaryLabelText = 'Atributo & Habilidade:';
    secondarySelectHtml = `<optgroup label="Atributos">`;
    for (const a of attrList) {
      secondarySelectHtml += `<option value="${a.key}|${a.value}|${a.label}">${a.label} (${a.value})</option>`;
    }
    secondarySelectHtml += `</optgroup>`;
  }

  const initialTotalPool = Math.max(1, primaryValue + initialSecondaryVal + healthPenalty);
  const dialogTitle = title || (traitLabel ? `Rolagem: ${traitLabel}` : 'Rolagem WoD 20th');

  window._wodBaseTraitVal = primaryValue;
  window._wodHealthPenalty = healthPenalty;
  window._wodUpdatePool = function() {
    const secEl = document.getElementById('wod-dialog-secondary');
    const modEl = document.getElementById('wod-dialog-mod');
    const specEl = document.getElementById('wod-dialog-spec');
    const displayEl = document.getElementById('wod-dialog-pool-display');
    if (!displayEl) return;

    const secParts = (secEl?.value || 'none|0').split('|');
    const secVal = parseInt(secParts[1], 10) || 0;
    const modVal = parseInt(modEl?.value, 10) || 0;
    const baseVal = window._wodBaseTraitVal || 0;
    const penalty = window._wodHealthPenalty || 0;

    const total = Math.max(1, baseVal + secVal + modVal + penalty);
    displayEl.textContent = String(total);

    if (secEl && specEl) {
      const opt = secEl.options[secEl.selectedIndex];
      if (opt?.dataset?.spec) specEl.checked = true;
    }
  };

  const contentHtml = `
    <div style="padding: 12px; display: flex; flex-direction: column; gap: 12px; font-family: 'Cinzel', serif; color: #f5eedf; background: #141216;">
      
      <!-- PARADA DE DADOS DINÂMICA -->
      <div style="background: linear-gradient(135deg, rgba(35,10,12,0.95), rgba(14,12,18,0.95)); border: 2px solid #8b0000; border-radius: 8px; padding: 10px; text-align: center; box-shadow: 0 4px 12px rgba(0,0,0,0.6);">
        <div style="font-size: 11px; text-transform: uppercase; letter-spacing: 2px; color: #c9a050;">Parada de Dados</div>
        <div style="font-size: 32px; font-weight: 700; color: #fff; text-shadow: 0 0 10px rgba(200,160,80,0.5);">
          <span id="wod-dialog-pool-display">${initialTotalPool}</span> <span style="font-size: 18px; color: #c9a050;">d10</span>
        </div>
        ${healthPenalty < 0 ? `<div style="font-size: 11px; color: #ff5555; font-weight: bold; font-family: sans-serif;">⚠️ Penalidade de Ferimentos: ${healthPenalty} dado(s)</div>` : ''}
      </div>

      <!-- TRAIT CLICADO (BASE) -->
      ${traitLabel ? `
      <div style="display: flex; justify-content: space-between; align-items: center; background: rgba(255,255,255,0.04); padding: 8px 12px; border-radius: 4px; border: 1px solid rgba(200,160,80,0.2);">
        <span style="font-size: 13px; color: #c9a050; text-transform: uppercase; font-weight: 600;">${traitType === 'attribute' ? 'Atributo' : traitType === 'ability' ? 'Habilidade' : 'Poder'}:</span>
        <span style="font-size: 15px; font-weight: bold; color: #fff;">${traitLabel} (${primaryValue})</span>
      </div>
      ` : ''}

      <!-- COMBINAR COM -->
      <div style="display: flex; flex-direction: column; gap: 4px;">
        <label for="wod-dialog-secondary" style="font-size: 12px; font-weight: 600; color: #c9a050; text-transform: uppercase;">${secondaryLabelText}</label>
        <select id="wod-dialog-secondary" onchange="window._wodUpdatePool()" style="padding: 6px 10px; border-radius: 4px; background: #201d26; color: #fff; border: 1px solid #791118; font-size: 13px; font-family: sans-serif;">
          ${secondarySelectHtml}
        </select>
      </div>

      <!-- MODIFICADOR E DIFICULDADE -->
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
        <div style="display: flex; flex-direction: column; gap: 4px;">
          <label for="wod-dialog-mod" style="font-size: 11px; font-weight: 600; color: #c9a050; text-transform: uppercase;">Modificador (+/-):</label>
          <input type="number" id="wod-dialog-mod" value="0" min="-20" max="20" oninput="window._wodUpdatePool()" style="padding: 6px 8px; border-radius: 4px; background: #201d26; color: #fff; border: 1px solid #791118; font-size: 14px; font-weight: bold; text-align: center;" />
        </div>
        <div style="display: flex; flex-direction: column; gap: 4px;">
          <label for="wod-dialog-diff" style="font-size: 11px; font-weight: 600; color: #c9a050; text-transform: uppercase;">Dificuldade (2-10):</label>
          <input type="number" id="wod-dialog-diff" value="${difficulty || 6}" min="2" max="10" style="padding: 6px 8px; border-radius: 4px; background: #201d26; color: #fff; border: 1px solid #791118; font-size: 14px; font-weight: bold; text-align: center;" />
        </div>
      </div>

      <!-- CHECKBOXES -->
      <div style="display: flex; flex-direction: column; gap: 6px; margin-top: 2px; border-top: 1px solid rgba(255,255,255,0.08); padding-top: 8px;">
        <label style="display: flex; align-items: center; gap: 8px; cursor: pointer; color: #f5eedf; font-family: sans-serif; font-size: 12px;">
          <input type="checkbox" id="wod-dialog-spec" ${specialty ? 'checked' : ''} style="accent-color: #c9a050; width: 16px; height: 16px;" />
          <span>Especialização (10s contam dobro)</span>
        </label>
        <label style="display: flex; align-items: center; gap: 8px; cursor: pointer; color: #f5eedf; font-family: sans-serif; font-size: 12px;">
          <input type="checkbox" id="wod-dialog-wp" ${willpower ? 'checked' : ''} style="accent-color: #8b0000; width: 16px; height: 16px;" />
          <span>Gastar Força de Vontade (+1 Sucesso)</span>
        </label>
      </div>
    </div>
  `;

  const DialogClass = window.Loom?.LoomDialog || LoomDialog;

  if (DialogClass?.wait) {
    try {
      const result = await DialogClass.wait({
        window: { title: dialogTitle },
        width: 380,
        content: contentHtml,
        buttons: [
          {
            action: 'roll',
            label: '🎲 Rolar Dados',
            variant: 'primary',
            default: true,
            callback: (event, button, dialog) => {
              const body = dialog.getBody ? dialog.getBody() : dialog.element;
              const secSelect = body?.querySelector('#wod-dialog-secondary');
              const modInput = body?.querySelector('#wod-dialog-mod');
              const diffInput = body?.querySelector('#wod-dialog-diff');
              const specInput = body?.querySelector('#wod-dialog-spec');
              const wpInput = body?.querySelector('#wod-dialog-wp');

              const [secKey, secValStr, secLabel] = (secSelect?.value || 'none|0|').split('|');
              const secVal = parseInt(secValStr, 10) || 0;
              const modVal = parseInt(modInput?.value, 10) || 0;
              const diffVal = parseInt(diffInput?.value, 10) || 6;
              const specVal = Boolean(specInput?.checked);
              const wpVal = Boolean(wpInput?.checked);

              const totalPool = Math.max(1, primaryValue + secVal + modVal + healthPenalty);

              const parts = [];
              if (traitLabel) parts.push(`${traitLabel} (${primaryValue})`);
              if (secKey !== 'none' && secLabel) parts.push(`${secLabel} (${secVal})`);
              if (modVal !== 0) parts.push(`${modVal > 0 ? '+' : ''}${modVal}`);
              if (healthPenalty < 0) parts.push(`Ferimento ${healthPenalty}`);

              const dynamicLabel = parts.join(' + ') || label || dialogTitle;

              return {
                pool: totalPool,
                difficulty: diffVal,
                specialty: specVal,
                willpower: wpVal,
                label: dynamicLabel
              };
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

      if (!result || typeof result !== 'object') return;

      if (result.willpower && actor && actor.systemData?.willpower?.value > 0) {
        try {
          const newWp = Math.max(0, actor.systemData.willpower.value - 1);
          actor.update?.({ 'systemData.willpower.value': newWp });
        } catch (err) {
          console.warn('[WoD20th] Erro ao deduzir Força de Vontade:', err);
        }
      }

      await rollWoD({
        pool: result.pool,
        difficulty: result.difficulty,
        specialty: result.specialty,
        willpower: result.willpower,
        label: result.label || label || dialogTitle,
        actor,
        actorName
      });
      return true;
    } catch (err) {
      console.warn('[WoD20th] Aviso no LoomDialog, abrindo fallback modal:', err);
    }
  }
}

/**
 * Custom Storyteller D10 Roll Card Renderer for LoomVTT
 */
export function registerWoDRollCard() {
  const Loom = globalThis.Loom;
  if (!Loom?.wraps?.renderRollCard) return;

  Loom.wraps.renderRollCard.addWrapper((original, roll, esc = (s) => s) => {
    const formula = String(roll.formula || '').trim();
    const plainD10 = !roll.meta?.system && /^[0-9]*d10$/i.test(formula);
    if (!roll.meta?.wod20th && roll.meta?.system !== 'wod20th' && !plainD10) {
      return original(roll, esc);
    }

    const meta = roll.meta || {};
    const diceTerms = (roll.terms || []).filter(t => t.kind === 'dice');
    const rollValues = [];

    for (const term of diceTerms) {
      if (Array.isArray(term.rolls)) {
        term.rolls.forEach((r, i) => {
          if (!term.dropped?.[i]) rollValues.push(r);
        });
      }
    }

    // Fallback caso terms não venha preenchido
    if (rollValues.length === 0 && Array.isArray(roll.dice?.[0]?.results)) {
      roll.dice[0].results.forEach(d => {
        rollValues.push(typeof d === 'object' ? d.result : d);
      });
    }

    const difficulty = parseInt(meta.difficulty, 10) || 6;
    const specialty = Boolean(meta.specialty);
    const willpower = Boolean(meta.willpower);
    const actorName = meta.actorName || t('system.sheet.name', 'Personagem');
    const label = meta.label || t('system.dialog.generalRoll', 'Rolagem WoD 20th');
    const pool = parseInt(meta.pool, 10) || rollValues.length || 1;

    const result = calculateWoDSuccesses(rollValues, difficulty, specialty, willpower);

    let statusText = '';
    let statusClass = '';

    if (result.isBotch) {
      statusText = 'FALHA CRÍTICA (FALHA TOTAL / BOTCH)';
      statusClass = 'botch';
    } else if (result.isFailure) {
      statusText = 'FALHA (0 Sucessos)';
      statusClass = 'fail';
    } else {
      const succLabel = result.totalSuccesses === 1 ? 'Sucesso' : 'Sucessos';
      statusText = `${result.totalSuccesses} ${succLabel}`;
      statusClass = 'success';
    }

    // Geração do SVG de cada D10 facetado
    const renderD10Svg = (val) => {
      let dieState = 'neutral';
      if (val >= difficulty) {
        dieState = val === 10 ? 'crit' : 'success';
      } else if (val === 1) {
        dieState = 'one';
      }

      return `
        <div class="wod-d10-wrap ${dieState}" title="D10: ${val}">
          <svg class="wod-d10-svg" viewBox="0 0 100 115">
            <!-- Polígono Base do D10 -->
            <polygon points="50,5 92,38 76,95 50,110 24,95 8,38" class="wod-d10-body" />
            <!-- Facetas 3D -->
            <polyline points="50,5 50,55 92,38" class="wod-d10-line" />
            <polyline points="50,55 76,95" class="wod-d10-line" />
            <polyline points="50,55 50,110" class="wod-d10-line" />
            <polyline points="50,55 24,95" class="wod-d10-line" />
            <polyline points="50,55 8,38" class="wod-d10-line" />
            <!-- Número do Resultado -->
            <text x="50" y="65" text-anchor="middle" dominant-baseline="central" class="wod-d10-val">${val}</text>
          </svg>
        </div>
      `;
    };

    const diceHtml = rollValues.map(renderD10Svg).join('');

    return `
      <div class="wod20-chat-card">
        <div class="wod20-card-header">
          <div class="wod20-card-title">${esc(label)}</div>
          <div class="wod20-card-actor">${esc(actorName)}</div>
        </div>

        <div class="wod20-card-badges">
          <span class="wod20-badge diff">Dificuldade: ${difficulty}</span>
          <span class="wod20-badge pool">${pool} dados</span>
          ${specialty ? '<span class="wod20-badge spec">Especialização (10s)</span>' : ''}
          ${willpower ? '<span class="wod20-badge wp">FV Gasta (+1 Sucesso)</span>' : ''}
        </div>

        <div class="wod20-dice-container">
          ${diceHtml}
        </div>

        <div class="wod20-result-banner ${statusClass}">
          <div class="wod20-result-main">${statusText}</div>
          ${result.specialtyBonus > 0 ? `<div class="wod20-result-sub">+${result.specialtyBonus} sucesso(s) por Especialização (10s duplos)</div>` : ''}
          ${result.wpSuccess > 0 ? `<div class="wod20-result-sub">+1 Sucesso Automático (Força de Vontade)</div>` : ''}
          ${result.ones > 0 && result.rawSuccesses > 0 ? `<div class="wod20-result-sub">-${result.ones} sucesso(s) cancelados por 1s</div>` : ''}
        </div>
      </div>
    `;
  });
}
