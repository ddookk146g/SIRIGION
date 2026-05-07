/* championship-core / admin-panel.js
 * Отдельная GM-панель ядра чемпионата.
 * Окно наследуется от Foundry Application, поэтому перемещается за стандартный заголовок окна.
 */

class ChampionshipCoreAdminPanel extends Application {
  constructor(options = {}) {
    super(options);
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
      tabs: [{ navSelector: '.championship-core-tabs', contentSelector: '.championship-core-tab-content', initial: 'overview' }]
    });
  }

  get title() {
    return 'Чемпионат — Администрирование ядра';
  }

  getData() {
    if (!game.user?.isGM) {
      return { isGM: false };
    }

    const api = game.championshipCore.api;
    const users = game.users.contents.map(user => ({
      id: user.id,
      name: user.name,
      isGM: user.isGM
    }));

    const statuses = Object.entries(api.STATUS_LABELS).map(([value, label]) => ({ value, label }));

    return {
      isGM: true,
      activeTab: this.activeTab,
      currentTurn: api.getCurrentTurn(),
      maxTurns: api.getMaxTurns(),
      isTurnOpen: api.isTurnOpen(),
      turnStatus: api.getTurnStatus(),
      users,
      statuses,
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

    html.find('.championship-core-tabs [data-tab]').on('click', ev => {
      this.activeTab = ev.currentTarget.dataset.tab;
    });

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
      const userIds = formData.getAll('userIds').filter(Boolean);
      const currentBalance = Number(formData.get('currentBalance')) || 400000;
      await game.championshipCore.api.createTeam({ teamName, userIds, currentBalance });
      form.reset();
      this.render(true);
    });

    html.find('[data-action="open-company"]').on('click', async ev => {
      const teamId = ev.currentTarget.dataset.teamId;
      const journal = await game.championshipCore.api.getCompanyJournal(teamId);
      if (journal?.sheet) journal.sheet.render(true);
      else ui.notifications.warn('Журнал компании не найден.');
    });

    html.find('[data-action="save-team"]').on('click', async ev => {
      ev.preventDefault();
      const row = ev.currentTarget.closest('[data-team-id]');
      const teamId = row?.dataset.teamId;
      if (!teamId) return;

      const userIds = Array.from(row.querySelectorAll('input[name="userIds"]:checked')).map(input => input.value);
      const data = {
        teamName: row.querySelector('[name="teamName"]')?.value?.trim() || 'Команда',
        currentTurnStatus: row.querySelector('[name="currentTurnStatus"]')?.value || 'draft',
        currentBalance: Number(row.querySelector('[name="currentBalance"]')?.value) || 0,
        availableInvestmentPoints: Number(row.querySelector('[name="availableInvestmentPoints"]')?.value) || 0,
        totalInvestmentPoints: Number(row.querySelector('[name="totalInvestmentPoints"]')?.value) || 0,
        userIds
      };

      await game.championshipCore.api.updateTeam(teamId, data);
      this.render(true);
    });

    html.find('[data-action="delete-team"]').on('click', async ev => {
      ev.preventDefault();
      const row = ev.currentTarget.closest('[data-team-id]');
      const teamId = row?.dataset.teamId;
      const teamName = row?.querySelector('[name="teamName"]')?.value || 'команду';
      if (!teamId) return;

      const confirmed = await Dialog.confirm({
        title: 'Удалить команду',
        content: `<p>Удалить ${foundry.utils.escapeHTML(teamName)} из ядра?</p><p>Журнал компании будет отвязан от ядра, но не удалён.</p>`,
        yes: () => true,
        no: () => false,
        defaultYes: false
      });
      if (!confirmed) return;

      await game.championshipCore.api.deleteTeam(teamId, { deleteCompanyJournal: false });
      this.render(true);
    });

    html.find('[data-action="accept-turn"]').on('click', async ev => {
      const teamId = ev.currentTarget.closest('[data-team-id]')?.dataset.teamId;
      await game.championshipCore.api.setTeamTurnStatus(teamId, 'accepted');
      this.render(true);
    });

    html.find('[data-action="reject-turn"]').on('click', async ev => {
      const teamId = ev.currentTarget.closest('[data-team-id]')?.dataset.teamId;
      await game.championshipCore.api.setTeamTurnStatus(teamId, 'rejected');
      this.render(true);
    });

    html.find('[data-action="draft-turn"]').on('click', async ev => {
      const teamId = ev.currentTarget.closest('[data-team-id]')?.dataset.teamId;
      await game.championshipCore.api.setTeamTurnStatus(teamId, 'draft');
      this.render(true);
    });
  }
}

Hooks.once('ready', () => {
  game.championshipCore = game.championshipCore || {};
  game.championshipCore.AdminPanel = ChampionshipCoreAdminPanel;
  game.championshipCore.openAdminPanel = () => new ChampionshipCoreAdminPanel().render(true);

  Hooks.on('getSceneControlButtons', controls => {
    if (!game.user?.isGM) return;

    controls.push({
      name: 'championship-core',
      title: 'Чемпионат',
      icon: 'fas fa-trophy',
      layer: 'controls',
      tools: [
        {
          name: 'open-core-panel',
          title: 'Открыть админ-панель ядра',
          icon: 'fas fa-building-columns',
          button: true,
          onClick: () => game.championshipCore.openAdminPanel()
        }
      ]
    });
  });
});
