import { Quest } from "./Quest";

export type Player = {
    locationID: number;
    passageID: number;
    gameOver: boolean;
    quest: Quest;
};