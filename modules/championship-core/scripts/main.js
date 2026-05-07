/* championship-core / main.js */

Hooks.once('init', async () => {
  const MODULE_ID = 'championship-core';

  game.settings.register(MODULE_ID, 'currentTurn', {
    name: 'Текущий ход',
    scope: 'world',
    config: false,
    type: Number,
    default: 1
  });

  game.settings.register(MODULE_ID, 'maxTurns', {
    name: 'Максимум ходов',
    scope: 'world',
    config: false,
    type: Number,
    default: 10
  });

  game.settings.register(MODULE_ID, 'isTurnOpen', {
    name: 'Ход открыт',
    scope: 'world',
    config: false,
    type: Boolean,
    default: false
  });

  game.settings.register(MODULE_ID, 'turnStatus', {
    name: 'Статус хода',
    scope: 'world',
    config: false,
    type: String,
    default: 'closed'
  });

  game.settings.register(MODULE_ID, 'teamsIndex', {
    name: 'Индекс команд',
    scope: 'world',
    config: false,
    type: Array,
    default: []
  });

  game.settings.register(MODULE_ID, 'adminPanelPosition', {
    name: 'Позиция окна администратора',
    scope: 'client',
    config: false,
    type: Object,
    default: {}
  });

  Handlebars.registerHelper('eq', (a, b) => a === b);
  Handlebars.registerHelper('includes', (array, value) => Array.isArray(array) && array.includes(value));

  console.log('championship-core | init completed');
});
