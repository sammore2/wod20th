# World of Darkness 20th Edition (WoD20) for LoomVTT

[![Loom VTT](https://img.shields.io/badge/Loom%20VTT-2.0.5--alpha-blueviolet)](https://loomvtt.com)
[![License](https://img.shields.io/badge/license-GPL--3.0--or--later-blue)](LICENSE)
[![Downloads](https://img.shields.io/github/downloads/sammore2/wod20th/latest/wod20th.zip?label=downloads)](https://github.com/sammore2/wod20th/releases/latest)

Official ruleset implementation for LoomVTT compatible with the World of Darkness 20th Anniversary Edition lineup (Storyteller System).

## Features & Implemented Mechanics

### 1. Storyteller 20th Dice Engine
- **d10 Dice Pool** against configurable Difficulty (2 to 10).
- **1s Cancellation** with precise mathematical detection of **Successes**, **Simple Failure**, and **Botch (Critical Failure)**.
- **Specializations** (10s count as two successes).
- **Willpower Expenditure** (+1 guaranteed Success that cannot be cancelled by 1s).
- Fast modal dialog and thematic chat card in LoomVTT chat.

### 2. Modular Sheet Architecture (Zero Redundancy & High Performance)
- **Precompiled Partials:** The system preloads all templates into memory (`loadTemplates`), sharing Attributes, Abilities, Health, Combat, and Biography/XP across character sheets.
- **5 Comprehensive Tabs:**
  1. *Attributes & Abilities:* 9 Attributes, 30 Abilities with specialization fields (4+ dots), and 1-click roll combos.
  2. *Advantages & Resources:* Dynamically adapts based on character type.
  3. *Special Tab:* **Garou Forms** for Werewolf or **Spheres & Magick** for Mage.
  4. *Health & Combat:* 7 health levels with wound penalties, Initiative, Soak, and Weapon/Armor tables.
  5. *Biography & Experience:* Prelude/Background, Visual description, Contacts, and Total/Unspent XP tracker.

### 3. Creature-Specific Mechanics
- **Werewolf (W20):**
  - **The 5 Garou Forms:** *Homid, Glabro, Crinos, Hispo, and Lupus* with real-time attribute modifiers, aggravated damage in Crinos/Hispo, rapid regeneration, and Delirium.
  - **Garou Triad:** Rage (with Frenzy rolls), Gnosis (with stepping sideways into the Umbra), and Renown (Glory, Honor, Wisdom).
- **Mage (M20):**
  - **The 9 Spheres:** Correspondence, Entropy, Forces, Matter, Mind, Prime, Life, Time, and Spirit.
  - **Arete & Magick Calculator:** Automated difficulty calculation (Coincidental vs. Vulgar with/without witnesses) and Quintessence channeling.
  - **Quintessence & Paradox Wheel (20 points)** with Paradox Backlash test.
- **Vampire (V20):**
  - **Automated Generation Table:** Generation calculates maximum Blood Pool (10 to 50) and expenditure per turn (1 to 10).
  - Quick action for **Blood Healing** (heals 1 bashing or lethal damage level).
  - Virtues (Conscience/Conviction, Self-Control/Instinct, Courage) and Humanity/Path of Enlightenment.
- **Mortal & Hunter:**
  - Clean sheet layout without supernatural clutter, featuring Conviction boxes for Hunters.

### 4. Universal Item Sheet (`WoDItemSheet`)
- Dedicated support for **all 24 WoD 20th item types**:
  - *Werewolf:* Fetishes (`fetish`), Talens (`talen`), Rites (`rite`), Totems (`totem`), Gifts (`gift`).
  - *Mage:* Rotes (`rote`), Wonders (`wonder`), Grimoires (`grimoire`), Talismans (`talisman`), Artifacts (`artifact`).
  - *Vampire:* Disciplinas (`discipline`), Rituals (`ritual`), Paths (`path`).
  - *General:* Weapons (`weapon`), Armor (`armor`), Backgrounds (`background`), Merits & Flaws (`merit`, `flaw`).

### 5. Multi-Language (i18n)
- 100% of terms, attributes, abilities, items, and dialogs support both **Portuguese (Brazil)** and **English**.

## Legal Notice

Portions of the materials are the copyrights and trademarks of Paradox Interactive AB, and are used with permission. All rights reserved. For more information please visit worldofdarkness.com.

This material is not official World of Darkness material. It is an unofficial fan project, free and non-commercial.

<img src="assets/logos/darkpack-logo-color.png" alt="Dark Pack" width="180" />

