const { AudioManager } = require("./AudioManager");
const audioManager = new AudioManager();

const { GameController } = require("./dist/_Core/GameController");

const fs = require("fs");
const path = require("path");
const { pathToFileURL } = require("url");

let selectedQuestInfo = null;
let quest = null;
let gameController = null;

let keyboardIndex = 0;
let currentKeyboardButtons = [];

const titleEl = document.getElementById("title");
const textEl = document.getElementById("mainText");
const choicesEl = document.getElementById("choices");
const paramsEl = document.getElementById("params");
const pictureEl = document.getElementById("mainPicture");
const imageBackEl = document.getElementById("imageBack");
const imageFrontEl = document.getElementById("imageFront");

let isFrontImageActive = false;
let currentImageUrl = null;

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
        let startImage = "";
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

            startImage = questJson.startImage || "";
            order = Number(questJson.order || 0);
        }
        catch (error) {
            console.warn("Invalid quest.json:", questJsonPath, error);
        }

        result.push({
            folderName: entry.name,
            displayName,
            description,
            startImage,
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

    audioManager.setQuestFolder(questInfo.folderPath);
}

function selectQuest(questInfo, keepKeyboardIndex = false) {
    loadQuest(questInfo);

    textEl.innerHTML = buildQuestDescriptionHtml(questInfo);

    renderQuestImage(questInfo.startImage);
    renderMenuButtons();
    renderQuestList(keepKeyboardIndex);
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
    document.body.classList.add("play-mode");

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

    renderQuestImage(state.imageName);
    renderParams(state.params);
    renderChoices(state);
    renderQuestAudio(state);
}

function renderQuestAudio(state) {
    if (state.musicName) {
        audioManager.playMusic(state.musicName, true);
    }

    if (state.soundName) {
        audioManager.playSfx(state.soundName);
    }
}

function renderQuestImage(imageName) {
    if (!pictureEl || !imageBackEl || !imageFrontEl) {
        return;
    }

    const imagePath = findImagePath(imageName);

    if (!imagePath) {
        imageBackEl.classList.remove("visible");
        imageFrontEl.classList.remove("visible");
        imageBackEl.removeAttribute("src");
        imageFrontEl.removeAttribute("src");
        currentImageUrl = null;
        return;
    }

    const nextImageUrl = pathToFileURL(imagePath).href;

    if (nextImageUrl === currentImageUrl) {
        return;
    }

    const nextImageEl = isFrontImageActive ? imageBackEl : imageFrontEl;
    const previousImageEl = isFrontImageActive ? imageFrontEl : imageBackEl;

    nextImageEl.src = nextImageUrl;

    requestAnimationFrame(() => {
        nextImageEl.classList.add("visible");
        previousImageEl.classList.remove("visible");
    });

    currentImageUrl = nextImageUrl;
    isFrontImageActive = !isFrontImageActive;
}

function findImagePath(imageName) {
    if (!selectedQuestInfo || !imageName) {
        return null;
    }

    const imagesFolder = path.join(selectedQuestInfo.folderPath, "Images");
    const cleanName = imageName.trim();

    if (!fs.existsSync(imagesFolder)) {
        return null;
    }

    const hasExtension = path.extname(cleanName) !== "";

    if (hasExtension) {
        const directPath = path.join(imagesFolder, cleanName);

        if (fs.existsSync(directPath)) {
            return directPath;
        }

        return null;
    }

    const extensions = [".png", ".jpg", ".jpeg", ".webp"];

    for (const extension of extensions) {
        const candidate = path.join(imagesFolder, cleanName + extension);

        if (fs.existsSync(candidate)) {
            return candidate;
        }
    }

    return null;
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
        resetKeyboardSelection();
        return;
    }

    if (state.result === "fail") {
        addSystemButton(t("lose"), returnToMenu);
        resetKeyboardSelection();
        return;
    }

    for (const choice of state.choices) {
        addChoiceButton(choice);
    }

    resetKeyboardSelection();
}

function addChoiceButton(choice) {
    const button = document.createElement("button");

    let caption = choice.question;

    if (caption === "__NEXT__") {
        caption = t("next");
    }

    button.textContent = caption;
    button.disabled = choice.interactable === false;

    button.onmouseenter = () => {
        audioManager.playHover();

        if (!gameController || button.disabled) {
            return;
        }

        document.body.classList.remove("keyboard-mode");

        const buttons = Array.from(
            choicesEl.querySelectorAll("button:not(:disabled)")
        );

        keyboardIndex = buttons.indexOf(button);
        updateKeyboardSelection();
    };

    button.onclick = () => {
        if (choice.interactable === false) {
            return;
        }

        audioManager.playClick();
        choosePassage(choice.id);
    };

    choicesEl.appendChild(button);
}

function addSystemButton(text, action) {
    const button = document.createElement("button");

    button.textContent = text;

    button.onmouseenter = () => {
        audioManager.playHover();
    };

    button.onclick = () => {
        audioManager.playClick();
        action();
    };

    choicesEl.appendChild(button);
}

function addQuestButton(questInfo, index) {
    const button = document.createElement("button");

    button.textContent = questInfo.displayName;
    button.dataset.questJsonPath = questInfo.questJsonPath;

    if (selectedQuestInfo && selectedQuestInfo.questJsonPath === questInfo.questJsonPath) {
        button.classList.add("selected");
    }

    button.onclick = () => {
        audioManager.playClick();

        keyboardIndex = index;
        selectQuest(questInfo, true);
    };

    choicesEl.appendChild(button);
}

function renderQuestList(keepKeyboardIndex = false) {
    choicesEl.innerHTML = "";

    const quests = findQuestFolders();

    if (quests.length === 0) {
        const info = document.createElement("div");

        info.className = "param";
        info.textContent =
            "No quests found. Expected structure: _Quests/QuestFolder/quest.json";

        choicesEl.appendChild(info);
        resetKeyboardSelection();
        return;
    }

    for (let i = 0; i < quests.length; i++) {
        addQuestButton(quests[i], i);
    }

    if (!keepKeyboardIndex) {
        keyboardIndex = 0;
    }

    updateKeyboardSelection();
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
    document.body.classList.remove("play-mode");

    audioManager.stopMusic();

    if (titleEl) {
        titleEl.textContent = "Quest Reader";
    }

    paramsEl.innerHTML = "";
    choicesEl.innerHTML = "";

    const quests = findQuestFolders();

    if (quests.length === 0) {
        selectedQuestInfo = null;
        textEl.innerHTML = "No quests found.";
        renderQuestImage(null);

        const info = document.createElement("div");
        info.className = "param";
        info.textContent =
            "Expected structure: _Quests/QuestFolder/quest.json";

        choicesEl.appendChild(info);
        renderMenuButtons();
        resetKeyboardSelection();
        return;
    }

    selectedQuestInfo = quests[0];
    loadQuest(selectedQuestInfo);

    textEl.innerHTML = buildQuestDescriptionHtml(selectedQuestInfo);

    renderQuestImage(selectedQuestInfo.startImage);
    renderQuestList();
    renderMenuButtons();
}

function resetKeyboardSelection() {
    keyboardIndex = 0;
    updateKeyboardSelection();
}

function updateKeyboardSelection() {
    currentKeyboardButtons = Array.from(
        choicesEl.querySelectorAll("button:not(:disabled)")
    );

    for (const button of choicesEl.querySelectorAll("button")) {
        if (gameController) {
            button.classList.remove("selected");
        }
    }

    if (currentKeyboardButtons.length === 0) {
        keyboardIndex = 0;
        return;
    }

    if (keyboardIndex < 0) {
        keyboardIndex = currentKeyboardButtons.length - 1;
    }

    if (keyboardIndex >= currentKeyboardButtons.length) {
        keyboardIndex = 0;
    }

    const selectedButton = currentKeyboardButtons[keyboardIndex];

    if (gameController) {
        selectedButton.classList.add("selected");
    }

    selectedButton.scrollIntoView({
        block: "nearest"
    });
}

function moveKeyboardSelection(direction) {
    document.body.classList.add("keyboard-mode");

    if (document.activeElement) {
        document.activeElement.blur();
    }

    currentKeyboardButtons = Array.from(
        choicesEl.querySelectorAll("button:not(:disabled)")
    );

    if (currentKeyboardButtons.length === 0) {
        return;
    }

    keyboardIndex += direction;

    if (keyboardIndex < 0) {
        keyboardIndex = currentKeyboardButtons.length - 1;
    }

    if (keyboardIndex >= currentKeyboardButtons.length) {
        keyboardIndex = 0;
    }

    if (!gameController) {
        const quests = findQuestFolders();
        const questInfo = quests[keyboardIndex];

        if (questInfo) {
            audioManager.playClick();
            selectQuest(questInfo, true);
        }

        return;
    }

    audioManager.playClick();
    updateKeyboardSelection();
}

function submitKeyboardSelection() {
    if (!gameController && selectedQuestInfo) {
        startQuest();
        return;
    }

    currentKeyboardButtons = Array.from(
        choicesEl.querySelectorAll("button:not(:disabled)")
    );

    if (currentKeyboardButtons.length === 0) {
        return;
    }

    if (keyboardIndex < 0 || keyboardIndex >= currentKeyboardButtons.length) {
        keyboardIndex = 0;
    }

    currentKeyboardButtons[keyboardIndex].click();
}

function leaveQuest() {
    if (gameController) {
        returnToMenu();
    }
}

document.addEventListener("keydown", (event) => {
    if (event.key === "ArrowUp") {
        event.preventDefault();
        moveKeyboardSelection(-1);
        return;
    }

    if (event.key === "ArrowDown") {
        event.preventDefault();
        moveKeyboardSelection(1);
        return;
    }

    if (event.key === "Enter") {
        event.preventDefault();
        audioManager.playClick();
        submitKeyboardSelection();
        return;
    }

    if (event.key === "Escape") {
        event.preventDefault();
        audioManager.playClick();
        leaveQuest();
        return;
    }
});

returnToMenu();