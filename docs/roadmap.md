# Roadmap разработки

## Этап 1 — championship-core

Статус: в разработке.

Цель: стабильное ядро для всех остальных модулей.

Готово:

- базовый `module.json`;
- регистрация settings;
- публичный API `game.championshipCore.api`;
- хранение команд через `teamsIndex`;
- хранение связей через `flags.championshipCore`;
- создание, обновление и удаление команд на уровне API;
- связь предприятия с компанией;
- связь участка с компанией;
- базовая GM-панель.

Нужно усилить:

- полноценный UI создания команды;
- полноценный UI редактирования команды;
- полноценный UI удаления команды;
- сохранение позиции GM-кнопки/панели;
- события ядра через Foundry Hooks;
- миграции данных между версиями;
- проверка прав перед изменением Journal.

## Этап 2 — championship-enterprise-sheet

Можно начинать после стабилизации API ядра.

Минимальная зависимость от ядра:

- `game.championshipCore.api.getTeams()`;
- `game.championshipCore.api.getTeam(teamId)`;
- `game.championshipCore.api.getCompanyJournal(teamId)`;
- `game.championshipCore.api.linkEnterpriseToCompany(companyUuid, enterpriseUuid)`;
- `game.championshipCore.api.canUserEditTeam(userId, teamId)`.

Цель модуля:

- отдельный Journal Sheet для предприятия;
- flags предприятия;
- связь с компанией;
- мощность предприятия;
- расходы;
- потребление;
- производство;
- НДПИ;
- вывод итогов для листа компании.

## Этап 3 — championship-company-sheet

Цель:

- полноценный лист компании;
- сводка предприятий;
- участки;
- строительство;
- улучшения;
- кредиты;
- инвестиционные очки;
- отправка хода на проверку.

## Этап 4 — остальные модули

- market;
- construction;
- storage;
- logistics;
- contracts;
- taxes;
- loans;
- national-projects;
- admin-panel.
