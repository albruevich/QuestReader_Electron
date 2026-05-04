import { Quest } from "../_Data/Quest";
import { Location } from "../_Data/Location";
import { Passage } from "../_Data/Passage";
import { LocationType } from "../_Data/_Enums/LocationType";
import { PassageResolver } from "./PassageResolver";
import { FormulaEvaluator } from "./FormulaEvaluator";
import { TextParser } from "./TextParser";

export type ChoiceView = {
    id: number;
    question: string;
    interactable: boolean;
};

export type GameViewState = {
    title: string;
    mainText: string;
    params: string[];
    choices: ChoiceView[];
    result: "none" | "victory" | "fail";
    imageName: string | null;
    musicName: string | null;
    soundName: string | null;
};

export class GameController {
    private quest: Quest | null = null;
    private currentLocation: Location | null = null;
    private singlePassage: Passage | null = null;
    private passageResolver: PassageResolver | null = null;
    private textParser: TextParser | null = null;

    startQuest(quest: Quest): GameViewState {
        this.quest = structuredClone(quest);

        this.initQuestRuntimeState();
        this.initControversials();

        this.textParser = new TextParser(this.quest);
        this.passageResolver = new PassageResolver(this.quest, this);

        const startLocation = this.quest.locations.find(l => l.locationType === LocationType.Start);

        if (!startLocation) {
            throw new Error("Start location not found");
        }

        this.currentLocation = startLocation;

        return this.showCurrentLocation();
    }

    choosePassage(passageId: number): GameViewState {
        if (passageId === -1) {
            return this.actionNext();
        }

        if (!this.quest) {
            return this.emptyState();
        }

        const passage = this.quest.passages.find(p => p.id === passageId);

        if (!passage) {
            return this.showCurrentLocation();
        }

        return this.showPassage(passage);
    }

    private actionNext(): GameViewState {
        if (!this.singlePassage || !this.currentLocation) {
            return this.showCurrentLocation();
        }

        this.singlePassage = null;

        return this.showCurrentLocation();
    }

    private showCurrentLocation(): GameViewState {
        if (!this.quest || !this.currentLocation) {
            return this.emptyState();
        }

        this.applyInfluences(this.currentLocation);
        this.applyParamsActions(this.currentLocation);

        const criticalFailState = this.getCriticalFailState();

        if (criticalFailState) {
            return criticalFailState;
        }

        const description = this.getLocationDescription(this.currentLocation);
        const imageName = this.extractImageName(description);
        const musicName = this.extractMusicName(description);
        const soundName = this.extractSoundName(description);
        const mainText = this.cleanText(description);

        if (this.currentLocation.locationType === LocationType.Victory) {
            this.currentLocation.visitCounter++;
            return this.makeState(mainText, [], "victory", imageName, musicName, soundName);
        }

        if (this.currentLocation.locationType === LocationType.Fail) {
            this.currentLocation.visitCounter++;
            return this.makeState(mainText, [], "fail", imageName, musicName, soundName);
        }

        const choices = this.passageResolver
            ? this.passageResolver.resolveVisiblePassages(this.currentLocation)
                .map(info => ({
                    id: info.pass.id,
                    question: this.parseText(info.pass.question),
                    interactable: info.isAllConditions
                }))
            : [];

        this.currentLocation.visitCounter++;

        return this.makeState(mainText, choices, "none", imageName, musicName, soundName);
    }

    public getQuest(): Quest | null {
        return this.quest;
    }

    public evaluateBoolFormulaPublic(formula: string): boolean {
        return this.evaluateBoolFormula(formula);
    }

    public evaluateNumberFormulaPublic(formula: string): number {
        return this.evaluateNumberFormula(formula);
    }

    private showPassage(passage: Passage): GameViewState {
        if (!this.quest) {
            return this.emptyState();
        }

        this.applyInfluences(passage);
        this.applyParamsActions(passage);

        const criticalFailState = this.getCriticalFailState();

        if (criticalFailState) {
            return criticalFailState;
        }

        passage.visitCounter++;

        const nextLocation = this.quest.locations.find(l => l.id === passage.to);

        if (!nextLocation) {
            console.warn("Next location not found:", passage.to);
            return this.showCurrentLocation();
        }

        this.currentLocation = nextLocation;

        if (!passage.description || this.currentLocation.locationType === LocationType.Empty) {
            if (this.currentLocation.locationType === LocationType.Empty && passage.description) {
                this.currentLocation.descriptions[0] = passage.description;
            }

            return this.showCurrentLocation();
        }

        this.singlePassage = passage;

        const imageName = this.extractImageName(passage.description);
        const musicName = this.extractMusicName(passage.description);
        const soundName = this.extractSoundName(passage.description);

        return this.makeState(
            this.cleanText(passage.description),
            [{ id: -1, question: "Next", interactable: true }],
            "none",
            imageName,
            musicName,
            soundName
        );
    }

    private initQuestRuntimeState(): void {
        if (!this.quest) return;

        for (const location of this.quest.locations) {
            location.visitCounter = 0;
        }

        for (const passage of this.quest.passages) {
            passage.visitCounter = 0;
        }

        for (const parameter of this.quest.parameters) {
            parameter.value = parameter.startValue;
        }
    }

    private initControversials(): void {
        if (!this.quest) return;

        for (const passage of this.quest.passages) {
            (passage as any).controversials = [];

            for (const other of this.quest.passages) {
                if (
                    other.from === passage.from &&
                    other.id !== passage.id &&
                    other.question === passage.question
                ) {
                    (passage as any).controversials.push(other);
                }
            }
        }
    }

    private applyInfluences(unit: any): void {
        if (!this.quest || !unit?.influences) return;

        for (let i = 0; i < unit.influences.length; i++) {
            const parameter = this.quest.parameters[i];
            const influence = unit.influences[i];

            if (!parameter || !influence || !parameter.isActive) continue;

            switch (influence.influenceType) {
                case "Units":
                    parameter.value = this.clamp(parameter.value + influence.value, parameter.minValue, parameter.maxValue);
                    break;

                case "Percent":
                    parameter.value = this.clamp(
                        Math.floor(parameter.value * (influence.value / 100 + 1)),
                        parameter.minValue,
                        parameter.maxValue
                    );
                    break;

                case "Value":
                    parameter.value = this.clamp(influence.value, parameter.minValue, parameter.maxValue);
                    break;

                case "Formula":
                    if (influence.formula) {
                        parameter.value = this.clamp(
                            this.evaluateNumberFormula(influence.formula),
                            parameter.minValue,
                            parameter.maxValue
                        );
                    }
                    break;
            }
        }
    }

    private applyParamsActions(unit: any): void {
        if (!this.quest || !unit?.paramsActions) return;

        for (let i = 0; i < this.quest.parameters.length; i++) {
            const parameter = this.quest.parameters[i];
            const action = unit.paramsActions[i];

            if (!parameter || !action) continue;

            if (action === "Hide") parameter.isHidden = true;
            if (action === "Show") parameter.isHidden = false;
        }
    }

    private getVisibleParams(): string[] {
        if (!this.quest) return [];

        const result: string[] = [];

        for (const parameter of this.quest.parameters) {
            if (!parameter.isActive || parameter.isHidden) continue;

            const range = parameter.paramsRanges?.find(r =>
                r.min <= parameter.value && r.max >= parameter.value
            );

            if (!range || !range.output) continue;

            let output = range.output.replace("<>", parameter.value.toString());
            output = this.parseText(output);

            for (const p of this.quest.parameters) {
                output = output.replaceAll(`p${p.index}`, p.value.toString());
            }

            result.push(output);
        }

        return result;
    }

    private getLocationDescription(location: Location): string {
        if (!location.descriptions || location.descriptions.length === 0) {
            return "";
        }

        if (location.descriptions.length === 1 || location.locationType === LocationType.Empty) {
            return location.descriptions[0];
        }

        if (location.chooseWithFormula && location.formula) {
            const index = this.evaluateNumberFormula(location.formula) - 1;

            if (index >= 0 && index < location.descriptions.length) {
                return location.descriptions[index];
            }

            return location.descriptions[0];
        }

        const index = location.visitCounter % location.descriptions.length;
        return location.descriptions[index];
    }

    private evaluateBoolFormula(formula: string): boolean {
        return FormulaEvaluator.evaluateBool(formula, this.fillFormulaDict());
    }

    private evaluateNumberFormula(formula: string): number {
        return FormulaEvaluator.evaluate(formula, this.fillFormulaDict());
    }

    private fillFormulaDict(): Record<string, number> {
        const dict: Record<string, number> = {};

        if (!this.quest) {
            return dict;
        }

        for (const parameter of this.quest.parameters) {
            dict["p" + parameter.index] = parameter.value;
        }

        return dict;
    }

    private extractImageName(text: string): string | null {
        return this.extractTagName(text, "im");
    }

    private extractMusicName(text: string): string | null {
        return this.extractTagName(text, "mu");
    }

    private extractSoundName(text: string): string | null {
        return this.extractTagName(text, "so");
    }

    private extractTagName(text: string, tag: string): string | null {
        if (!text) return null;

        const regex = new RegExp(`<${tag}\\s+(.+?)\\s+${tag}>`, "g");
        const matches = [...text.matchAll(regex)];

        if (matches.length === 0) {
            return null;
        }

        return matches[matches.length - 1][1].trim();
    }

    private cleanText(text: string): string {
        if (!text) return "";

        return this.parseText(text)
            .split("\n").join("<br>")
            .replace(/<im .*? im>/g, "")
            .replace(/<so .*? so>/g, "")
            .replace(/<mu .*? mu>/g, "");
    }

    private parseText(text: string): string {
        return this.textParser ? this.textParser.parse(text) : text;
    }

    private makeState(
        mainText: string,
        choices: ChoiceView[],
        result: GameViewState["result"],
        imageName: string | null,
        musicName: string | null,
        soundName: string | null
    ): GameViewState {
        return {
            title: this.quest ? this.quest.displayName || this.quest.questName : "",
            mainText,
            params: this.getVisibleParams(),
            choices,
            result,
            imageName,
            musicName,
            soundName
        };
    }

    private emptyState(): GameViewState {
        return {
            title: "",
            mainText: "",
            params: [],
            choices: [],
            result: "none",
            imageName: null,
            musicName: null,
            soundName: null
        };
    }

    private clamp(value: number, min: number, max: number): number {
        return Math.max(min, Math.min(max, value));
    }

    private getCriticalFailState(): GameViewState | null {
        if (!this.quest) {
            return null;
        }

        for (const parameter of this.quest.parameters) {
            if (!parameter.isActive) {
                continue;
            }

            if (parameter.paramType !== "Failed") {
                continue;
            }

            const isCriticalMax = parameter.isCriticMax === true;

            const isCritical = isCriticalMax
                ? parameter.value >= parameter.maxValue
                : parameter.value <= parameter.minValue;

            if (!isCritical) {
                continue;
            }

            const criticText = parameter.criticText || "";
            const critResources = this.getCritResourcesText(parameter);

            const fullFailText = `${criticText}\n${critResources}`;

            const imageName = this.extractImageName(fullFailText);
            const musicName = this.extractMusicName(fullFailText);
            const soundName = this.extractSoundName(fullFailText);

            const mainText = this.cleanText(criticText);

            return this.makeState(
                mainText,
                [],
                "fail",
                imageName,
                musicName,
                soundName
            );
        }

        return null;
    }

    private getCritResourcesText(parameter: any): string {
        if (!parameter || !parameter.critResources) {
            return "";
        }

        if (typeof parameter.critResources === "string") {
            return parameter.critResources;
        }

        if (Array.isArray(parameter.critResources)) {
            return parameter.critResources.join("\n");
        }

        return String(parameter.critResources);
    }
}