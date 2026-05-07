// src/api/ApiManager.ts

const BASE_URI = "https://questapi-a9pu.onrender.com";

export class ApiManager {
    private static readonly getAllQuestsUri = `${BASE_URI}/quests`;
    private static readonly getQuestUri = `${BASE_URI}/quest`;

    static async getAllQuests(): Promise<string> {
        return await this.getText(this.getAllQuestsUri);
    }

    static async getQuest(id: number): Promise<string> {
        return await this.getText(`${this.getQuestUri}/${id}`);
    }

    private static async getText(requestUri: string): Promise<string> {
        const response = await fetch(requestUri);

        if (!response.ok) {
            const serverMessage = await response.text();
            throw new Error(
                serverMessage || `HTTP error. Code: ${response.status}, Uri: ${requestUri}`
            );
        }

        return await response.text();
    }

    static async downloadQuestPackage(id: number): Promise<ArrayBuffer> {
        const response = await fetch(`${this.getQuestUri}/${id}/package`);

        if (!response.ok) {
            const serverMessage = await response.text();
            throw new Error(
                serverMessage || `HTTP error. Code: ${response.status}, Uri: ${this.getQuestUri}/${id}/package`
            );
        }

        return await response.arrayBuffer();
    }

    static getQuestPreviewImageUrl(id: number): string {
        return `${this.getQuestUri}/${id}/preview-image`;
    }
}