import assert from 'node:assert/strict';
import {
  WEREWOLF_FORMS,
  getActiveWerewolfAttributes,
  getVampireGenerationLimits,
  calculateInitiative,
  calculateSoakPool
} from '../scripts/creature-rules.mjs';

// 1. Test Werewolf Form Modifiers
{
  const baseAttrs = {
    strength: 2,
    dexterity: 3,
    stamina: 2,
    manipulation: 2,
    appearance: 2,
    perception: 3
  };

  const homid = getActiveWerewolfAttributes(baseAttrs, 'homid');
  assert.equal(homid.attributes.strength, 2);
  assert.equal(homid.attributes.dexterity, 3);

  const crinos = getActiveWerewolfAttributes(baseAttrs, 'crinos');
  assert.equal(crinos.attributes.strength, 6, 'Crinos adds +4 Strength');
  assert.equal(crinos.attributes.dexterity, 4, 'Crinos adds +1 Dexterity');
  assert.equal(crinos.attributes.stamina, 5, 'Crinos adds +3 Stamina');
  assert.equal(crinos.attributes.manipulation, 0, 'Crinos sets Manipulation to 0');
  assert.equal(crinos.attributes.appearance, 0, 'Crinos sets Appearance to 0');
}

// 2. Test Vampire Generation Limits
{
  const gen13 = getVampireGenerationLimits('13ª');
  assert.equal(gen13.maxBlood, 10);
  assert.equal(gen13.bloodPerTurn, 1);
  assert.equal(gen13.maxTrait, 5);

  const gen8 = getVampireGenerationLimits('8ª');
  assert.equal(gen8.maxBlood, 15);
  assert.equal(gen8.bloodPerTurn, 3);
  assert.equal(gen8.maxTrait, 5);

  const gen4 = getVampireGenerationLimits('4ª');
  assert.equal(gen4.maxBlood, 50);
  assert.equal(gen4.bloodPerTurn, 10);
  assert.equal(gen4.maxTrait, 9);
}

// 3. Test Initiative Calculations
{
  const actor = {
    attributes: { dexterity: 3, wits: 4 },
    abilities: { alertness: { value: 2 } }
  };

  // Dex + Wits (Default)
  assert.equal(calculateInitiative(actor, 'dex_wits'), 7);

  // Dex + Alertness
  assert.equal(calculateInitiative(actor, 'dex_alertness'), 5);

  // Wits + Alertness
  assert.equal(calculateInitiative(actor, 'wits_alertness'), 6);
}

// 4. Test Soak Pool Calculations
{
  assert.equal(calculateSoakPool(3, 2), 5, 'Stamina 3 + Armor 2 = 5');
  assert.equal(calculateSoakPool(2, 0), 2, 'Stamina 2 + Armor 0 = 2');
  assert.equal(calculateSoakPool(0, 0), 1, 'Minimum stamina defaults to 1');
}

console.log('✓ All creature-rules tests passed.');
