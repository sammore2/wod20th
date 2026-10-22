# Changelog

All notable changes to this project are documented here.
Each release tag `vX.Y.Z` publishes the section headed `## [X.Y.Z]` as its release notes.

## [Unreleased]

## [0.1.0]

### Added
- **Storyteller 20th Edition Dice Engine**:
  - D10 dice pools against configurable difficulty (2 to 10).
  - 1s cancellation logic with accurate calculation of Successes, Simple Failure (0 successes), and Botch (critical failure).
  - Specializations support (10s counting as two successes) and Willpower expenditure (+1 uncancelable success).
  - Interactive chat roll cards with dice breakdown and margin of success.
- **7 Full Character Sheets**:
  - Vampire (`vampire`), Werewolf (`werewolf`), Mage (`mage`), Hunter (`hunter`), Mortal (`mortal`), Changeling (`changeling`), Wraith (`wraith`).
  - Preloaded Handlebars partials sharing Attributes, Abilities, Combat/Health, and Biography/Experience across all splats.
- **Creature Rules & System Automations**:
  - **Vampire (V20)**: Generation-based blood pool and blood-per-turn limits, Blood Healing action, Virtues, and Humanity/Paths.
  - **Werewolf (W20)**: The 5 Garou forms (*Homid, Glabro, Crinos, Hispo, Lupus*) with active attribute adjustments, aggravated damage, and quick form shift. Rage, Gnosis, and Renown (Glory, Honor, Wisdom) tracking.
  - **Mage (M20)**: The 9 Spheres, Arete & Magick difficulty calculator (Coincidental vs. Vulgar with/without witnesses), Quintessence and 20-step Paradox Wheel with Backlash test.
  - **Hunter & Mortal**: Streamlined classic layouts with Conviction tracking.
- **Unified Disciplines System**:
  - Disciplines integrated directly as items on the actor sheet with instant dot adjustment and full power trees.
  - Edit window (`WoDItemSheet`) to customize dice pools (Attribute + Ability), difficulties, costs, and descriptions, or prefill from the official V20 catalog.
- **Universal Item Sheet (`WoDItemSheet`)**:
  - Specialized configurations for all 24 Storyteller item types (weapons, armor, gifts, rotes, wonders, fetishes, talens, rites, totems, merits, flaws, backgrounds, etc.).
- **Dark Pack Legal Compliance**:
  - Attribution footer in the LoomVTT sidebar settings tab with official Dark Pack logo and copyright notice under Paradox Interactive's policy.
