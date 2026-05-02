import { Location } from "../_Data/Location";
import { LocationType } from "../_Data/_Enums/LocationType";
import { TextParser } from "./TextParser";

export class LocationDescriptionResolver {

    lastDescriptionIndex: number = 0;

    constructor(private textParser: TextParser) {}

    resolve(location: Location): string {
        if (!location.descriptions || location.descriptions.length === 0) {
            return "";
        }

        if (
            location.descriptions.length === 1 ||
            location.locationType === LocationType.Empty ||
            location.locationType as unknown as number === 4
        ) {
            this.lastDescriptionIndex = 0;
            return this.textParser.parse(location.descriptions[0]);
        }

        if (location.chooseWithFormula) {
            return this.resolveWithFormula(location);
        }

        return this.resolveSequentially(location);
    }

    private resolveWithFormula(location: Location): string {
        let index = 0;

        if (!location.formula) {
            index = Math.floor(Math.random() * location.descriptions.length);
        } else {
            try {
                index = this.evaluateSimpleFormula(location.formula) - 1;
            } catch {
                console.warn("Invalid description selection formula!");
            }

            if (index < 0 || index > location.descriptions.length - 1) {
                index = 0;
            }
        }

        this.lastDescriptionIndex = index;
        return this.textParser.parse(location.descriptions[index]);
    }

    private resolveSequentially(location: Location): string {
        this.lastDescriptionIndex = location.visitCounter % location.descriptions.length;
        return this.textParser.parse(location.descriptions[this.lastDescriptionIndex]);
    }

    private evaluateSimpleFormula(formula: string): number {
        const dict = this.textParser.fillFormulaDict();

        let prepared = formula;

        for (const key of Object.keys(dict)) {
            prepared = prepared.replaceAll(key, dict[key].toString());
        }

        if (!/^[0-9+\-*/%().\s]+$/.test(prepared)) {
            throw new Error("Unsafe formula");
        }

        return Math.floor(Function(`"use strict"; return (${prepared});`)());
    }
}