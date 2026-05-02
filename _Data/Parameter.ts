import { ParamType } from "./_Enums/ParamType";
import { ParamsRange } from "./ParamsRange";

export type Parameter = {
    workingName: string;
    paramType: ParamType;

    index: number;
    value: number;
    startValue: number;
    minValue: number;
    maxValue: number;

    isActive: boolean;
    isCriticMax: boolean;
    isHidden: boolean;

    criticText: string;
    critResources: string;

    paramsRanges: ParamsRange[];
};