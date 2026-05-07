const { AudioManager } = require("./AudioManager");
const audioManager = new AudioManager();

const {
    GameController,
    QuestSource,
    GameMode
} = require("./dist/_Core/GameController");

const { QuestRepository } = require("./QuestRepository");
const { AliveText } = require("./AliveText");
const { Localization } = require("./Localization");

const questRepository = new QuestRepository(audioManager);
const gameController = new GameController();

gameController.setQuestLoader((questShort, source) =>
    questRepository.loadQuest(questShort, source)
);

gameController.setLocalQuestListLoader(() =>
    questRepository.findLocalQuests()
);

gameController.setLocalResourceResolver((folderName, resourceName, extensions) =>
    questRepository.resolveLocalResourceUrl(
        gameController.getSelectedQuest(),
        folderName,
        resourceName,
        extensions
    )
);

let keyboardIndex = 0;
let currentKeyboardButtons = [];
let isFrontImageActive = false;
let currentImageUrl = null;

const titleEl = document.getElementById("title");
const textEl = document.getElementById("mainText");
const choicesEl = document.getElementById("choices");
const paramsEl = document.getElementById("params");
const pictureEl = document.getElementById("mainPicture");
const imageBackEl = document.getElementById("imageBack");
const imageFrontEl = document.getElementById("imageFront");

const blockerEl = document.getElementById("startQuestBlocker");
const cancelStartQuestButton = document.getElementById("cancelStartQuestButton");

const aliveText = new AliveText(textEl);
const localization = new Localization(() => gameController.getSelectedQuestInfo());

if (cancelStartQuestButton) {
    cancelStartQuestButton.onclick = () => {
        audioManager.playClick();
        gameController.cancelStartQuest();
        hideStartQuestBlocker();
    };
}

async function initGamePanel() {
    setMenuLayout();

    await gameController.checkServerAvailability();
    await showCurrentSourceQuestList(false);
}

function setMenuLayout() {
    document.body.classList.add("menu-mode");
    document.body.classList.remove("play-mode");
}

function setPlayLayout() {
    document.body.classList.remove("menu-mode");
    document.body.classList.add("play-mode");
}

function showStartQuestBlocker() {
    blockerEl.classList.remove("hidden");
}

function hideStartQuestBlocker() {
    blockerEl.classList.add("hidden");
}

async function showCurrentSourceQuestList(keepKeyboardIndex = false) {
    try {
        const quests = await loadCurrentSourceQuestList();
        renderQuestList(quests, keepKeyboardIndex);

        if (quests.length > 0) {
            const safeIndex = keepKeyboardIndex ? keyboardIndex : 0;
            keyboardIndex = clampQuestIndex(safeIndex, quests.length);
            await selectQuest(quests[keyboardIndex], true);
            return;
        }

        renderNoQuestsState();
    }
    catch (error) {
        console.warn("Error loading quest list:", error);
        renderQuestListError();
    }
}

async function loadCurrentSourceQuestList() {
    if (gameController.getSource() === QuestSource.Remote) {
        return await gameController.refreshRemoteQuests();
    }

    return gameController.refreshLocalQuests();
}

function renderQuestList(quests, keepKeyboardIndex = false) {
    choicesEl.innerHTML = "";

    if (quests.length === 0) {
        const info = document.createElement("div");
        info.className = "param";
        info.textContent = getNoQuestsMessage();
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

function getNoQuestsMessage() {
    return gameController.getSource() === QuestSource.Remote
        ? localization.t("noRemoteQuests")
        : localization.t("noLocalQuestsWithPath");
}

async function selectQuest(questShort, keepKeyboardIndex = false) {
    if (!questShort) {
        return;
    }

    try {
        await gameController.selectQuestForMenu(questShort);

        aliveText.setText(buildQuestDescriptionHtml(questShort));

        await renderQuestImage(questShort.startImage);
        renderMenuButtons();

        if (keepKeyboardIndex) {
            updateKeyboardSelection();
        }
    }
    catch (error) {
        console.warn("Error selecting quest:", error);
        renderQuestSelectionError();
    }
}

function buildQuestDescriptionHtml(questShort) {
    const title = questShort.displayName || questShort.questName;
    const description = questShort.description || localization.t("noDescription");

    return `<b>${title}</b><br><br>${description.replaceAll("\n", "<br>")}`;
}

async function startQuest() {
    if (gameController.isInputBlocked()) {
        return;
    }

    const shouldShowBlocker = gameController.willStartRemoteQuest();

    if (shouldShowBlocker) {
        showStartQuestBlocker();
    }

    try {
        const state = await gameController.startSelectedQuest();

        if (!state) {
            return;
        }

        setPlayLayout();
        await renderState(state);
    }
    catch (error) {
        console.warn("Error starting quest:", error);
        setMenuLayout();
        renderMenuButtons();
    }
    finally {
        hideStartQuestBlocker();
    }
}

async function choosePassage(passageId) {
    const state = gameController.choosePassage(passageId);

    await renderState(state);
}

async function renderState(state) {
    if (titleEl) {
        titleEl.textContent = state.title;
    }

    aliveText.setText(state.mainText);

    await renderQuestImage(state.imageName);
    renderParams(state.params);
    renderChoices(state);
    await renderQuestAudio(state);
}

async function renderQuestAudio(state) {
    const musicUrl = await gameController.getCurrentMusicUrl(state.musicName);

    if (state.musicName) {
        if (musicUrl) {
            audioManager.playMusicUrl(musicUrl, state.musicName, true);
        }
        else {
            console.warn("Music not found:", state.musicName);
            audioManager.stopMusic();
        }
    }

    if (state.soundName) {
        const soundUrl = await gameController.getCurrentSoundUrl(state.soundName);

        if (soundUrl) {
            audioManager.playSfxUrl(soundUrl, state.soundName);
        }
        else {
            console.warn("SFX not found:", state.soundName);
        }
    }
}

async function renderQuestImage(imageName) {
    if (!pictureEl || !imageBackEl || !imageFrontEl) {
        return;
    }

    const nextImageUrl = await gameController.getCurrentImageUrl(imageName);

    if (!nextImageUrl) {
        clearQuestImage();
        return;
    }

    if (nextImageUrl === currentImageUrl) {
        return;
    }

    showQuestImageUrl(nextImageUrl);
}

function showQuestImageUrl(nextImageUrl) {
    const nextImageEl = isFrontImageActive ? imageBackEl : imageFrontEl;
    const previousImageEl = isFrontImageActive ? imageFrontEl : imageBackEl;

    nextImageEl.onerror = () => {
        clearQuestImage();
    };

    nextImageEl.src = nextImageUrl;

    requestAnimationFrame(() => {
        nextImageEl.classList.add("visible");
        previousImageEl.classList.remove("visible");
    });

    currentImageUrl = nextImageUrl;
    isFrontImageActive = !isFrontImageActive;
}

function clearQuestImage() {
    imageBackEl.classList.remove("visible");
    imageFrontEl.classList.remove("visible");
    imageBackEl.removeAttribute("src");
    imageFrontEl.removeAttribute("src");
    currentImageUrl = null;
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
        addSystemButton(localization.t("win"), returnToMenu);
        resetKeyboardSelection();
        return;
    }

    if (state.result === "fail") {
        addSystemButton(localization.t("lose"), returnToMenu);
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

    if (caption === "Next") {
        caption = localization.t("next");
    }

    AliveText.setButtonText(button, caption);
    button.disabled = choice.interactable === false;

    button.onmouseenter = () => {
        audioManager.playHover();

        if (button.disabled) {
            return;
        }

        document.body.classList.remove("keyboard-mode");

        const buttons = Array.from(
            choicesEl.querySelectorAll("button:not(:disabled)")
        );

        keyboardIndex = buttons.indexOf(button);
        updateKeyboardSelection();
    };

    button.onclick = async () => {
        if (gameController.isInputBlocked() || choice.interactable === false) {
            return;
        }

        audioManager.playClick();
        await choosePassage(choice.id);
    };

    choicesEl.appendChild(button);
}

function addSystemButton(text, action) {
    const button = document.createElement("button");

    button.textContent = text;

    button.onmouseenter = () => {
        audioManager.playHover();
    };

    button.onclick = async () => {
        if (gameController.isInputBlocked()) {
            return;
        }

        audioManager.playClick();
        await action();
    };

    choicesEl.appendChild(button);
}

function addQuestButton(questShort, index) {
    const button = document.createElement("button");

    const langTag = localization.getLangTag(questShort.lang);
    const authorText = questShort.author ? `by ${questShort.author}` : "";

    button.innerHTML = `
    <span class="quest-name">${questShort.displayName}</span>
    <span class="quest-author">${authorText}</span>
    <span class="quest-lang">${langTag}</span>
    `;

    if (gameController.getSelectedQuest() === questShort) {
        button.classList.add("selected");
    }

    button.onclick = async () => {
        if (gameController.isInputBlocked()) {
            return;
        }

        audioManager.playClick();

        keyboardIndex = index;
        await selectQuest(questShort, true);
    };

    choicesEl.appendChild(button);
}

function renderMenuButtons() {
    paramsEl.innerHTML = "";

    const sourceRow = document.createElement("div");
    sourceRow.className = "source-row";

    const sourceTitle = document.createElement("span");
    sourceTitle.textContent = localization.t("source");

    const localButton = document.createElement("button");
    localButton.textContent = localization.t("local");
    localButton.disabled = gameController.getSource() === QuestSource.Local;

    if (gameController.getSource() === QuestSource.Local) {
        localButton.classList.add("selected-source");
    }

    localButton.onclick = async () => {
        if (gameController.isInputBlocked()) {
            return;
        }

        audioManager.playClick();
        await selectLocal();
    };

    const remoteButton = document.createElement("button");
    remoteButton.textContent = gameController.isServerAvailable()
        ? localization.t("remote")
        : localization.t("remoteUnavailable");
    remoteButton.disabled =
        !gameController.isServerAvailable() ||
        gameController.getSource() === QuestSource.Remote;

    if (gameController.getSource() === QuestSource.Remote) {
        remoteButton.classList.add("selected-source");
    }

    remoteButton.onclick = async () => {
        if (gameController.isInputBlocked()) {
            return;
        }

        audioManager.playClick();
        await selectRemote();
    };

    sourceRow.appendChild(sourceTitle);
    sourceRow.appendChild(localButton);
    sourceRow.appendChild(remoteButton);

    const startButton = document.createElement("button");

    startButton.textContent = localization.t("startQuest");
    startButton.className = "start-button";
    startButton.disabled = !gameController.hasSelectedQuest();

    startButton.onclick = async () => {
        if (gameController.isInputBlocked()) {
            return;
        }

        audioManager.playClick();
        await startQuest();
    };

    paramsEl.appendChild(sourceRow);
    paramsEl.appendChild(startButton);
}

async function returnToMenu() {
    gameController.returnToMenu();

    setMenuLayout();

    audioManager.stopMusic();

    if (titleEl) {
        titleEl.textContent = localization.t("questReaderTitle");
    }

    paramsEl.innerHTML = "";
    choicesEl.innerHTML = "";

    await showCurrentSourceQuestList(false);
}

function renderNoQuestsState() {
    gameController.selectQuest(null);
    aliveText.setText(
        gameController.getSource() === QuestSource.Remote
            ? localization.t("noRemoteQuests")
            : localization.t("noLocalQuests"),
        true
    );
    clearQuestImage();
    renderMenuButtons();
    resetKeyboardSelection();
}

function renderQuestSelectionError() {
    gameController.selectQuest(null);
    aliveText.setText(localization.t("errorLoadingQuest"), true);
    clearQuestImage();
    renderMenuButtons();
}

function renderQuestListError() {
    choicesEl.innerHTML = "";

    const info = document.createElement("div");
    info.className = "param";
    info.textContent = gameController.getSource() === QuestSource.Remote
        ? localization.t("errorLoadingRemoteQuests")
        : localization.t("errorLoadingQuest");

    choicesEl.appendChild(info);

    gameController.selectQuest(null);
    aliveText.setText(localization.t("errorLoadingQuest"), true);
    renderMenuButtons();
    resetKeyboardSelection();
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
        button.classList.remove("selected");
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

    selectedButton.classList.add("selected");

    selectedButton.scrollIntoView({
        block: "nearest"
    });
}

async function moveKeyboardSelection(direction) {
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

    if (gameController.getMode() === GameMode.Menu) {
        const quests = gameController.getCurrentQuestList();
        const questShort = quests[keyboardIndex];

        if (questShort) {
            audioManager.playClick();
            await selectQuest(questShort, true);
        }

        return;
    }

    audioManager.playClick();
    updateKeyboardSelection();
}

async function submitKeyboardSelection() {
    if (gameController.getMode() === GameMode.Menu && gameController.hasSelectedQuest()) {
        await startQuest();
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

async function leaveQuest() {
    await returnToMenu();
}

async function selectLocal() {
    if (gameController.getSource() === QuestSource.Local) {
        return;
    }

    gameController.switchToLocal();
    audioManager.stopMusic();

    await showCurrentSourceQuestList(false);
}

async function selectRemote() {
    if (gameController.getSource() === QuestSource.Remote) {
        return;
    }

    if (!gameController.isServerAvailable()) {
        console.warn("Remote server is not available.");
        return;
    }

    gameController.switchToRemote();
    audioManager.stopMusic();

    await showCurrentSourceQuestList(false);
}

function clampQuestIndex(index, length) {
    if (length <= 0) {
        return 0;
    }

    if (index < 0 || index >= length) {
        return 0;
    }

    return index;
}

document.addEventListener("keydown", async (event) => {
    if (gameController.isInputBlocked()) {
        event.preventDefault();
        return;
    }

    if (event.key === "ArrowLeft" && gameController.getMode() === GameMode.Menu) {
        audioManager.playClick();
        event.preventDefault();
        await selectLocal();
        return;
    }

    if (event.key === "ArrowRight" && gameController.getMode() === GameMode.Menu) {
        audioManager.playClick();
        event.preventDefault();
        await selectRemote();
        return;
    }

    if (event.key === "ArrowUp") {
        event.preventDefault();
        await moveKeyboardSelection(-1);
        return;
    }

    if (event.key === "ArrowDown") {
        event.preventDefault();
        await moveKeyboardSelection(1);
        return;
    }

    if (event.key === "Enter") {
        event.preventDefault();
        audioManager.playClick();
        await submitKeyboardSelection();
        return;
    }

    if (event.key === "Escape") {
        event.preventDefault();
        audioManager.playClick();
        await leaveQuest();
        return;
    }
});

initGamePanel();
