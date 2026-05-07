import { Quest } from "../_Data/Quest";
import { Location } from "../_Data/Location";
import { Passage } from "../_Data/Passage";
import { LocationType } from "../_Data/_Enums/LocationType";
import { PassageResolver } from "./PassageResolver";
import { FormulaEvaluator } from "./FormulaEvaluator";
import { TextParser } from "./TextParser";
import JSZip from "jszip";
import { ApiManager } from "./ApiManager";
import { QuestShort } from "../_Data/QuestShort";

export enum GameMode {
    Menu = "menu",
    Play = "play"
}

export enum QuestSource {
    Local = "local",
    Remote = "remote"
}

type QuestLoader = (questShort: QuestShort, source: QuestSource) => Promise<Quest | null>;
type LocalQuestListLoader = () => QuestShort[];
type ResourceResolver = (
    folderName: string,
    resourceName: string | null,
    extensions: string[]
) => Promise<string | null> | string | null;

type ChoiceView = {
    id: number;
    question: string;
    interactable: boolean;
};

type GameViewState = {
    title: string;
    mainText: string;
    params: string[];
    choices: ChoiceView[];
    result: "none" | "victory" | "fail";
    imageName: string | null;
    musicName: string | null;
    soundName: string | null;
};


export class GameController {
    private quest: Quest | null = null;
    private currentLocation: Location | null = null;
    private singlePassage: Passage | null = null;
    private passageResolver: PassageResolver | null = null;
    private textParser: TextParser | null = null;

    private mode: GameMode = GameMode.Menu;
    private source: QuestSource = QuestSource.Local;

    private selectedQuest: QuestShort | null = null;
    private localQuests: QuestShort[] = [];
    private remoteQuests: QuestShort[] = [];

    private remoteQuestPackage: JSZip | null = null;
    private remoteResourceUrls: Map<string, string> = new Map();

    private questLoader: QuestLoader | null = null;
    private localQuestListLoader: LocalQuestListLoader | null = null;
    private localResourceResolver: ResourceResolver | null = null;
    private serverAvailable: boolean = false;

    private isStartingQuest: boolean = false;
    private cancelStartRequested: boolean = false;

    public setLocalQuestListLoader(loader: LocalQuestListLoader): void {
        this.localQuestListLoader = loader;
    }

    public getMode(): GameMode {
        return this.mode;
    }

    public getSource(): QuestSource {
        return this.source;
    }

    public getSelectedQuestInfo(): QuestShort | null {
        return this.selectedQuest;
    }

    public getCurrentQuestList(): QuestShort[] {
        return this.source === QuestSource.Remote
            ? this.remoteQuests
            : this.localQuests;
    }

    public setLocalQuests(quests: QuestShort[]): void {
        this.localQuests = [...quests].sort(this.sortQuestShort);
    }

    public setRemoteQuests(quests: QuestShort[]): void {
        this.remoteQuests = [...quests].sort(this.sortQuestShort);
    }

    public isServerAvailable(): boolean {
        return this.serverAvailable;
    }

    public isInputBlocked(): boolean {
        return this.isStartingQuest;
    }

    public isQuestStartInProgress(): boolean {
        return this.isStartingQuest;
    }

    public willStartRemoteQuest(): boolean {
        return this.source === QuestSource.Remote && this.selectedQuest !== null;
    }

    public cancelStartQuest(): void {
        if (!this.isStartingQuest) {
            return;
        }

        this.cancelStartRequested = true;
    }

    private throwIfStartCancelled(): void {
        if (this.cancelStartRequested) {
            throw new Error("Quest start cancelled.");
        }
    }

    public refreshLocalQuests(): QuestShort[] {
        if (!this.localQuestListLoader) {
            this.localQuests = [];
            this.selectedQuest = null;
            return [];
        }

        this.setLocalQuests(this.localQuestListLoader());
        this.selectFirstQuestIfNeeded();
        return this.getCurrentQuestList();
    }

    public async checkServerAvailability(): Promise<boolean> {
        try {
            await ApiManager.getAllQuests();
            this.serverAvailable = true;
        }
        catch (error) {
            console.warn("Server unavailable:", error instanceof Error ? error.message : error);
            this.serverAvailable = false;
        }

        return this.serverAvailable;
    }

    public async refreshRemoteQuests(): Promise<QuestShort[]> {
        const json = await ApiManager.getAllQuests();
        const rawQuests = JSON.parse(json);

        const quests = Array.isArray(rawQuests)
            ? rawQuests.map(q => this.normalizeQuestShort(q))
            : [];

        this.setRemoteQuests(quests);
        this.selectFirstQuestIfNeeded();

        return this.getCurrentQuestList();
    }

    public switchToLocal(): QuestShort | null {
        this.source = QuestSource.Local;
        this.mode = GameMode.Menu;
        this.quest = null;
        this.clearRemotePackage();
        return this.selectFirstQuestIfNeeded();
    }

    public switchToRemote(): QuestShort | null {
        this.source = QuestSource.Remote;
        this.mode = GameMode.Menu;
        this.quest = null;
        return this.selectFirstQuestIfNeeded();
    }

    private normalizeQuestShort(q: any): QuestShort {
        return {
            id: q.id ?? q.Id ?? 0,
            ownerUserId: q.ownerUserId ?? q.OwnerUserId ?? 0,
            questName: q.questName ?? q.QuestName ?? "",
            displayName: q.displayName ?? q.DisplayName ?? q.questName ?? q.QuestName ?? "",
            description: q.description ?? q.Description ?? "",
            startImage: q.startImage ?? q.StartImage ?? "",
            startMusic: q.startMusic ?? q.StartMusic ?? "",
            order: Number(q.order ?? q.Order ?? 0),
            lang: q.lang ?? q.Lang ?? "en",
            author: q.author ?? q.Author ?? ""
        } as QuestShort;
    }

    public selectLocal(): QuestShort | null {
        return this.switchToLocal();
    }

    public selectRemote(): QuestShort | null {
        return this.switchToRemote();
    }

    public selectQuest(questShort: QuestShort | null): QuestShort | null {
        this.selectedQuest = questShort;
        return this.selectedQuest;
    }

    public async selectQuestForMenu(questShort: QuestShort | null): Promise<Quest | null> {
        this.selectedQuest = questShort;
        this.mode = GameMode.Menu;
        this.currentLocation = null;
        this.singlePassage = null;
        this.passageResolver = null;
        this.textParser = null;

        if (!questShort) {
            this.quest = null;
            return null;
        }

        if (this.source === QuestSource.Remote) {
            // Reference Reader behavior: remote selection loads only short info/preview.
            // Full quest data is loaded only on Start through the quest package.
            this.quest = null;
            return null;
        }

        if (!this.questLoader) {
            this.quest = null;
            return null;
        }

        this.quest = await this.questLoader(questShort, this.source);
        return this.quest;
    }

    public getSelectedQuest(): QuestShort | null {
        return this.selectedQuest;
    }

    public hasSelectedQuest(): boolean {
        return this.selectedQuest !== null;
    }

    private selectFirstQuestIfNeeded(): QuestShort | null {
        const quests = this.getCurrentQuestList();

        if (quests.length === 0) {
            this.selectedQuest = null;
            return null;
        }

        if (
            this.selectedQuest &&
            quests.some(q => this.isSameQuestShort(q, this.selectedQuest))
        ) {
            return this.selectedQuest;
        }

        this.selectedQuest = quests[0];
        return this.selectedQuest;
    }

    private sortQuestShort(a: QuestShort, b: QuestShort): number {
        if (a.order !== b.order) {
            return a.order - b.order;
        }

        return a.questName.localeCompare(b.questName);
    }

    private isSameQuestShort(a: QuestShort, b: QuestShort): boolean {
        if (this.source === QuestSource.Remote) {
            return a.id === b.id;
        }

        return a.questName === b.questName;
    }

    public async startSelectedQuest(): Promise<GameViewState | null> {
        if (this.isStartingQuest) {
            return null;
        }

        if (!this.selectedQuest) {
            return this.emptyState();
        }

        this.isStartingQuest = true;
        this.cancelStartRequested = false;

        try {
            let quest: Quest;

            if (this.source === QuestSource.Remote) {
                quest = await this.loadRemoteQuestFromPackage(this.selectedQuest);
                this.throwIfStartCancelled();
            }
            else {
                if (!this.questLoader) {
                    return this.emptyState();
                }

                this.clearRemotePackage();

                const loadedQuest = await this.questLoader(this.selectedQuest, this.source);
                this.throwIfStartCancelled();

                if (!loadedQuest) {
                    return this.emptyState();
                }

                quest = loadedQuest;
            }

            this.mode = GameMode.Play;

            return this.startQuest(quest);
        }
        catch (error) {
            if (this.cancelStartRequested) {
                console.log("Quest start cancelled.");
                return null;
            }

            throw error;
        }
        finally {
            this.isStartingQuest = false;
            this.cancelStartRequested = false;
        }
    }

    public async getCurrentImageUrl(imageName: string | null): Promise<string | null> {
        if (this.source === QuestSource.Remote) {
            return await this.getRemoteCurrentImageUrl(imageName);
        }

        return await this.getLocalResourceUrl(
            "Images",
            imageName,
            [".png", ".jpg", ".jpeg", ".webp"]
        );
    }

    public async getCurrentMusicUrl(musicName: string | null): Promise<string | null> {
        if (this.source === QuestSource.Remote) {
            return await this.getRemoteMusicUrl(musicName);
        }

        return await this.getLocalResourceUrl(
            "Musics",
            musicName,
            [".ogg", ".mp3", ".wav", ".aif", ".aiff"]
        );
    }

    public async getCurrentSoundUrl(soundName: string | null): Promise<string | null> {
        if (this.source === QuestSource.Remote) {
            return await this.getRemoteSoundUrl(soundName);
        }

        return await this.getLocalResourceUrl(
            "Sounds",
            soundName,
            [".ogg", ".mp3", ".wav", ".aif", ".aiff"]
        );
    }

    private async getRemoteCurrentImageUrl(imageName: string | null): Promise<string | null> {
        if (this.mode === GameMode.Menu) {
            if (!this.selectedQuest || !this.selectedQuest.id) {
                return null;
            }

            return ApiManager.getQuestPreviewImageUrl(this.selectedQuest.id);
        }

        return await this.getRemoteImageUrl(imageName);
    }

    private async getLocalResourceUrl(
        folderName: string,
        resourceName: string | null,
        extensions: string[]
    ): Promise<string | null> {
        if (!this.localResourceResolver || !resourceName) {
            return null;
        }

        return await this.localResourceResolver(folderName, resourceName, extensions);
    }

    private async loadRemoteQuestFromPackage(questInfo: QuestShort): Promise<Quest> {
        if (!questInfo.id) {
            throw new Error("Remote quest id is missing.");
        }

        this.clearRemotePackage();
        this.throwIfStartCancelled();

        const bytes = await ApiManager.downloadQuestPackage(questInfo.id);
        this.throwIfStartCancelled();

        this.remoteQuestPackage = await JSZip.loadAsync(bytes);
        this.throwIfStartCancelled();

        const questFile = this.remoteQuestPackage.file("quest.json");

        if (!questFile) {
            throw new Error("quest.json not found in remote package.");
        }

        const json = await questFile.async("string");
        this.throwIfStartCancelled();

        const rawQuest = JSON.parse(json);
        return this.normalizeQuest(rawQuest);
    }

    private clearRemotePackage(): void {
        for (const url of this.remoteResourceUrls.values()) {
            URL.revokeObjectURL(url);
        }

        this.remoteResourceUrls.clear();
        this.remoteQuestPackage = null;
    }

    public async getRemoteImageUrl(imageName: string | null): Promise<string | null> {
        return await this.getRemoteResourceUrl(
            "Images",
            imageName,
            [".png", ".jpg", ".jpeg", ".webp"]
        );
    }

    public async getRemoteMusicUrl(musicName: string | null): Promise<string | null> {
        return await this.getRemoteResourceUrl(
            "Musics",
            musicName,
            [".ogg", ".mp3", ".wav", ".aif", ".aiff"]
        );
    }

    public async getRemoteSoundUrl(soundName: string | null): Promise<string | null> {
        return await this.getRemoteResourceUrl(
            "Sounds",
            soundName,
            [".ogg", ".mp3", ".wav", ".aif", ".aiff"]
        );
    }

    private async getRemoteResourceUrl(
        folderName: string,
        resourceName: string | null,
        extensions: string[]
    ): Promise<string | null> {
        if (!this.remoteQuestPackage || !resourceName) {
            return null;
        }

        const file = this.findRemoteResourceFile(folderName, resourceName, extensions);

        if (!file) {
            return null;
        }

        const cacheKey = file.name;
        const cachedUrl = this.remoteResourceUrls.get(cacheKey);

        if (cachedUrl) {
            return cachedUrl;
        }

        const blob = await file.async("blob");
        const url = URL.createObjectURL(blob);

        this.remoteResourceUrls.set(cacheKey, url);

        return url;
    }

    private findRemoteResourceFile(
        folderName: string,
        resourceName: string,
        extensions: string[]
    ): JSZip.JSZipObject | null {
        if (!this.remoteQuestPackage) {
            return null;
        }

        const cleanName = resourceName.trim().split("\\").join("/");
        const dotIndex = cleanName.lastIndexOf(".");
        const hasExtension = dotIndex > 0;
        const nameWithoutExtension = hasExtension
            ? cleanName.substring(0, dotIndex)
            : cleanName;

        const candidates: string[] = [];

        if (hasExtension) {
            candidates.push(`${folderName}/${cleanName}`);
        }
        else {
            for (const extension of extensions) {
                candidates.push(`${folderName}/${nameWithoutExtension}${extension}`);
            }
        }

        for (const candidate of candidates) {
            const directFile = this.remoteQuestPackage.file(candidate);

            if (directFile) {
                return directFile;
            }
        }

        const normalizedFolder = folderName.toLowerCase();
        const normalizedCandidates = candidates.map(c => c.toLowerCase());

        const files = Object.values(this.remoteQuestPackage.files) as JSZip.JSZipObject[];

        for (const file of files) {
            if (file.dir) {
                continue;
            }

            const normalizedFileName = file.name.split("\\").join("/").toLowerCase();

            if (normalizedCandidates.some(candidate => normalizedFileName.endsWith(candidate))) {
                return file;
            }

            const parts = normalizedFileName.split("/");
            const folderIndex = parts.lastIndexOf(normalizedFolder);

            if (folderIndex < 0 || folderIndex === parts.length - 1) {
                continue;
            }

            const fileName = parts[parts.length - 1];
            const fileNameWithoutExtension = fileName.includes(".")
                ? fileName.substring(0, fileName.lastIndexOf("."))
                : fileName;

            if (hasExtension) {
                if (fileName === cleanName.toLowerCase()) {
                    return file;
                }
            }
            else if (fileNameWithoutExtension === nameWithoutExtension.toLowerCase()) {
                return file;
            }
        }

        return null;
    }

    private startQuest(quest: Quest): GameViewState {
        this.quest = structuredClone(quest);

        this.initQuestRuntimeState();
        this.initControversials();

        this.textParser = new TextParser(this.quest);
        this.passageResolver = new PassageResolver(this.quest, this);

        const startLocation = this.quest.locations.find(l => l.locationType === LocationType.Start);

        if (!startLocation) {
            throw new Error("Start location not found");
        }

        this.currentLocation = startLocation;

        return this.showCurrentLocation();
    }

    choosePassage(passageId: number): GameViewState {
        if (passageId === -1) {
            return this.actionNext();
        }

        if (!this.quest) {
            return this.emptyState();
        }

        const passage = this.quest.passages.find(p => p.id === passageId);

        if (!passage) {
            return this.showCurrentLocation();
        }

        return this.showPassage(passage);
    }

    private actionNext(): GameViewState {
        if (!this.singlePassage || !this.currentLocation) {
            return this.showCurrentLocation();
        }

        this.singlePassage = null;

        return this.showCurrentLocation();
    }

    private showCurrentLocation(): GameViewState {
        if (!this.quest || !this.currentLocation) {
            return this.emptyState();
        }

        this.applyInfluences(this.currentLocation);
        this.applyParamsActions(this.currentLocation);

        const criticalFailState = this.getCriticalFailState();

        if (criticalFailState) {
            return criticalFailState;
        }

        const description = this.getLocationDescription(this.currentLocation);
        const imageName = this.extractImageName(description);
        const soundName = this.extractSoundName(description);
        const mainText = this.cleanText(description);

        let musicName = this.extractMusicName(description);
        if (!musicName && this.currentLocation.locationType === LocationType.Start) {
            musicName = this.quest?.startMusic ?? null;
        }

        if (this.currentLocation.locationType === LocationType.Victory) {
            this.currentLocation.visitCounter++;
            return this.makeState(mainText, [], "victory", imageName, musicName, soundName);
        }

        if (this.currentLocation.locationType === LocationType.Fail) {
            this.currentLocation.visitCounter++;
            return this.makeState(mainText, [], "fail", imageName, musicName, soundName);
        }

        const choices = this.passageResolver
            ? this.passageResolver.resolveVisiblePassages(this.currentLocation)
                .map(info => ({
                    id: info.pass.id,
                    question: this.parseText(info.pass.question),
                    interactable: info.isAllConditions
                }))
            : [];

        this.currentLocation.visitCounter++;

        return this.makeState(mainText, choices, "none", imageName, musicName, soundName);
    }

    public getQuest(): Quest | null {
        return this.quest;
    }

    public evaluateBoolFormulaPublic(formula: string): boolean {
        return this.evaluateBoolFormula(formula);
    }

    public evaluateNumberFormulaPublic(formula: string): number {
        return this.evaluateNumberFormula(formula);
    }

    private showPassage(passage: Passage): GameViewState {
        if (!this.quest) {
            return this.emptyState();
        }

        this.applyInfluences(passage);
        this.applyParamsActions(passage);

        const criticalFailState = this.getCriticalFailState();

        if (criticalFailState) {
            return criticalFailState;
        }

        passage.visitCounter++;

        const nextLocation = this.quest.locations.find(l => l.id === passage.to);

        if (!nextLocation) {
            console.warn("Next location not found:", passage.to);
            return this.showCurrentLocation();
        }

        this.currentLocation = nextLocation;

        if (!passage.description || this.currentLocation.locationType === LocationType.Empty) {
            if (this.currentLocation.locationType === LocationType.Empty && passage.description) {
                this.currentLocation.descriptions[0] = passage.description;
            }

            return this.showCurrentLocation();
        }

        this.singlePassage = passage;

        const imageName = this.extractImageName(passage.description);
        const musicName = this.extractMusicName(passage.description);
        const soundName = this.extractSoundName(passage.description);

        return this.makeState(
            this.cleanText(passage.description),
            [{ id: -1, question: "Next", interactable: true }],
            "none",
            imageName,
            musicName,
            soundName
        );
    }

    private initQuestRuntimeState(): void {
        if (!this.quest) return;

        for (const location of this.quest.locations) {
            location.visitCounter = 0;
        }

        for (const passage of this.quest.passages) {
            passage.visitCounter = 0;
        }

        for (const parameter of this.quest.parameters) {
            parameter.value = parameter.startValue;
        }
    }

    private initControversials(): void {
        if (!this.quest) return;

        for (const passage of this.quest.passages) {
            (passage as any).controversials = [];

            for (const other of this.quest.passages) {
                if (
                    other.from === passage.from &&
                    other.id !== passage.id &&
                    other.question === passage.question
                ) {
                    (passage as any).controversials.push(other);
                }
            }
        }
    }

    private applyInfluences(unit: any): void {
        if (!this.quest || !unit?.influences) return;

        for (let i = 0; i < unit.influences.length; i++) {
            const parameter = this.quest.parameters[i];
            const influence = unit.influences[i];

            if (!parameter || !influence || !parameter.isActive) continue;

            switch (influence.influenceType) {
                case "Units":
                    parameter.value = this.clamp(parameter.value + influence.value, parameter.minValue, parameter.maxValue);
                    break;

                case "Percent":
                    parameter.value = this.clamp(
                        Math.floor(parameter.value * (influence.value / 100 + 1)),
                        parameter.minValue,
                        parameter.maxValue
                    );
                    break;

                case "Value":
                    parameter.value = this.clamp(influence.value, parameter.minValue, parameter.maxValue);
                    break;

                case "Formula":
                    if (influence.formula) {
                        parameter.value = this.clamp(
                            this.evaluateNumberFormula(influence.formula),
                            parameter.minValue,
                            parameter.maxValue
                        );
                    }
                    break;
            }
        }
    }

    private applyParamsActions(unit: any): void {
        if (!this.quest || !unit?.paramsActions) return;

        for (let i = 0; i < this.quest.parameters.length; i++) {
            const parameter = this.quest.parameters[i];
            const action = unit.paramsActions[i];

            if (!parameter || !action) continue;

            if (action === "Hide") parameter.isHidden = true;
            if (action === "Show") parameter.isHidden = false;
        }
    }

    private getVisibleParams(): string[] {
        if (!this.quest) return [];

        const result: string[] = [];

        for (const parameter of this.quest.parameters) {
            if (!parameter.isActive || parameter.isHidden) continue;

            const range = parameter.paramsRanges?.find(r =>
                r.min <= parameter.value && r.max >= parameter.value
            );

            if (!range || !range.output) continue;

            let output = range.output.replace("<>", parameter.value.toString());
            output = this.parseText(output);

            for (const p of this.quest.parameters) {
                output = output.replaceAll(`p${p.index}`, p.value.toString());
            }

            result.push(output);
        }

        return result;
    }

    private getLocationDescription(location: Location): string {
        if (!location.descriptions || location.descriptions.length === 0) {
            return "";
        }

        if (location.descriptions.length === 1 || location.locationType === LocationType.Empty) {
            return location.descriptions[0];
        }

        if (location.chooseWithFormula && location.formula) {
            const index = this.evaluateNumberFormula(location.formula) - 1;

            if (index >= 0 && index < location.descriptions.length) {
                return location.descriptions[index];
            }

            return location.descriptions[0];
        }

        const index = location.visitCounter % location.descriptions.length;
        return location.descriptions[index];
    }

    private evaluateBoolFormula(formula: string): boolean {
        return FormulaEvaluator.evaluateBool(formula, this.fillFormulaDict());
    }

    private evaluateNumberFormula(formula: string): number {
        return FormulaEvaluator.evaluate(formula, this.fillFormulaDict());
    }

    private fillFormulaDict(): Record<string, number> {
        const dict: Record<string, number> = {};

        if (!this.quest) {
            return dict;
        }

        for (const parameter of this.quest.parameters) {
            dict["p" + parameter.index] = parameter.value;
        }

        return dict;
    }

    private extractImageName(text: string): string | null {
        return this.extractTagName(text, "im");
    }

    private extractMusicName(text: string): string | null {
        return this.extractTagName(text, "mu");
    }

    private extractSoundName(text: string): string | null {
        return this.extractTagName(text, "so");
    }

    private extractTagName(text: string, tag: string): string | null {
        if (!text) return null;

        const regex = new RegExp(`<${tag}\\s+(.+?)\\s+${tag}>`, "g");
        const matches = [...text.matchAll(regex)];

        if (matches.length === 0) {
            return null;
        }

        return matches[matches.length - 1][1].trim();
    }

    private cleanText(text: string): string {
        if (!text) return "";

        return this.parseText(text)
            .split("\n").join("<br>")
            .replace(/<im .*? im>/g, "")
            .replace(/<so .*? so>/g, "")
            .replace(/<mu .*? mu>/g, "");
    }

    private parseText(text: string): string {
        return this.textParser ? this.textParser.parse(text) : text;
    }

    private makeState(
        mainText: string,
        choices: ChoiceView[],
        result: GameViewState["result"],
        imageName: string | null,
        musicName: string | null,
        soundName: string | null
    ): GameViewState {
        return {
            title: this.quest ? this.quest.displayName || this.quest.questName : "",
            mainText,
            params: this.getVisibleParams(),
            choices,
            result,
            imageName,
            musicName,
            soundName
        };
    }

    private emptyState(): GameViewState {
        return {
            title: "",
            mainText: "",
            params: [],
            choices: [],
            result: "none",
            imageName: null,
            musicName: null,
            soundName: null
        };
    }

    private clamp(value: number, min: number, max: number): number {
        return Math.max(min, Math.min(max, value));
    }

    private getCriticalFailState(): GameViewState | null {
        if (!this.quest) {
            return null;
        }

        for (const parameter of this.quest.parameters) {
            if (!parameter.isActive) {
                continue;
            }

            if (parameter.paramType !== "Failed") {
                continue;
            }

            const isCriticalMax = parameter.isCriticMax === true;

            const isCritical = isCriticalMax
                ? parameter.value >= parameter.maxValue
                : parameter.value <= parameter.minValue;

            if (!isCritical) {
                continue;
            }

            const criticText = parameter.criticText || "";
            const critResources = this.getCritResourcesText(parameter);

            const fullFailText = `${criticText}\n${critResources}`;

            const imageName = this.extractImageName(fullFailText);
            const musicName = this.extractMusicName(fullFailText);
            const soundName = this.extractSoundName(fullFailText);

            const mainText = this.cleanText(criticText);

            return this.makeState(
                mainText,
                [],
                "fail",
                imageName,
                musicName,
                soundName
            );
        }

        return null;
    }

    private getCritResourcesText(parameter: any): string {
        if (!parameter || !parameter.critResources) {
            return "";
        }

        if (typeof parameter.critResources === "string") {
            return parameter.critResources;
        }

        if (Array.isArray(parameter.critResources)) {
            return parameter.critResources.join("\n");
        }

        return String(parameter.critResources);
    }

    public setQuestLoader(loader: QuestLoader): void {
        this.questLoader = loader;
    }

    public setLocalResourceResolver(resolver: ResourceResolver): void {
        this.localResourceResolver = resolver;
    }


    private normalizeInfluences(rawInfluences: any[]): any[] {
        return (rawInfluences ?? []).map((influence: any) => ({
            influenceType: this.normalizeInfluenceType(influence.influenceType ?? influence.InfluenceType),
            value: influence.value ?? influence.Value ?? 0,
            formula: influence.formula ?? influence.Formula ?? ""
        }));
    }

    private normalizeParamsActions(rawActions: any[]): any[] {
        return (rawActions ?? []).map((action: any) => this.normalizeParamsAction(action));
    }

    private normalizeInfluenceType(value: any): string {
        if (typeof value === "number") {
            return ["Units", "Percent", "Value", "Formula"][value] ?? "Units";
        }

        return value ?? "Units";
    }

    private normalizeParamsAction(value: any): string {
        if (typeof value === "number") {
            return ["Hide", "Show", "Ignore"][value] ?? "Ignore";
        }

        return value ?? "Ignore";
    }

    private normalizeLocationType(value: any): string {
        if (typeof value === "number") {
            return ["Neutral", "Start", "Victory", "Fail", "Empty"][value] ?? "Neutral";
        }

        return value ?? "Neutral";
    }

    private normalizeParamType(value: any): string {
        if (typeof value === "number") {
            return ["Usual", "Successful", "Failed"][value] ?? "Usual";
        }

        return value ?? "Usual";
    }

    private normalizeNecessaryRanges(rawRanges: any[]): any[] {
        return (rawRanges ?? []).map((range: any) => ({
            isOn: range.isOn ?? range.IsOn ?? false,
            min: range.min ?? range.Min ?? 0,
            max: range.max ?? range.Max ?? 0
        }));
    }

    private normalizeTakenValues(rawValues: any[]): any[] {
        return (rawValues ?? []).map((value: any) => ({
            nonTaken: value.nonTaken ?? value.NonTaken ?? false,
            formula: value.formula ?? value.Formula ?? ""
        }));
    }

    private normalizeMultipleValues(rawValues: any[]): any[] {
        return (rawValues ?? []).map((value: any) => ({
            nonMultiple: value.nonMultiple ?? value.NonMultiple ?? false,
            formula: value.formula ?? value.Formula ?? ""
        }));
    }

    private normalizeQuest(raw: any): Quest {
        raw.questName = raw.questName ?? raw.QuestName;
        raw.displayName = raw.displayName ?? raw.DisplayName;
        raw.description = raw.description ?? raw.Description ?? raw.descrition ?? raw.Descrition;
        raw.lang = raw.lang ?? raw.Lang;
        raw.startImage = raw.startImage ?? raw.StartImage;
        raw.startMusic = raw.startMusic ?? raw.StartMusic;

        raw.locations = raw.locations ?? raw.Locations ?? [];
        raw.passages = raw.passages ?? raw.Passages ?? [];
        raw.parameters = raw.parameters ?? raw.Parameters ?? [];

        raw.locations = raw.locations.map((l: any) => ({
            ...l,
            id: l.id ?? l.Id,
            passability: l.passability ?? l.Passability ?? 0,
            visitCounter: l.visitCounter ?? l.VisitCounter ?? 0,
            influences: this.normalizeInfluences(l.influences ?? l.Influences ?? []),
            paramsActions: this.normalizeParamsActions(l.paramsActions ?? l.ParamsActions ?? []),
            locationType: this.normalizeLocationType(l.locationType ?? l.LocationType),
            descriptions: l.descriptions ?? l.Descriptions ?? [],
            firstInPair: l.firstInPair ?? l.FirstInPair ?? [],
            chooseWithFormula: l.chooseWithFormula ?? l.ChooseWithFormula ?? false,
            formula: l.formula ?? l.Formula ?? "",
            gridX: l.gridX ?? l.GridX ?? 0,
            gridY: l.gridY ?? l.GridY ?? 0
        }));

        raw.passages = raw.passages.map((p: any) => ({
            id: p.id ?? p.Id,
            passability: p.passability ?? p.Passability ?? 0,
            from: p.from ?? p.From,
            to: p.to ?? p.To,
            same: p.same ?? p.Same ?? false,
            question: p.question ?? p.Question ?? "",
            description: p.description ?? p.Description ?? "",
            logicalCondition: p.logicalCondition ?? p.LogicalCondition ?? "",
            priority: p.priority ?? p.Priority ?? 0,
            displayOrder: p.displayOrder ?? p.DisplayOrder ?? 0,
            alwaysShow: p.alwaysShow ?? p.AlwaysShow ?? false,
            ignoreDemonstration: p.ignoreDemonstration ?? p.IgnoreDemonstration ?? false,
            visitCounter: p.visitCounter ?? p.VisitCounter ?? 0,
            influences: this.normalizeInfluences(p.influences ?? p.Influences ?? []),
            paramsActions: this.normalizeParamsActions(p.paramsActions ?? p.ParamsActions ?? []),
            necessaryRanges: this.normalizeNecessaryRanges(p.necessaryRanges ?? p.NecessaryRanges ?? []),
            takenValues: this.normalizeTakenValues(p.takenValues ?? p.TakenValues ?? []),
            multipleValues: this.normalizeMultipleValues(p.multipleValues ?? p.MultipleValues ?? [])
        }));

        raw.parameters = raw.parameters.map((p: any) => ({
            index: p.index ?? p.Index,
            workingName: p.workingName ?? p.WorkingName ?? "",
            displayName: p.displayName ?? p.DisplayName ?? "",
            paramType: this.normalizeParamType(p.paramType ?? p.ParamType),
            value: p.value ?? p.Value ?? 0,
            startValue: p.startValue ?? p.StartValue ?? 0,
            minValue: p.minValue ?? p.MinValue ?? 0,
            maxValue: p.maxValue ?? p.MaxValue ?? 100,
            isActive: p.isActive ?? p.IsActive ?? true,
            isHidden: p.isHidden ?? p.IsHidden ?? false,
            isCriticMax: p.isCriticMax ?? p.IsCriticMax ?? false,
            criticText: p.criticText ?? p.CriticText ?? "",
            critResources: p.critResources ?? p.CritResources ?? "",
            paramsRanges: (p.paramsRanges ?? p.ParamsRanges ?? []).map((r: any) => ({
                min: r.min ?? r.Min ?? 0,
                max: r.max ?? r.Max ?? 0,
                output: r.output ?? r.Output ?? ""
            }))
        }));

        // console.log("Normalized quest:", {
        //     locations: raw.locations.length,
        //     passages: raw.passages.length,
        //     parameters: raw.parameters.length,
        //     firstPassage: raw.passages[0],
        //     firstParameter: raw.parameters[0],
        //     firstRange: raw.parameters[0]?.paramsRanges?.[0]
        // });

        return raw as Quest;
    }

    returnToMenu(): void {
        this.mode = GameMode.Menu;
        this.quest = null;
        this.currentLocation = null;
        this.singlePassage = null;
        this.passageResolver = null;
        this.textParser = null;
    }
}