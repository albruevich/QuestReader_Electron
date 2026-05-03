const { GameController } = require("./dist/_Core/GameController");

const fs = require("fs");
const path = require("path");

let selectedQuestInfo = null;
let quest = null;
let gameController = null;

const titleEl = document.getElementById("title");
const textEl = document.getElementById("mainText");
const choicesEl = document.getElementById("choices");
const paramsEl = document.getElementById("params");

const QUESTS_FOLDER = path.join(__dirname, "_Quests");

function getLang() {
    if (!quest || !quest.lang) {
        return "en";
    }

    return quest.lang.toLowerCase();
}

function t(key) {
    const lang = getLang();

    const dict = {
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
        }
    };

    return dict[key]?.[lang] || dict[key]?.en || key;
}

function ensureQuestsFolderExists() {
    if (!fs.existsSync(QUESTS_FOLDER)) {
        fs.mkdirSync(QUESTS_FOLDER, { recursive: true });
    }
}

function findQuestFolders() {
    ensureQuestsFolderExists();

    const result = [];
    const entries = fs.readdirSync(QUESTS_FOLDER, { withFileTypes: true });

    for (const entry of entries) {
        if (!entry.isDirectory()) {
            continue;
        }

        const questFolderPath = path.join(QUESTS_FOLDER, entry.name);
        const questJsonPath = path.join(questFolderPath, "quest.json");

        if (!fs.existsSync(questJsonPath)) {
            continue;
        }

        let questJson = null;
        let displayName = entry.name;
        let description = "";
        let order = 0;

        try {
            const json = fs.readFileSync(questJsonPath, "utf8");
            questJson = JSON.parse(json);

            displayName =
                questJson.displayName ||
                questJson.questName ||
                entry.name;

            description =
                questJson.description ||
                questJson.descrition ||
                "";

            order = Number(questJson.order || 0);
        }
        catch (error) {
            console.warn("Invalid quest.json:", questJsonPath, error);
        }

        result.push({
            folderName: entry.name,
            displayName,
            description,
            order,
            folderPath: questFolderPath,
            questJsonPath
        });
    }

    result.sort((a, b) => {
        if (a.order !== b.order) {
            return a.order - b.order;
        }

        return a.displayName.localeCompare(b.displayName);
    });

    return result;
}

function loadQuest(questInfo) {
    const json = fs.readFileSync(questInfo.questJsonPath, "utf8");

    quest = JSON.parse(json);
    selectedQuestInfo = questInfo;
}

function selectQuest(questInfo) {
    loadQuest(questInfo);

    textEl.innerHTML = buildQuestDescriptionHtml(questInfo);
    renderMenuButtons();
    renderQuestList();
}

function buildQuestDescriptionHtml(questInfo) {
    const title = questInfo.displayName || questInfo.folderName;
    const description = questInfo.description || "No description.";

    return `<b>${title}</b><br><br>${description.replaceAll("\n", "<br>")}`;
}

function startQuest() {
    if (!quest) {
        return;
    }

    document.body.classList.remove("menu-mode");

    gameController = new GameController();

    const state = gameController.startQuest(quest);

    renderState(state);
}

function choosePassage(passageId) {
    if (!gameController) {
        return;
    }

    const state = gameController.choosePassage(passageId);

    renderState(state);
}

function renderState(state) {
    if (titleEl) {
        titleEl.textContent = state.title;
    }

    textEl.innerHTML = state.mainText;

    renderParams(state.params);
    renderChoices(state);
}

function renderParams(params) {
    paramsEl.innerHTML = "";

    for (const text of params) {
        const div = document.createElement("div");

        div.className = "param";
        div.textContent = text;

        paramsEl.appendChild(div);
    }
}

function renderChoices(state) {
    choicesEl.innerHTML = "";

    if (state.result === "victory") {
        addSystemButton(t("win"), returnToMenu);
        return;
    }

    if (state.result === "fail") {
        addSystemButton(t("lose"), returnToMenu);
        return;
    }

    for (const choice of state.choices) {
        addChoiceButton(choice);
    }
}

function addChoiceButton(choice) {
    const button = document.createElement("button");

    let caption = choice.question;

    if (caption === "__NEXT__") {
        caption = t("next");
    }

    button.textContent = caption;
    button.disabled = choice.interactable === false;

    button.onclick = () => {
        if (choice.interactable === false) {
            return;
        }

        choosePassage(choice.id);
    };

    choicesEl.appendChild(button);
}

function addSystemButton(text, action) {
    const button = document.createElement("button");

    button.textContent = text;
    button.onclick = action;

    choicesEl.appendChild(button);
}

function addQuestButton(questInfo) {
    const button = document.createElement("button");

    button.textContent = questInfo.displayName;
    button.title = questInfo.folderPath;

    if (selectedQuestInfo && selectedQuestInfo.questJsonPath === questInfo.questJsonPath) {
        button.classList.add("selected");
    }

    button.onclick = () => {
        selectQuest(questInfo);
    };

    choicesEl.appendChild(button);
}

function renderQuestList() {
    choicesEl.innerHTML = "";

    const quests = findQuestFolders();

    if (quests.length === 0) {
        const info = document.createElement("div");

        info.className = "param";
        info.textContent =
            "No quests found. Expected structure: _Quests/QuestFolder/quest.json";

        choicesEl.appendChild(info);
        return;
    }

    for (const questInfo of quests) {
        addQuestButton(questInfo);
    }
}

function renderMenuButtons() {
    paramsEl.innerHTML = "";

    const startButton = document.createElement("button");

    startButton.textContent = t("startQuest");
    startButton.className = "start-button";
    startButton.disabled = !selectedQuestInfo;
    startButton.onclick = startQuest;

    paramsEl.appendChild(startButton);
}

function returnToMenu() {
    quest = null;
    gameController = null;

    document.body.classList.add("menu-mode");

    if (titleEl) {
        titleEl.textContent = "Quest Reader";
    }

    paramsEl.innerHTML = "";
    choicesEl.innerHTML = "";

    const quests = findQuestFolders();

    if (quests.length === 0) {
        selectedQuestInfo = null;
        textEl.innerHTML = "No quests found.";

        const info = document.createElement("div");
        info.className = "param";
        info.textContent =
            "Expected structure: _Quests/QuestFolder/quest.json";

        choicesEl.appendChild(info);
        renderMenuButtons();
        return;
    }

    // auto select first quest
    selectedQuestInfo = quests[0];
    loadQuest(selectedQuestInfo);

    textEl.innerHTML = buildQuestDescriptionHtml(selectedQuestInfo);

    renderQuestList();
    renderMenuButtons();
}

returnToMenu();