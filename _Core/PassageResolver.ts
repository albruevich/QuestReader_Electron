import { Quest } from "../_Data/Quest";
import { Location } from "../_Data/Location";
import { Passage } from "../_Data/Passage";
import { PassageInfo } from "./PassageInfo";
import { QuestService } from "./QuestService";
import { TextParser } from "./TextParser";

export class PassageResolver {

    constructor(
        private quest: Quest,
        private textParser: TextParser
    ) {}

    resolveVisiblePassages(location: Location): PassageInfo[] {
        const workPassages = this.buildWorkPassages(location);
        workPassages.sort((a, b) => a.displayOrder - b.displayOrder);

        const visiblePassages: PassageInfo[] = [];

        for (const passage of workPassages) {
            const allConditions = this.checkAllConditions(passage);

            if (allConditions || passage.alwaysShow) {
                visiblePassages.push({
                    pass: passage,
                    isAllConditions: allConditions
                });
            }
        }

        return visiblePassages;
    }

    private buildWorkPassages(location: Location): Passage[] {
        const passages = QuestService
            .findAllPassagesFromLocation(this.quest, location.id)
            .slice();

        const workPassages: Passage[] = [];

        for (const passage of passages) {
            if (passage.priority < 1) {
                if (Math.random() * 100 <= passage.priority * 100) {
                    workPassages.push(passage);
                }
            } else {
                workPassages.push(passage);
            }
        }

        return workPassages;
    }

    private checkAllConditions(passage: Passage): boolean {
        const toLocation = QuestService.findLocationWith(this.quest, passage.to);

        if (!toLocation) {
            return false;
        }

        const passCondition =
            (passage.passability === 0 || passage.visitCounter < passage.passability) &&
            (toLocation.passability === 0 || toLocation.visitCounter < toLocation.passability);

        let logicalCondition = true;
        let inRange = true;
        let takesOrNotValues = true;
        let multipleOrNotValues = true;

        if (passage.logicalCondition) {
            try {
                logicalCondition = this.evaluateBoolFormula(passage.logicalCondition);
            } catch {
                console.warn("Invalid logical condition formula!");
            }
        }

        for (let i = 0; i < this.quest.parameters.length; i++) {
            const parameter = this.quest.parameters[i];

            const necessaryRange = passage.necessaryRanges[i];
            if (
                necessaryRange &&
                necessaryRange.isOn &&
                (parameter.value < necessaryRange.min || parameter.value > necessaryRange.max)
            ) {
                inRange = false;
                break;
            }

            const takenValues = passage.takenValues[i];
            if (takenValues && takenValues.formula) {
                try {
                    const value = this.evaluateNumberFormula(takenValues.formula);

                    takesOrNotValues = takenValues.nonTaken
                        ? parameter.value !== value
                        : parameter.value === value;
                } catch {
                    console.warn("Invalid accepted values formula!");
                }
            }

            const multipleValues = passage.multipleValues[i];
            if (multipleValues && multipleValues.formula) {
                try {
                    const value = this.evaluateNumberFormula(multipleValues.formula);

                    if (value === 0) {
                        multipleOrNotValues = false;
                    } else {
                        multipleOrNotValues = multipleValues.nonMultiple
                            ? parameter.value % value !== 0
                            : parameter.value % value === 0;
                    }
                } catch {
                    console.warn("Invalid divisibility formula!");
                }
            }
        }

        return passCondition &&
            logicalCondition &&
            inRange &&
            takesOrNotValues &&
            multipleOrNotValues;
    }

    private evaluateNumberFormula(formula: string): number {
        const dict = this.textParser.fillFormulaDict();

        let prepared = formula;

        for (const key of Object.keys(dict)) {
            prepared = prepared.replaceAll(key, dict[key].toString());
        }

        if (!/^[0-9+\-*/%().\s]+$/.test(prepared)) {
            throw new Error("Unsafe number formula");
        }

        return Math.floor(Function(`"use strict"; return (${prepared});`)());
    }

    private evaluateBoolFormula(formula: string): boolean {
        const dict = this.textParser.fillFormulaDict();

        let prepared = formula;

        for (const key of Object.keys(dict)) {
            prepared = prepared.replaceAll(key, dict[key].toString());
        }

        if (!/^[0-9+\-*/%().<>=!&| \s]+$/.test(prepared)) {
            throw new Error("Unsafe bool formula");
        }

        return Boolean(Function(`"use strict"; return (${prepared});`)());
    }
}