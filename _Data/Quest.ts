import { Parameter } from "./Parameter";
import { Location } from "./Location";
import { Passage } from "./Passage";

export type Quest = {
    ownerUserId: number;
    id: number;
    questName: string;
    displayName: string;
    description: string;
    startMusic: string;
    startImage: string;
    locationCount: number;
    passageCount: number;
    order: number;
    lang: string;
    author: string;

    parameters: Parameter[];
    locations: Location[];
    passages: Passage[];
};