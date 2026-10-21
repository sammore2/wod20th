# Contributing to World of Darkness 20th Edition for LoomVTT

Thank you for contributing to the WoD20 ruleset! To ensure consistency, stability, and compatibility with LoomVTT, please adhere to the following guidelines.

## Code Standards & Architecture

1. **Pure Functional Mechanics:**
   - Keep roll math and business logic decoupled from DOM/Sheet state.
   - All dice rolling algorithms must follow official Storyteller 20th Anniversary Edition rules (target numbers 2-10, 1s cancel successes, botch on 0 successes with at least one 1).

2. **Template Architecture:**
   - Use Handlebars (`.hbs`) templates located in `templates/`.
   - Reusable components must be registered as partials in `templates/partials/` and loaded in `sheets/` via `loadTemplates`.
   - Avoid hardcoded localized strings; use Handlebars localization helpers (`{{localize "KEY"}}`).

3. **Internationalization (i18n):**
   - Add all new strings to both `lang/en.json` and `lang/pt-BR.json`.
   - Maintain sorted keys or structured namespaces for readability.

4. **Styling & Assets:**
   - Place ruleset styles in `styles/system.css`.
   - Maintain the dark Gothic-Punk aesthetic consistent with World of Darkness themes.
   - Keep assets optimized and placed within `assets/`.

5. **Commit Conventions:**
   - Use Conventional Commits (`feat:`, `fix:`, `docs:`, `refactor:`, `style:`, `test:`).
   - Write clear, concise commit summaries explaining what changed and why.

## Submitting Pull Requests

1. Fork the repository and create your branch from `main`.
2. Test your changes locally in LoomVTT to ensure sheets render and rolls execute properly.
3. Submit a Pull Request describing your motivation and testing verification.
