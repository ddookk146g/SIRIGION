/* championship-core / admin-panel.js
 * GM-панель ядра чемпионата.
 * Это помощник администратора, а не полностью автоматическая игровая система.
 */

class ChampionshipCoreAdminPanel extends Application {
  constructor(options = {}) {
    const savedPosition = game.settings.get('championship-core', 'adminPanelPosition') || {};
    super(foundry.utils.mergeObject(savedPosition, options));
    this.activeTab = options.activeTab || 'overview';
  }

  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      id: 'championship-core-admin-panel',
      classes: ['championship-core', 'championship-core-admin', 'sheet'],
      title: 'Чемпионат — Администрирование ядра',
      template: 'modules/championship-core/templates/admin-panel.hbs',
      width: 1120,
      height: 760,
      resizable: true,
      popOut: true,
      minimizable: true,
      tabs: [{
        navSelector: '.championship-core-tabs',
        contentSelector: '.championship-core-tab-content',
        initial: 'overview'
      }]
    });
  }

  async close(options) {
    await this.#saveWindowState();
    return super.close(options);
  }

  async setPosition(position = {}) {
    const result = await super.setPosition(position);
    await this.#saveWindowState();
    return result;
  }

  async #saveWindowState() {
    if (!game.user?.isGM) return;

    await game.settings.set('championship-core', 'adminPanelPosition', {
      left: this.position.left,
      top: this.position.top,
      width: this.position.width,
      height: this.position.height
    });
  }

  getData() {
    if (!game.user?.isGM) {
      return { isGM: false };
    }

    const api = game.championshipCore.api;

    return {
      isGM: true,
      activeTab: this.activeTab,
      currentTurn: api.getCurrentTurn(),
      maxTurns: api.getMaxTurns(),
      isTurnOpen: api.isTurnOpen(),
      turnStatus: api.getTurnStatus(),
      users: game.users.contents.map(user => ({
        id: user.id,
        name: user.name,
        isGM: user.isGM
      })),
      statuses: Object.entries(api.STATUS_LABELS).map(([value, label]) => ({ value, label })),
      teams: api.getTeams().map(t => ({
        ...t,
        statusLabel: api.STATUS_LABELS[t.currentTurnStatus] ?? t.currentTurnStatus,
        enterpriseCount: t.enterpriseJournalUuids?.length ?? 0,
        plotCount: t.ownedPlotJournalUuids?.length ?? 0,
        usersLabel: (t.userIds ?? []).map(id => game.users.get(id)?.name ?? id).join(', ') || '—'
      }))
    };
  }

  activateListeners(html) {
    super.activateListeners(html);

    if (!game.user?.isGM) return;

    html.find('[data-action="refresh"]').on('click', async () => {
      await game.championshipCore.api.refreshTeamsFromJournals();
      this.render(true);
    });

    html.find('[data-action="open-turn"]').on('click', async () => {
      await game.championshipCore.api.setTurnOpen(true);
      this.render(true);
    });

    html.find('[data-action="close-turn"]').on('click', async () => {
      await game.championshipCore.api.setTurnOpen(false);
      this.render(true);
    });

    html.find('[data-action="next-turn"]').on('click', async () => {
      const api = game.championshipCore.api;
      const nextTurn = Math.min(api.getCurrentTurn() + 1, api.getMaxTurns());
      await api.setCurrentTurn(nextTurn);
      await api.setTurnOpen(true);
      this.render(true);
    });

    html.find('[data-action="save-turn-settings"]').on('click', async ev => {
      ev.preventDefault();
      const form = html.find('form[data-form="turn-settings"]')[0];
      const formData = new FormData(form);
      const api = game.championshipCore.api;

      await api.setMaxTurns(Number(formData.get('maxTurns')) || 10);
      await api.setCurrentTurn(Number(formData.get('currentTurn')) || 1);
      await api.setTurnOpen(formData.get('isTurnOpen') === 'on');

      ui.notifications.info('Настройки хода сохранены.');
      this.render(true);
    });

    html.find('[data-action="create-team"]').on('click', async ev => {
      ev.preventDefault();

      const form = html.find('form[data-form="create-team"]')[0];
      const formData = new FormData(form);
      const teamName = String(formData.get('teamName') ?? '').trim();

      if (!teamName) {
        ui.notifications.warn('Введите название команды.');
        return;
      }

      await game.championshipCore.api.createTeam({
        teamName,
        userIds: formData.getAll('userIds').filter(Boolean),
        currentBalance: Number(formData.get('currentBalance')) || 400000
      });

      ui.notifications.info(`Команда «${teamName}» создана.`);
      form.reset();
      this.render(true);
    });

    html.find('[data-action="save-team"]').on('click', async ev => {
      ev.preventDefault();

      const row = ev.currentTarget.closest('[data-team-id]');
      const teamId = row?.dataset.teamId;
      if (!teamId) return;

      await game.championshipCore.api.updateTeam(teamId, {
        teamName: row.querySelector('[name="teamName"]')?.value?.trim() || 'Команда',
        currentTurnStatus: row.querySelector('[name="currentTurnStatus"]')?.value || 'draft',
        currentBalance: Number(row.querySelector('[name="currentBalance"]')?.value) || 0,
        availableInvestmentPoints: Number(row.querySelector('[name="availableInvestmentPoints"]')?.value) || 0,
        totalInvestmentPoints: Number(row.querySelector('[name="totalInvestmentPoints"]')?.value) || 0,
        userIds: Array.from(row.querySelectorAll('input[name="userIds"]:checked')).map(input => input.value)
      });

      ui.notifications.info('Команда обновлена.');
      this.render(true);
    });

    html.find('[data-action="open-company"]').on('click', async ev => {
      const teamId = ev.currentTarget.closest('[data-team-id]')?.dataset.teamId;
      const journal = await game.championshipCore.api.getCompanyJournal(teamId);

      if (journal?.sheet) journal.sheet.render(true);
      else ui.notifications.warn('Журнал компании не найден.');
    });

    html.find('[data-action="delete-team"]').on('click', async ev => {
      ev.preventDefault();

      const row = ev.currentTarget.closest('[data-team-id]');
      const teamId = row?.dataset.teamId;
      const teamName = row?.querySelector('[name="teamName"]')?.value || 'команду';

      const confirmed = await Dialog.confirm({
        title: 'Удалить команду',
        content: `<p>Удалить ${foundry.utils.escapeHTML(teamName)} из ядра?</p>`,
        yes: () => true,
        no: () => false,
        defaultYes: false
      });

      if (!confirmed) return;

      await game.championshipCore.api.deleteTeam(teamId, { deleteCompanyJournal: false });

      ui.notifications.info('Команда удалена из ядра.');
      this.render(true);
    });
  }
}

Hooks.once('ready', () => {
  game.championshipCore = game.championshipCore || {};

  game.championshipCore.AdminPanel = ChampionshipCoreAdminPanel;
  game.championshipCore.openAdminPanel = () => {
    const existing = Object.values(ui.windows).find(w => w instanceof ChampionshipCoreAdminPanel);

    if (existing) {
      existing.bringToTop();
      return existing;
    }

    return new ChampionshipCoreAdminPanel().render(true);
  };

  Hooks.on('getSceneControlButtons', controls => {
    if (!game.user?.isGM) return;

    controls.push({
      name: 'championship-core',
      title: 'Чемпионат',
      icon: 'fas fa-trophy',
      layer: 'controls',
      tools: [{
        name: 'open-core-panel',
        title: 'Открыть админ-панель ядра',
        icon: 'fas fa-building-columns',
        button: true,
        onClick: () => game.championshipCore.openAdminPanel()
      }]
    });
  });
});
