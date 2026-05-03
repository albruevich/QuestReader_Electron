import { Quest } from "../_Data/Quest";
import { Location } from "../_Data/Location";
import { Passage } from "../_Data/Passage";

export type PassageInfo = {
    pass: Passage;
    isAllConditions: boolean;
};

export class PassageResolver {
    constructor(
        private quest: Quest,
        private gameController: {
            evaluateBoolFormulaPublic(formula: string): boolean;
            evaluateNumberFormulaPublic(formula: string): number;
        }
    ) { }

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
        const passages = this.quest.passages.filter(p => p.from === location.id);
        const workPassages: Passage[] = [];
        const toDeleteByProbability: Passage[] = [];

        for (const passage of passages) {
            if (passage.priority < 1) {
                if (Math.floor(Math.random() * 100) <= passage.priority * 100) {
                    workPassages.push(passage);
                }

                toDeleteByProbability.push(passage);
            }
        }

        const remainingPassages = passages.filter(p => !toDeleteByProbability.includes(p));
        const excludedIds = new Set<number>();

        for (let n = remainingPassages.length - 1; n >= 0; n--) {
            const passage = remainingPassages[n];

            if (excludedIds.has(passage.id)) {
                continue;
            }

            if (workPassages.includes(passage)) {
                continue;
            }

            const controversials = (passage as any).controversials as Passage[] | undefined;

            if ((!controversials || controversials.length === 0) && passage.priority >= 1) {
                workPassages.push(passage);
                continue;
            }

            const allControversials: Passage[] = [...(controversials ?? []), passage];

            let last = 0;
            const segments: { x: number; y: number }[] = [];

            for (const controversialPassage of allControversials) {
                const priority = Math.floor(controversialPassage.priority);
                segments.push({ x: last, y: last + priority - 1 });
                last += priority;
            }

            if (last <= 0) {
                workPassages.push(allControversials[0]);
            } else {
                const randomValue = Math.floor(Math.random() * last);

                let selectedIndex = 0;
                for (let i = 0; i < segments.length; i++) {
                    const segment = segments[i];

                    if (randomValue >= segment.x && randomValue <= segment.y) {
                        selectedIndex = i;
                        break;
                    }
                }

                workPassages.push(allControversials[selectedIndex]);
            }

            for (const controversialPassage of allControversials) {
                excludedIds.add(controversialPassage.id);
            }
        }

        return workPassages;
    }

    private checkAllConditions(passage: Passage): boolean {
        const toLocation = this.quest.locations.find(l => l.id === passage.to);

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
                logicalCondition = this.gameController.evaluateBoolFormulaPublic(passage.logicalCondition);
            } catch {
                console.warn("Invalid logical condition formula!");
            }
        }

        for (let i = 0; i < this.quest.parameters.length; i++) {
            const parameter = this.quest.parameters[i];

            const necessaryRange = passage.necessaryRanges[i];
            if (necessaryRange?.isOn && (parameter.value < necessaryRange.min || parameter.value > necessaryRange.max)) {
                inRange = false;
                break;
            }

            const takenValues = passage.takenValues[i];
            if (takenValues?.formula) {
                try {
                    const value = this.gameController.evaluateNumberFormulaPublic(takenValues.formula);

                    if (takenValues.nonTaken) {
                        takesOrNotValues = parameter.value !== value;
                    } else {
                        takesOrNotValues = parameter.value === value;
                    }
                } catch {
                    console.warn("Invalid accepted values formula!");
                }
            }

            const multipleValues = passage.multipleValues[i];
            if (multipleValues?.formula) {
                try {
                    const value = this.gameController.evaluateNumberFormulaPublic(multipleValues.formula);

                    if (multipleValues.nonMultiple) {
                        multipleOrNotValues = parameter.value % value !== 0;
                    } else {
                        multipleOrNotValues = parameter.value % value === 0;
                    }
                } catch {
                    console.warn("Invalid divisibility formula!");
                }
            }
        }

        return passCondition && logicalCondition && inRange && takesOrNotValues && multipleOrNotValues;
    }
}
