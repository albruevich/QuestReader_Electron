
import { InfluenceType } from "./_Enums/InfluenceType";

export type Influence = {
    influenceType: InfluenceType;
    value: number;
    formula: string;
};