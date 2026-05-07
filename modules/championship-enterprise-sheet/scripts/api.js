/* championship-enterprise-sheet API */

(() => {
  const MODULE_ID = 'championship-enterprise-sheet';
  const FLAG_SCOPE = 'championshipEnterprise';

  const api = {
    MODULE_ID,
    FLAG_SCOPE,

    getEnterpriseData(journal) {
      return journal.getFlag(FLAG_SCOPE, 'data') ?? {};
    },

    async setEnterpriseData(journal, data) {
      return journal.setFlag(FLAG_SCOPE, 'data', data);
    },

    calculateProduction(data = {}) {
      const power = Number(data.power ?? 0);
      const efficiency = Number(data.efficiency ?? 1);
      return Math.round(power * efficiency);
    },

    calculateExpenses(data = {}) {
      const salary = Number(data.salaryExpenses ?? 0);
      const logistics = Number(data.logisticsExpenses ?? 0);
      const maintenance = Number(data.maintenanceExpenses ?? 0);
      return salary + logistics + maintenance;
    }
  };

  Hooks.once('ready', () => {
    game.championshipEnterprise = api;
  });
})();
