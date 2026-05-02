import { Unit } from "./Unit";
import { NecessaryRange } from "./NecessaryRange";
import { TakenValues } from "./TakenValues";
import { MultipleValues } from "./MultipleValues";

export type Passage = Unit & {
    from: number;
    to: number;
    same: number;

    question: string;
    description: string;
    logicalCondition: string;
    priority: number;
    displayOrder: number;
    alwaysShow: boolean;
    ignoreDemonstration: boolean;

    necessaryRanges: NecessaryRange[];
    takenValues: TakenValues[];
    multipleValues: MultipleValues[];
};