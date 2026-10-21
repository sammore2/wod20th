/**
 * WoD20th - Custom Settings Tab for LoomVTT Sidebar
 * Adiciona o rodapé oficial de atribuição do Dark Pack (White Wolf / Paradox Interactive),
 * seguindo exatamente o padrão canônico do WoD5E.
 */

export function injectDarkPackNotice(rootElement) {
  if (!rootElement) return;
  const container = rootElement.classList?.contains('settings-sidebar')
    ? rootElement
    : rootElement.querySelector?.('.settings-sidebar') || rootElement;

  if (container.querySelector('#license-information, .wod-darkpack-license-section')) {
    return; // Já injetado
  }

  const title = window.Loom?.i18n?.localize?.('LicensedUnderDarkPack')
    || window.Loom?.i18n?.localize?.('system.LicensedUnderDarkPack')
    || 'Licenciado sob o Dark Pack';

  const fullText = window.Loom?.i18n?.localize?.('LicensedUnderDarkPackFulltext')
    || window.Loom?.i18n?.localize?.('system.LicensedUnderDarkPackFulltext')
    || 'Partes dos materiais são direitos autorais e marcas registradas da Paradox Interactive AB e são usadas com permissão. Todos os direitos reservados. Para mais informações, visite <a href="https://worldofdarkness.com" target="_blank" rel="noopener">worldofdarkness.com</a>.';

  const licenseHtml = `
    <section class="license flexcol wod-darkpack-license-section">
      <h4 class="divider">${title}</h4>
      <section class="info" id="license-information">
        <div class="wod-darkpack-logo-wrap">
          <img src="/marketplace/rulesets/wod20th/assets/logos/darkpack-logo-color.png" alt="Dark Pack" class="wod-darkpack-logo" />
        </div>
        <p class="wod-darkpack-text">${fullText}</p>
      </section>
    </section>
  `;

  // Localiza a seção de acesso (.access) do sidebar de configurações conforme padrão WoD5E
  const accessSection = container.querySelectorAll('.access, #settings-access, #game-details');
  if (accessSection && accessSection.length > 0) {
    accessSection[accessSection.length - 1].insertAdjacentHTML('afterend', licenseHtml);
  } else {
    container.insertAdjacentHTML('beforeend', licenseHtml);
  }
}

// Classe de Settings do Sidebar herdando da classe base do LoomVTT
const BaseSettings = window.Loom?.applications?.sidebar?.tabs?.Settings || (window.CONFIG?.ui?.settings || class {});

export class WoDSettings extends BaseSettings {
  async _onRender(context, options) {
    if (typeof super._onRender === 'function') {
      await super._onRender(context, options);
    }
    injectDarkPackNotice(this.element);
  }
}

/**
 * Inicializa a injeção do rodapé do Dark Pack no LoomVTT
 */
export function initWoDSettings() {
  if (window.CONFIG?.ui) {
    window.CONFIG.ui.settings = WoDSettings;
  }

  // Hook renderSettings para casos onde o Loom dispara evento de renderização
  const hookBus = window.LoomHooks || window.Hooks;
  if (hookBus?.on) {
    hookBus.on('renderSettings', (app, html) => {
      const el = html instanceof HTMLElement ? html : html?.[0] || app?.element;
      injectDarkPackNotice(el);
    });
  }

  // Observador no DOM para alternância de abas na barra lateral
  if (typeof document !== 'undefined') {
    const checkAndInject = () => {
      const sidebarSettings = document.querySelector('.settings-sidebar, #settings.tab, [data-tab="settings"]');
      if (sidebarSettings) {
        injectDarkPackNotice(sidebarSettings);
      }
    };

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', checkAndInject);
    } else {
      checkAndInject();
    }

    document.addEventListener('click', (e) => {
      const tabBtn = e.target.closest?.('[data-tab="settings"], .item[data-tab="settings"]');
      if (tabBtn) {
        setTimeout(checkAndInject, 50);
        setTimeout(checkAndInject, 250);
      }
    }, true);
  }
}
