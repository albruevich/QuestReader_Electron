import { Unit } from "./Unit";
import { LocationType } from "./_Enums/LocationType";

export type Location = Unit & {
    chooseWithFormula: boolean;
    formula: string;

    gridX: number;
    gridY: number;

    locationType: LocationType;

    descriptions: string[];
    firstInPair: string[];
};