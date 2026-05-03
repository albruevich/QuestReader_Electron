const { GameController } = require("./dist/_Core/GameController");

const fs = require("fs");
const path = require("path");

let quest = null;
let gameController = null;

const titleEl = document.getElementById("title");
const textEl = document.getElementById("mainText");
const choicesEl = document.getElementById("choices");
const paramsEl = document.getElementById("params");

function loadQuest() {
    const questPath = path.join(__dirname, "_Quests", "quest.json");
    const json = fs.readFileSync(questPath, "utf8");

    quest = JSON.parse(json);
}

function startQuest() {
    gameController = new GameController();
    const state = gameController.startQuest(quest);

    renderState(state);
}

function choosePassage(passageId) {
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
    button.onclick = () => choosePassage(choice.id);

    choicesEl.appendChild(button);
}

function addSystemButton(text, action) {
    const button = document.createElement("button");
    button.textContent = text;
    button.onclick = action;

    choicesEl.appendChild(button);
}

function returnToMenu() {
    quest = null;
    gameController = null;

    titleEl.textContent = "Quest Reader";
    textEl.innerHTML = "First Electron App";
    paramsEl.innerHTML = "";
    choicesEl.innerHTML = "";

    const button = document.createElement("button");
    button.id = "startBtn";
    button.textContent = "Start Quest";
    button.onclick = () => {
        loadQuest();
        startQuest();
    };

    choicesEl.appendChild(button);
}

document.getElementById("startBtn").addEventListener("click", () => {
    loadQuest();
    startQuest();
});