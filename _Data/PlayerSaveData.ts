export type PlayerSaveData = {
    questName: string;
    locationID: number;
    passageID: number;
    lastPlayedMusic: string;
    gameOver: boolean;

    parameterValues: number[];
    parameterHidden: boolean[];

    locationVisitCounters: Record<number, number>;
    passageVisitCounters: Record<number, number>;
};