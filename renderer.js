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

        let displayName = entry.name;
        let order = 0;

        try {
            const json = fs.readFileSync(questJsonPath, "utf8");
            const questJson = JSON.parse(json);

            displayName =
                questJson.displayName ||
                questJson.questName ||
                entry.name;

            order = Number(questJson.order || 0);
        }
        catch (error) {
            console.warn("Invalid quest.json:", questJsonPath, error);
        }

        result.push({
            folderName: entry.name,
            displayName,
            order,
            folderPath: questFolderPath,
            questJsonPath
        });
    }

    result.sort((a, b) => {
        if (b.order !== a.order) {
            return b.order - a.order;
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

function startQuest() {
    if (!quest) {
        return;
    }

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
    titleEl.textContent = state.title;
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
        addSystemButton("You win", returnToMenu);
        return;
    }

    if (state.result === "fail") {
        addSystemButton("You lose", returnToMenu);
        return;
    }

    for (const choice of state.choices) {
        addChoiceButton(choice);
    }
}

function addChoiceButton(choice) {
    const button = document.createElement("button");

    button.textContent = choice.question;
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

    button.onclick = () => {
        loadQuest(questInfo);
        startQuest();
    };

    choicesEl.appendChild(button);
}

function returnToMenu() {
    quest = null;
    selectedQuestInfo = null;
    gameController = null;

    titleEl.textContent = "Quest Reader";
    textEl.innerHTML = "Select quest folder";
    paramsEl.innerHTML = "";
    choicesEl.innerHTML = "";

    const quests = findQuestFolders();

    if (quests.length === 0) {
        const info = document.createElement("div");

        info.className = "param";
        info.textContent =
            "No quests found. Expected structure: _Quests/QuestFolder/quest.json";

        paramsEl.appendChild(info);
        return;
    }

    for (const questInfo of quests) {
        addQuestButton(questInfo);
    }
}

returnToMenu();