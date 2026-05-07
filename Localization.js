class Localization {
    constructor(questProvider = null) {
        this.questProvider = questProvider;
        this.defaultLang = "en";

        this.dict = {
            next: {
                ru: "Далее",
                uk: "Далі",
                en: "Next"
            },
            win: {
                ru: "Вы победили",
                uk: "Ви перемогли",
                en: "You win"
            },
            lose: {
                ru: "Вы проиграли",
                uk: "Ви програли",
                en: "You lose"
            },
            startQuest: {
                ru: "Начать выбранный квест",
                uk: "Почати вибраний квест",
                en: "Start Selected Quest"
            },
            noDescription: {
                ru: "Нет описания.",
                uk: "Немає опису.",
                en: "No description."
            },
            errorLoadingQuest: {
                ru: "Ошибка загрузки квеста.",
                uk: "Помилка завантаження квесту.",
                en: "Error loading quest."
            },
            noLocalQuests: {
                ru: "Локальные квесты не найдены.",
                uk: "Локальні квести не знайдені.",
                en: "No local quests found."
            },
            noLocalQuestsWithPath: {
                ru: "Локальные квесты не найдены. Ожидаемая структура: _Quests/QuestFolder/quest.json",
                uk: "Локальні квести не знайдені. Очікувана структура: _Quests/QuestFolder/quest.json",
                en: "No local quests found. Expected structure: _Quests/QuestFolder/quest.json"
            },
            noRemoteQuests: {
                ru: "Удалённые квесты не найдены.",
                uk: "Віддалені квести не знайдені.",
                en: "No remote quests found."
            },
            errorLoadingRemoteQuests: {
                ru: "Ошибка загрузки удалённых квестов.",
                uk: "Помилка завантаження віддалених квестів.",
                en: "Error loading remote quests."
            },
            source: {
                ru: "Источник:",
                uk: "Джерело:",
                en: "Source:"
            },
            local: {
                ru: "Локально",
                uk: "Локально",
                en: "Local"
            },
            remote: {
                ru: "Удалённо",
                uk: "Віддалено",
                en: "Remote"
            },
            remoteUnavailable: {
                ru: "Удалённый сервер недоступен",
                uk: "Віддалений сервер недоступний",
                en: "Remote unavailable"
            },
            questReaderTitle: {
                ru: "Quest Reader",
                uk: "Quest Reader",
                en: "Quest Reader"
            }
        };
    }

    getLang() {
        const quest = this.questProvider ? this.questProvider() : null;

        if (!quest || !quest.lang) {
            return this.defaultLang;
        }

        return String(quest.lang).toLowerCase();
    }

    t(key) {
        const lang = this.getLang();
        const entry = this.dict[key];

        if (!entry) {
            return key;
        }

        return entry[lang] || entry.en || key;
    }

    getLangTag(lang) {
        const normalized = String(lang || "en").toLowerCase();

        if (normalized === "ru") {
            return "[RU]";
        }

        if (normalized === "uk") {
            return "[UK]";
        }

        return "[EN]";
    }
}

module.exports = { Localization };
