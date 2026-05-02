import { Influence } from "./Influence";
import { ParamsAction } from "./_Enums/ParamsAction";

export type Unit = {
    id: number;
    passability: number;
    visitCounter: number;

    influences: Influence[];
    paramsActions: ParamsAction[];
};