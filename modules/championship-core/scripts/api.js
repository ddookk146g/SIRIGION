/*
 * championship-core / api.js
 * Публичный API ядра чемпионата.
 * Глобальное состояние хранится в game.settings.
 * Связи документов хранятся в flags.championshipCore.
 */

(() => {
  const MODULE_ID = "championship-core";
  const FLAG_SCOPE = "championshipCore";

  const TURN_STATUSES = Object.freeze({
    DRAFT: "draft",
    SUBMITTED: "submitted",
    ADMIN_REVIEW: "admin_review",
    ACCEPTED: "accepted",
    REJECTED: "rejected",
    CLOSED: "closed"
  });

  const STATUS_LABELS = Object.freeze({
    draft: "Черновик",
    submitted: "Отправлен",
    admin_review: "Проверка админом",
    accepted: "Принят",
    rejected: "Отклонён",
    closed: "Закрыт"
  });

  function randomId(prefix = "team") {
    return `${prefix}-${foundry.utils.randomID(12)}`;
  }

  function clone(data) {
    return foundry.utils.deepClone(data ?? {});
  }

  async function fromUuidSafe(uuid) {
    if (!uuid) return null;
    try {
      return await fromUuid(uuid);
    } catch (err) {
      console.warn(`${MODULE_ID} | Не удалось открыть UUID: ${uuid}`, err);
      return null;
    }
  }

  function requireGM(action = "выполнить действие") {
    if (game.user?.isGM) return true;
    ui.notifications?.warn(`Только администратор может ${action}.`);
    return false;
  }

  function getOwnershipLevel(name, fallback) {
    return CONST.DOCUMENT_OWNERSHIP_LEVELS?.[name] ?? fallback;
  }

  function getTeamsIndex() {
    const value = game.settings.get(MODULE_ID, "teamsIndex");
    return Array.isArray(value) ? clone(value) : [];
  }

  async function setTeamsIndex(teams) {
    return game.settings.set(MODULE_ID, "teamsIndex", clone(Array.isArray(teams) ? teams : []));
  }

  function normalizeUuidList(list) {
    return Array.isArray(list) ? [...new Set(list.filter(Boolean))] : [];
  }

  function normalizeTeamRecord(team = {}) {
    return {
      teamId: team.teamId || randomId(),
      teamName: team.teamName || "Новая команда",
      companyJournalUuid: team.companyJournalUuid || null,
      userIds: Array.isArray(team.userIds) ? [...new Set(team.userIds.filter(Boolean))] : [],
      currentTurnStatus: Object.values(TURN_STATUSES).includes(team.currentTurnStatus) ? team.currentTurnStatus : TURN_STATUSES.DRAFT,
      currentBalance: Number(team.currentBalance ?? 400000),
      totalInvestmentPoints: Number(team.totalInvestmentPoints ?? 0),
      availableInvestmentPoints: Number(team.availableInvestmentPoints ?? 0),
      enterpriseJournalUuids: normalizeUuidList(team.enterpriseJournalUuids),
      ownedPlotJournalUuids: normalizeUuidList(team.ownedPlotJournalUuids)
    };
  }

  async function upsertTeam(teamData) {
    const team = normalizeTeamRecord(teamData);
    const teams = getTeamsIndex();
    const index = teams.findIndex(t => t.teamId === team.teamId);
    if (index >= 0) teams[index] = team;
    else teams.push(team);
    teams.sort((a, b) => String(a.teamName).localeCompare(String(b.teamName), "ru"));
    await setTeamsIndex(teams);
    return team;
  }

  async function removeTeamFromIndex(teamId) {
    const teams = getTeamsIndex().filter(t => t.teamId !== teamId);
    await setTeamsIndex(teams);
    return teams;
  }

  async function syncCompanyFlags(teamData) {
    const team = normalizeTeamRecord(teamData);
    const journal = await fromUuidSafe(team.companyJournalUuid);
    if (!journal) return null;

    await journal.update({
      name: `Компания — ${team.teamName}`,
      ownership: getJournalOwnershipForUsers(team.userIds),
      [`flags.${FLAG_SCOPE}.type`]: "company",
      [`flags.${FLAG_SCOPE}.teamId`]: team.teamId,
      [`flags.${FLAG_SCOPE}.teamName`]: team.teamName,
      [`flags.${FLAG_SCOPE}.enterpriseJournalUuids`]: team.enterpriseJournalUuids,
      [`flags.${FLAG_SCOPE}.ownedPlotJournalUuids`]: team.ownedPlotJournalUuids,
      [`flags.${FLAG_SCOPE}.currentTurnStatus`]: team.currentTurnStatus,
      [`flags.${FLAG_SCOPE}.currentBalance`]: team.currentBalance,
      [`flags.${FLAG_SCOPE}.availableInvestmentPoints`]: team.availableInvestmentPoints,
      [`flags.${FLAG_SCOPE}.totalInvestmentPoints`]: team.totalInvestmentPoints
    });
    return journal;
  }

  function getJournalOwnershipForUsers(userIds = []) {
    const none = getOwnershipLevel("NONE", 0);
    const owner = getOwnershipLevel("OWNER", 3);
    const ownership = { default: none };
    for (const userId of userIds) ownership[userId] = owner;
    return ownership;
  }

  function canUserEditTeam(userId, teamId) {
    const user = game.users?.get(userId);
    if (user?.isGM) return true;
    const team = getTeamsIndex().find(t => t.teamId === teamId);
    return Boolean(team?.userIds?.includes(userId));
  }

  function makeCompanyPageContent(team) {
    return `
      <h1>Лист компании: ${foundry.utils.escapeHTML(team.teamName)}</h1>
      <p><strong>Team ID:</strong> ${foundry.utils.escapeHTML(team.teamId)}</p>
      <p>Этот журнал создан модулем <strong>Чемпионат — Ядро</strong>. Данные команды хранятся во flags.championshipCore и доступны будущим модулям.</p>
      <ul>
        <li><strong>Статус хода:</strong> ${STATUS_LABELS[team.currentTurnStatus] ?? team.currentTurnStatus}</li>
        <li><strong>Текущий баланс:</strong> ${team.currentBalance}</li>
        <li><strong>Очки инвестиций:</strong> ${team.availableInvestmentPoints} / ${team.totalInvestmentPoints}</li>
      </ul>
    `;
  }

  async function clearLinkedDocumentFlags(team) {
    for (const uuid of team.enterpriseJournalUuids ?? []) {
      const doc = await fromUuidSafe(uuid);
      if (doc?.unsetFlag) await doc.unsetFlag(FLAG_SCOPE, "teamId");
    }
    for (const uuid of team.ownedPlotJournalUuids ?? []) {
      const doc = await fromUuidSafe(uuid);
      if (doc?.unsetFlag) await doc.unsetFlag(FLAG_SCOPE, "ownerTeamId");
    }
  }

  const api = {
    MODULE_ID,
    FLAG_SCOPE,
    TURN_STATUSES,
    STATUS_LABELS,

    getCurrentTurn() { return Number(game.settings.get(MODULE_ID, "currentTurn") ?? 1); },

    async setCurrentTurn(value) {
      if (!requireGM("изменять текущий ход")) return null;
      const max = this.getMaxTurns();
      const turn = Math.min(max, Math.max(1, Number(value) || 1));
      await game.settings.set(MODULE_ID, "currentTurn", turn);
      return turn;
    },

    getMaxTurns() { return Number(game.settings.get(MODULE_ID, "maxTurns") ?? 10); },

    async setMaxTurns(value) {
      if (!requireGM("изменять максимальное количество ходов")) return null;
      const turns = Math.max(1, Number(value) || 10);
      await game.settings.set(MODULE_ID, "maxTurns", turns);
      if (this.getCurrentTurn() > turns) await game.settings.set(MODULE_ID, "currentTurn", turns);
      return turns;
    },

    isTurnOpen() { return Boolean(game.settings.get(MODULE_ID, "isTurnOpen")); },

    async setTurnOpen(isOpen) {
      if (!requireGM("открывать или закрывать ход")) return null;
      await game.settings.set(MODULE_ID, "isTurnOpen", Boolean(isOpen));
      await game.settings.set(MODULE_ID, "turnStatus", Boolean(isOpen) ? "open" : "closed");
      return Boolean(isOpen);
    },

    getTurnStatus() { return String(game.settings.get(MODULE_ID, "turnStatus") ?? "closed"); },
    getTeams() { return getTeamsIndex().map(normalizeTeamRecord); },
    getTeam(teamId) { const team = getTeamsIndex().find(t => t.teamId === teamId); return team ? normalizeTeamRecord(team) : null; },

    async createTeam(data = {}) {
      if (!requireGM("создавать команды")) return null;
      const team = normalizeTeamRecord({
        teamId: data.teamId || randomId(),
        teamName: data.teamName || "Новая команда",
        userIds: data.userIds || [],
        currentBalance: data.currentBalance ?? 400000,
        availableInvestmentPoints: data.availableInvestmentPoints ?? 0,
        totalInvestmentPoints: data.totalInvestmentPoints ?? 0
      });
      const pageFormat = CONST.JOURNAL_ENTRY_PAGE_FORMATS?.HTML ?? 1;
      const journal = await JournalEntry.create({
        name: `Компания — ${team.teamName}`,
        ownership: getJournalOwnershipForUsers(team.userIds),
        flags: { [FLAG_SCOPE]: { type: "company", ...team, companyJournalUuid: undefined } },
        pages: [{ name: "Основная информация", type: "text", text: { format: pageFormat, content: makeCompanyPageContent(team) } }]
      });
      team.companyJournalUuid = journal.uuid;
      await upsertTeam(team);
      await syncCompanyFlags(team);
      return team;
    },

    async updateTeam(teamId, data = {}) {
      if (!requireGM("изменять команды")) return null;
      const current = this.getTeam(teamId);
      if (!current) {
        ui.notifications?.warn("Команда не найдена.");
        return null;
      }
      const team = normalizeTeamRecord({
        ...current,
        teamName: data.teamName ?? current.teamName,
        userIds: Array.isArray(data.userIds) ? data.userIds : current.userIds,
        currentTurnStatus: data.currentTurnStatus ?? current.currentTurnStatus,
        currentBalance: data.currentBalance ?? current.currentBalance,
        availableInvestmentPoints: data.availableInvestmentPoints ?? current.availableInvestmentPoints,
        totalInvestmentPoints: data.totalInvestmentPoints ?? current.totalInvestmentPoints,
        enterpriseJournalUuids: data.enterpriseJournalUuids ?? current.enterpriseJournalUuids,
        ownedPlotJournalUuids: data.ownedPlotJournalUuids ?? current.ownedPlotJournalUuids
      });
      await upsertTeam(team);
      await syncCompanyFlags(team);
      return team;
    },

    async deleteTeam(teamId, options = {}) {
      if (!requireGM("удалять команды")) return null;
      const team = this.getTeam(teamId);
      if (!team) return null;
      const journal = await fromUuidSafe(team.companyJournalUuid);
      await clearLinkedDocumentFlags(team);
      if (options.deleteCompanyJournal && journal?.delete) await journal.delete();
      else if (journal?.update) {
        await journal.update({
          ownership: { default: getOwnershipLevel("NONE", 0) },
          [`flags.${FLAG_SCOPE}`]: null
        });
      }
      await removeTeamFromIndex(teamId);
      return team;
    },

    async refreshTeamsFromJournals() {
      if (!requireGM("обновлять список команд")) return null;
      const owner = getOwnershipLevel("OWNER", 3);
      const teams = [];
      for (const journal of game.journal ?? []) {
        if (journal.getFlag(FLAG_SCOPE, "type") !== "company") continue;
        teams.push(normalizeTeamRecord({
          teamId: journal.getFlag(FLAG_SCOPE, "teamId"),
          teamName: journal.getFlag(FLAG_SCOPE, "teamName") || journal.name?.replace(/^Компания — /, ""),
          companyJournalUuid: journal.uuid,
          userIds: Object.entries(journal.ownership ?? {}).filter(([id, level]) => id !== "default" && Number(level) >= owner).map(([id]) => id),
          currentTurnStatus: journal.getFlag(FLAG_SCOPE, "currentTurnStatus"),
          currentBalance: journal.getFlag(FLAG_SCOPE, "currentBalance"),
          totalInvestmentPoints: journal.getFlag(FLAG_SCOPE, "totalInvestmentPoints"),
          availableInvestmentPoints: journal.getFlag(FLAG_SCOPE, "availableInvestmentPoints"),
          enterpriseJournalUuids: journal.getFlag(FLAG_SCOPE, "enterpriseJournalUuids") ?? [],
          ownedPlotJournalUuids: journal.getFlag(FLAG_SCOPE, "ownedPlotJournalUuids") ?? []
        }));
      }
      await setTeamsIndex(teams);
      return teams;
    },

    async getCompanyJournal(teamId) { const team = this.getTeam(teamId); return team ? fromUuidSafe(team.companyJournalUuid) : null; },

    async linkEnterpriseToCompany(companyUuid, enterpriseUuid, data = {}) {
      if (!requireGM("связывать предприятие с компанией")) return null;
      const company = await fromUuidSafe(companyUuid);
      const enterprise = await fromUuidSafe(enterpriseUuid);
      if (!company || !enterprise) return null;
      const teamId = company.getFlag(FLAG_SCOPE, "teamId");
      const team = this.getTeam(teamId);
      if (!team) return null;
      team.enterpriseJournalUuids = normalizeUuidList([...team.enterpriseJournalUuids, enterpriseUuid]);
      await upsertTeam(team);
      await syncCompanyFlags(team);
      await enterprise.update({
        [`flags.${FLAG_SCOPE}.type`]: "enterprise",
        [`flags.${FLAG_SCOPE}.teamId`]: team.teamId,
        [`flags.${FLAG_SCOPE}.companyJournalUuid`]: companyUuid,
        [`flags.${FLAG_SCOPE}.enterpriseCode`]: data.enterpriseCode ?? enterprise.getFlag(FLAG_SCOPE, "enterpriseCode") ?? "",
        [`flags.${FLAG_SCOPE}.enterpriseName`]: data.enterpriseName ?? enterprise.getFlag(FLAG_SCOPE, "enterpriseName") ?? enterprise.name
      });
      return team;
    },

    async linkPlotToCompany(companyUuid, plotUuid, data = {}) {
      if (!requireGM("связывать участок с компанией")) return null;
      const company = await fromUuidSafe(companyUuid);
      const plot = await fromUuidSafe(plotUuid);
      if (!company || !plot) return null;
      const teamId = company.getFlag(FLAG_SCOPE, "teamId");
      const team = this.getTeam(teamId);
      if (!team) return null;
      team.ownedPlotJournalUuids = normalizeUuidList([...team.ownedPlotJournalUuids, plotUuid]);
      await upsertTeam(team);
      await syncCompanyFlags(team);
      await plot.update({
        [`flags.${FLAG_SCOPE}.type`]: "plot",
        [`flags.${FLAG_SCOPE}.ownerTeamId`]: team.teamId,
        [`flags.${FLAG_SCOPE}.plotCode`]: data.plotCode ?? plot.getFlag(FLAG_SCOPE, "plotCode") ?? "",
        [`flags.${FLAG_SCOPE}.plotType`]: data.plotType ?? plot.getFlag(FLAG_SCOPE, "plotType") ?? ""
      });
      return team;
    },

    async setTeamTurnStatus(teamId, status) {
      if (!requireGM("изменять статус хода команды")) return null;
      if (!Object.values(TURN_STATUSES).includes(status)) {
        ui.notifications?.warn(`Неизвестный статус хода: ${status}`);
        return null;
      }
      return this.updateTeam(teamId, { currentTurnStatus: status });
    },

    async submitTeamTurn(teamId) {
      if (!this.isTurnOpen()) { ui.notifications?.warn("Сейчас ход закрыт. Отправка невозможна."); return null; }
      if (!canUserEditTeam(game.user.id, teamId)) { ui.notifications?.warn("У вас нет прав на отправку хода этой команды."); return null; }
      const team = this.getTeam(teamId);
      if (!team) return null;
      team.currentTurnStatus = TURN_STATUSES.SUBMITTED;
      await upsertTeam(team);
      await syncCompanyFlags(team);
      return team;
    },

    async setTeamBalance(teamId, value) { return this.updateTeam(teamId, { currentBalance: Number(value) }); },
    async setTeamInvestmentPoints(teamId, available, total) { return this.updateTeam(teamId, { availableInvestmentPoints: Number(available), totalInvestmentPoints: Number(total) }); },

    canUserEditTeam,
    normalizeTeamRecord,
    fromUuidSafe
  };

  Hooks.once("init", () => {
    game.championshipCore = game.championshipCore ?? {};
    game.championshipCore.api = api;
  });

  Hooks.once("ready", () => {
    const module = game.modules.get(MODULE_ID);
    if (module) module.api = api;
  });
})();
