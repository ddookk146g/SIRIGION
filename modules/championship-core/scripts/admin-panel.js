/* championship-core / admin-panel.js */

class ChampionshipCoreAdminPanel extends Application {
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      id: 'championship-core-admin-panel',
      classes: ['championship-core', 'sheet'],
      title: 'Чемпионат — Ядро',
      template: 'modules/championship-core/templates/admin-panel.hbs',
      width: 980,
      height: 720,
      resizable: true,
      popOut: true
    });
  }

  getData() {
    const api = game.championshipCore.api;
    return {
      currentTurn: api.getCurrentTurn(),
      maxTurns: api.getMaxTurns(),
      isTurnOpen: api.isTurnOpen(),
      teams: api.getTeams().map(t => ({
        ...t,
        statusLabel: api.STATUS_LABELS[t.currentTurnStatus] ?? t.currentTurnStatus,
        enterpriseCount: t.enterpriseJournalUuids?.length ?? 0,
        plotCount: t.ownedPlotJournalUuids?.length ?? 0
      }))
    };
  }

  activateListeners(html) {
    super.activateListeners(html);

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

    html.find('[data-action="open-company"]').on('click', async ev => {
      const teamId = ev.currentTarget.dataset.teamId;
      const journal = await game.championshipCore.api.getCompanyJournal(teamId);
      if (journal?.sheet) journal.sheet.render(true);
    });
  }
}

Hooks.once('ready', () => {
  game.championshipCore = game.championshipCore || {};
  game.championshipCore.AdminPanel = ChampionshipCoreAdminPanel;

  Hooks.on('getSceneControlButtons', controls => {
    if (!game.user.isGM) return;

    controls.push({
      name: 'championship-core',
      title: 'Чемпионат',
      icon: 'fas fa-trophy',
      layer: 'controls',
      tools: [
        {
          name: 'open-core-panel',
          title: 'Открыть панель ядра',
          icon: 'fas fa-building',
          button: true,
          onClick: () => {
            const panel = new ChampionshipCoreAdminPanel();
            panel.render(true);
          }
        }
      ]
    });
  });
});
