import { Quest } from "../_Data/Quest";
import { Player } from "../_Data/Player";
import { Location } from "../_Data/Location";
import { Passage } from "../_Data/Passage";
import { LocationType } from "../_Data/_Enums/LocationType";

import { QuestService } from "./QuestService";
import { TextParser } from "./TextParser";
import { PassageResolver } from "./PassageResolver";
import { LocationDescriptionResolver } from "./LocationDescriptionResolver";
import { PassageInfo } from "./PassageInfo";

export type GameViewState = {
    title: string;
    mainText: string;
    choices: Passage[];
    gameOver: boolean;
    result: "none" | "victory" | "fail";
};

export class GameController {

    private player: Player | null = null;
    private singlePassage: Passage | null = null;

    private textParser: TextParser | null = null;
    private locationDescriptionResolver: LocationDescriptionResolver | null = null;
    private passageResolver: PassageResolver | null = null;

    startQuest(quest: Quest): GameViewState {
        this.createPlayer(quest);
        return this.showCurrentLocation();
    }

    choosePassage(passageId: number): GameViewState {
        if (!this.player || this.player.gameOver) {
            return this.getEmptyState();
        }

        const passage = QuestService.findPassageWith(this.player.quest, passageId);

        if (!passage) {
            return this.getCurrentState();
        }

        this.player.locationID = passage.to;
        this.player.passageID = passage.id;

        return this.showPassage(passage);
    }

    actionNext(): GameViewState {
        if (!this.singlePassage || !this.player) {
            return this.getCurrentState();
        }

        this.player.locationID = this.singlePassage.to;
        this.player.passageID = this.singlePassage.id;

        const passage = this.singlePassage;
        this.singlePassage = null;

        return this.showPassage(passage);
    }

    private createPlayer(quest: Quest): void {
        const questClone = structuredClone(quest);
        const startLocation = QuestService.findStartLocation(questClone);

        if (!startLocation) {
            throw new Error("Start location not found");
        }

        this.player = {
            locationID: startLocation.id,
            passageID: 0,
            gameOver: false,
            quest: questClone
        };

        for (const location of questClone.locations) {
            location.visitCounter = 0;
        }

        for (const passage of questClone.passages) {
            passage.visitCounter = 0;
        }

        for (const parameter of questClone.parameters) {
            parameter.value = parameter.startValue;
        }

        this.singlePassage = null;

        this.textParser = new TextParser(questClone);
        this.locationDescriptionResolver = new LocationDescriptionResolver(this.textParser);
        this.passageResolver = new PassageResolver(questClone, this.textParser);
    }

    private showCurrentLocation(): GameViewState {
        if (!this.player || !this.textParser || !this.locationDescriptionResolver || !this.passageResolver) {
            return this.getEmptyState();
        }

        const location = QuestService.findLocationWith(this.player.quest, this.player.locationID);

        if (!location) {
            return this.getEmptyState();
        }

        const mainText = this.showLocationContent(location);

        if (this.isLocationType(location, LocationType.Victory)) {
            this.player.gameOver = true;

            return {
                title: this.getQuestTitle(),
                mainText,
                choices: [],
                gameOver: true,
                result: "victory"
            };
        }

        if (this.isLocationType(location, LocationType.Fail)) {
            this.player.gameOver = true;

            return {
                title: this.getQuestTitle(),
                mainText,
                choices: [],
                gameOver: true,
                result: "fail"
            };
        }

        const visiblePassages = this.showLocationPassages(location);

        location.visitCounter++;

        return {
            title: this.getQuestTitle(),
            mainText,
            choices: visiblePassages.map(info => info.pass),
            gameOver: false,
            result: "none"
        };
    }

    private showPassage(passage: Passage): GameViewState {
        if (!this.player || !this.textParser) {
            return this.getEmptyState();
        }

        this.singlePassage = null;

        passage.visitCounter++;

        const location = QuestService.findLocationWith(this.player.quest, this.player.locationID);

        if (!location) {
            return this.getEmptyState();
        }

        if (!passage.description || this.isLocationType(location, LocationType.Empty)) {
            if (this.isLocationType(location, LocationType.Empty) && passage.description) {
                location.descriptions[0] = passage.description;
            }

            return this.showCurrentLocation();
        }

        const mainText = this.textParser.parse(passage.description);

        const nextPassage: Passage = {
            ...passage,
            id: -1,
            to: passage.to,
            question: "Next",
            description: "",
            ignoreDemonstration: true
        };

        this.singlePassage = nextPassage;

        return {
            title: this.getQuestTitle(),
            mainText,
            choices: [nextPassage],
            gameOver: false,
            result: "none"
        };
    }

    private showLocationContent(location: Location): string {
        if (!this.locationDescriptionResolver || !this.textParser) {
            return "";
        }

        const description = this.locationDescriptionResolver.resolve(location);
        return this.textParser.parse(description);
    }

    private showLocationPassages(location: Location): PassageInfo[] {
        if (!this.player || this.player.gameOver || !this.passageResolver) {
            return [];
        }

        return this.passageResolver.resolveVisiblePassages(location);
    }

    private getCurrentState(): GameViewState {
        if (!this.player) {
            return this.getEmptyState();
        }

        return this.showCurrentLocation();
    }

    private getEmptyState(): GameViewState {
        return {
            title: "",
            mainText: "",
            choices: [],
            gameOver: false,
            result: "none"
        };
    }

    private getQuestTitle(): string {
        if (!this.player) {
            return "";
        }

        return this.player.quest.displayName || this.player.quest.questName;
    }

    private isLocationType(location: Location, type: LocationType): boolean {
        return location.locationType as LocationType === type;
    }
}