/*
 * championship-enterprise-sheet / enterprise-sheet.js
 * Journal Sheet предприятия для Foundry VTT V13.
 */

class ChampionshipEnterpriseSheet extends JournalSheet {
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      classes: ['championship-enterprise', 'journal-sheet'],
      template: 'modules/championship-enterprise-sheet/templates/enterprise-sheet.hbs',
      width: 980,
      height: 760,
      resizable: true,
      tabs: [{ navSelector: '.tabs', contentSelector: '.enterprise-body', initial: 'main' }]
    });
  }

  get title() {
    return `${this.document.name} — Лист предприятия`;
  }

  async getData(options = {}) {
    const context = await super.getData(options);
    const api = game.championshipEnterpriseSheet?.api;
    const data = api?.getEnterpriseData(this.document) ?? {};
    const calculated = api?.calculateEnterprise(data) ?? {};
    const core = game.championshipCore?.api;
    const teams = core?.getTeams?.() ?? [];

    return foundry.utils.mergeObject(context, {
      enterprise: data,
      calculated,
      teams,
      canEditEnterprise: this._canEditEnterprise(data),
      powerOptions: [0, 20, 40, 60, 80, 100],
      sourceOptions: [
        '[Добыча] Природные ресурсы',
        'Покупка [Регион]',
        'Покупка [Участник]',
        'Перевозка [П1]',
        'Перевозка [П2]',
        'Перевозка [П3]',
        'Перевозка [П4]',
        'Склад'
      ],
      outputActionOptions: [
        'Продажа [Регион]',
        'Продажа [Участник]',
        'Перевозка [П1]',
        'Перевозка [П2]',
        'Перевозка [П3]',
        'Перевозка [П4]',
        'Складирование'
      ]
    });
  }

  _canEditEnterprise(data = {}) {
    if (game.user?.isGM) return true;
    const teamId = data.teamId || this.document.getFlag('championshipCore', 'teamId');
    if (!teamId) return this.document.testUserPermission(game.user, 'OWNER');
    return Boolean(game.championshipCore?.api?.canUserEditTeam?.(game.user.id, teamId));
  }

  activateListeners(html) {
    super.activateListeners(html);
    if (!this.isEditable) return;

    html.find('[data-action="save-enterprise"]').on('click', ev => {
      ev.preventDefault();
      this._saveForm(html);
    });

    html.find('[data-action="link-company"]').on('click', ev => {
      ev.preventDefault();
      this._linkToCompany(html);
    });

    html.find('[data-action="add-input"]').on('click', ev => {
      ev.preventDefault();
      this._addRow('inputs');
    });

    html.find('[data-action="add-output"]').on('click', ev => {
      ev.preventDefault();
      this._addRow('outputs');
    });

    html.find('[data-action="remove-row"]').on('click', ev => {
      ev.preventDefault();
      const collection = ev.currentTarget.dataset.collection;
      const index = Number(ev.currentTarget.dataset.index);
      this._removeRow(collection, index);
    });
  }

  async _saveForm(html) {
    const form = html.find('form.championship-enterprise-form')[0];
    const formData = new FormDataExtended(form).object;
    const existing = game.championshipEnterpriseSheet.api.getEnterpriseData(this.document);
    const data = game.championshipEnterpriseSheet.api.normalizeEnterpriseData({
      ...existing,
      ...formData,
      inputs: this._collectRows(form, 'inputs'),
      outputs: this._collectRows(form, 'outputs')
    });

    if (!this._canEditEnterprise(data)) {
      ui.notifications.warn('У вас нет прав на изменение этого предприятия.');
      return;
    }

    await game.championshipEnterpriseSheet.api.setEnterpriseData(this.document, data);
    await this.document.update({
      [`flags.championshipCore.type`]: 'enterprise',
      [`flags.championshipCore.teamId`]: data.teamId,
      [`flags.championshipCore.companyJournalUuid`]: data.companyJournalUuid,
      [`flags.championshipCore.enterpriseCode`]: data.enterpriseCode,
      [`flags.championshipCore.enterpriseName`]: data.enterpriseName
    });

    ui.notifications.info('Лист предприятия сохранён.');
    this.render(true);
  }

  _collectRows(form, collection) {
    const rows = [];
    const rowEls = form.querySelectorAll(`[data-row-collection="${collection}"]`);
    for (const row of rowEls) {
      rows.push({
        action: row.querySelector('[name$=".action"]')?.value ?? '',
        resource: row.querySelector('[name$=".resource"]')?.value ?? '',
        quantity: Number(row.querySelector('[name$=".quantity"]')?.value ?? 0),
        price: Number(row.querySelector('[name$=".price"]')?.value ?? 0),
        logistics: Number(row.querySelector('[name$=".logistics"]')?.value ?? 0)
      });
    }
    return rows;
  }

  async _linkToCompany(html) {
    const teamId = html.find('[name="teamId"]').val();
    const team = game.championshipCore?.api?.getTeam?.(teamId);
    if (!team?.companyJournalUuid) {
      ui.notifications.warn('Выберите команду с журналом компании.');
      return;
    }

    await this._saveForm(html);
    await game.championshipCore.api.linkEnterpriseToCompany(team.companyJournalUuid, this.document.uuid, {
      enterpriseCode: html.find('[name="enterpriseCode"]').val(),
      enterpriseName: html.find('[name="enterpriseName"]').val() || this.document.name
    });
    ui.notifications.info('Предприятие связано с компанией.');
    this.render(true);
  }

  async _addRow(collection) {
    const data = game.championshipEnterpriseSheet.api.getEnterpriseData(this.document);
    data[collection] = Array.isArray(data[collection]) ? data[collection] : [];
    data[collection].push({ action: '', resource: '', quantity: 0, price: 0, logistics: 0 });
    await game.championshipEnterpriseSheet.api.setEnterpriseData(this.document, data);
    this.render(true);
  }

  async _removeRow(collection, index) {
    const data = game.championshipEnterpriseSheet.api.getEnterpriseData(this.document);
    data[collection] = Array.isArray(data[collection]) ? data[collection] : [];
    data[collection].splice(index, 1);
    await game.championshipEnterpriseSheet.api.setEnterpriseData(this.document, data);
    this.render(true);
  }
}

Hooks.once('init', () => {
  if (DocumentSheetConfig?.registerSheet) {
    DocumentSheetConfig.registerSheet(JournalEntry, 'championship-enterprise-sheet', ChampionshipEnterpriseSheet, {
      label: 'Чемпионат — Лист предприятия',
      makeDefault: false
    });
  }

  game.championshipEnterpriseSheet = game.championshipEnterpriseSheet ?? {};
  game.championshipEnterpriseSheet.EnterpriseSheet = ChampionshipEnterpriseSheet;
});
