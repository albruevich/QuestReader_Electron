const fs = require("fs");
const path = require("path");

let quest = null;
let currentLocation = null;
let singlePassage = null;

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

    initParameters();

    const startLocation = quest.locations.find(l => l.locationType === "Start");

    if (!startLocation) {
        throw new Error("Start location not found");
    }

    currentLocation = startLocation;
    currentLocation.visitCounter++;

    showCurrentLocation();
}

function initParameters() {
    for (const parameter of quest.parameters) {
        parameter.value = parameter.startValue;
    }
}

function showCurrentLocation() {
    clearChoices();

    titleEl.textContent = quest.displayName || quest.questName;

    applyInfluences(currentLocation);
    applyParamsActions(currentLocation);

    const description = getLocationDescription(currentLocation);
    textEl.innerHTML = cleanText(description);

    renderParams();

    textEl.innerHTML = cleanText(description);

    if (currentLocation.locationType === "Victory") {
        addSystemButton("You win", returnToMenu);
        return;
    }

    if (currentLocation.locationType === "Fail") {
        addSystemButton("You win", returnToMenu);
        return;
    }

    const passages = quest.passages
        .filter(p => p.from === currentLocation.id)
        .filter(p => isPassageAvailable(p))
        .sort((a, b) => a.displayOrder - b.displayOrder);

    for (const passage of passages) {
        addPassageButton(passage);
    }
}

function showPassage(passage) {

    applyInfluences(passage);
    applyParamsActions(passage);
    renderParams();

    passage.visitCounter++;

    const nextLocation = quest.locations.find(l => l.id === passage.to);

    if (!nextLocation) {
        console.warn("Next location not found:", passage.to);
        return;
    }

    currentLocation = nextLocation;

    if (!passage.description || currentLocation.locationType === "Empty") {
        if (currentLocation.locationType === "Empty" && passage.description) {
            currentLocation.descriptions[0] = passage.description;
        }

        currentLocation.visitCounter++;
        showCurrentLocation();
        return;
    }

    clearChoices();

    textEl.innerHTML = cleanText(passage.description);

    singlePassage = passage;

    addSystemButton("Next", () => {
        singlePassage = null;
        currentLocation.visitCounter++;
        showCurrentLocation();
    });
}

function getLocationDescription(location) {
    if (!location.descriptions || location.descriptions.length === 0) {
        return "";
    }

    if (location.descriptions.length === 1 || location.locationType === "Empty") {
        return location.descriptions[0];
    }

    const index = location.visitCounter % location.descriptions.length;
    return location.descriptions[index];
}

function cleanText(text) {
    if (!text) {
        return "";
    }

    return text
        .replaceAll("\n", "<br>")
        .replace(/<im .*? im>/g, "")
        .replace(/<so .*? so>/g, "")
        .replace(/<mu .*? mu>/g, "");
}

function clearChoices() {
    choicesEl.innerHTML = "";
}

function addPassageButton(passage) {
    const button = document.createElement("button");
    button.textContent = passage.question;
    button.onclick = () => showPassage(passage);

    choicesEl.appendChild(button);
}

function addSystemButton(text, action) {
    const button = document.createElement("button");
    button.textContent = text;
    button.onclick = action;

    choicesEl.appendChild(button);
}

function applyInfluences(unit) {
    if (!unit || !unit.influences || !quest.parameters) {
        return;
    }

    for (let i = 0; i < unit.influences.length; i++) {
        const parameter = quest.parameters[i];
        const influence = unit.influences[i];

        if (!parameter || !influence || !parameter.isActive) {
            continue;
        }

        switch (influence.influenceType) {
            case "Units":
                parameter.value = clamp(parameter.value + influence.value, parameter.minValue, parameter.maxValue);
                break;

            case "Percent":
                parameter.value = clamp(
                    Math.floor(parameter.value * (influence.value / 100 + 1)),
                    parameter.minValue,
                    parameter.maxValue
                );
                break;

            case "Value":
                parameter.value = clamp(influence.value, parameter.minValue, parameter.maxValue);
                break;

            case "Formula":
                // позже подключим нормальный evaluator
                break;
        }
    }
}

function applyParamsActions(unit) {
    if (!unit || !unit.paramsActions || !quest.parameters) {
        return;
    }

    for (let i = 0; i < quest.parameters.length; i++) {
        const parameter = quest.parameters[i];
        const action = unit.paramsActions[i];

        if (!parameter || !action) {
            continue;
        }

        if (action === "Hide") {
            parameter.isHidden = true;
        }

        if (action === "Show") {
            parameter.isHidden = false;
        }
    }
}

function renderParams() {
    paramsEl.innerHTML = "";

    for (const parameter of quest.parameters) {
        if (!parameter.isActive || parameter.isHidden) {
            continue;
        }

        const range = findCorrectRange(parameter);

        if (!range || !range.output) {
            continue;
        }

        const text = range.output.replace("<>", parameter.value.toString());

        const div = document.createElement("div");
        div.className = "param";
        div.textContent = text;

        paramsEl.appendChild(div);
    }
}

function findCorrectRange(parameter) {
    if (!parameter.paramsRanges) {
        return null;
    }

    return parameter.paramsRanges.find(range =>
        range.min <= parameter.value && range.max >= parameter.value
    ) || null;
}

function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}

function isPassageAvailable(passage) {

    if (passage.passability > 0 &&
        passage.visitCounter >= passage.passability) {
        return false;
    }

    if (passage.logicalCondition) {
        return evaluateBoolFormula(passage.logicalCondition);
    }

    return true;
}

function evaluateBoolFormula(formula) {
    let prepared = replaceParametersInFormula(formula);

    prepared = prepared.replaceAll("==", "===");

    if (!/^[0-9+\-*/%().<>=!&|?\s:]+$/.test(prepared)) {
        console.warn("Unsafe bool formula:", formula, "=>", prepared);
        return false;
    }

    try {
        return Boolean(Function(`"use strict"; return (${prepared});`)());
    } catch (e) {
        console.warn("Invalid bool formula:", formula, e);
        return false;
    }
}

function replaceParametersInFormula(formula) {
    let prepared = formula;

    for (const parameter of quest.parameters) {
        const key = "p" + parameter.index;
        prepared = prepared.replaceAll(key, parameter.value.toString());
    }

    return prepared;
}

function returnToMenu() {
    quest = null;
    currentLocation = null;
    singlePassage = null;

    titleEl.textContent = "Quest Reader";
    textEl.innerHTML = "First Electron App";
    paramsEl.innerHTML = "";

    clearChoices();

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