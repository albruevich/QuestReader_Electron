const fs = require("fs");
const path = require("path");
const { pathToFileURL } = require("url");

class SaveLoadManager {

    constructor() {
        this.localQuestPaths = new Map();
        this.QUESTS_FOLDER = path.join(__dirname, "_Quests");
    }

    ensureQuestsFolderExists() {
        if (!fs.existsSync(this.QUESTS_FOLDER)) {
            fs.mkdirSync(this.QUESTS_FOLDER, { recursive: true });
        }
    }

    findQuestFolders() {
        this.ensureQuestsFolderExists();

        this.localQuestPaths.clear();

        const result = [];
        const entries = fs.readdirSync(this.QUESTS_FOLDER, { withFileTypes: true });

        for (const entry of entries) {
            if (!entry.isDirectory()) {
                continue;
            }

            const questFolderPath = path.join(this.QUESTS_FOLDER, entry.name);
            const questJsonPath = path.join(questFolderPath, "quest.json");

            if (!fs.existsSync(questJsonPath)) {
                continue;
            }

            let questJson = null;
            let displayName = entry.name;
            let description = "";
            let startImage = "";
            let order = 0;
            let lang = "en";

            try {
                const json = fs.readFileSync(questJsonPath, "utf8");
                questJson = JSON.parse(json);

                displayName =
                    questJson.displayName ||
                    questJson.questName ||
                    entry.name;

                description =
                    questJson.description ||
                    questJson.descrition ||
                    "";

                startImage = questJson.startImage || "";
                order = Number(questJson.order || 0);
                lang = questJson.lang || "en";
            }
            catch (error) {
                console.warn("Invalid quest.json:", questJsonPath, error);
            }

            const questName = questJson?.questName || entry.name;

            result.push({
                id: 0,
                ownerUserId: 0,
                questName,
                displayName,
                description,
                startMusic: questJson?.startMusic || "",
                startImage,
                order,
                lang,
                author: ""
            });

            this.localQuestPaths.set(questName, {
                folderPath: questFolderPath,
                questJsonPath
            });
        }

        result.sort((a, b) => {
            if (a.order !== b.order) {
                return a.order - b.order;
            }

            return a.displayName.localeCompare(b.displayName);
        });

        return result;
    }

    loadLocalQuest(questShort) {
        const localPath = this.localQuestPaths.get(questShort.questName);

        if (!localPath) {
            throw new Error(`Local quest path not found: ${questShort.questName}`);
        }

        const json = fs.readFileSync(localPath.questJsonPath, "utf8");

        return JSON.parse(json);
    }

    getLocalQuestFolder(questName) {
        const localPath = this.localQuestPaths.get(questName);

        if (!localPath) {
            return null;
        }

        return localPath.folderPath;
    }

    resolveLocalResourceUrl(questShort, folderName, resourceName, extensions) {
        const resourcePath = this.findLocalResourcePath(
            questShort,
            folderName,
            resourceName,
            extensions
        );

        if (!resourcePath) {
            return null;
        }

        return pathToFileURL(resourcePath).href;
    }

    findLocalResourcePath(questShort, folderName, resourceName, extensions) {
        if (!questShort || !resourceName) {
            return null;
        }

        const localPath = this.localQuestPaths.get(questShort.questName);

        if (!localPath) {
            return null;
        }

        const folderPath = path.join(localPath.folderPath, folderName);
        const cleanName = resourceName.trim();

        if (!fs.existsSync(folderPath)) {
            return null;
        }

        if (path.extname(cleanName) !== "") {
            const directPath = path.join(folderPath, cleanName);
            return fs.existsSync(directPath) ? directPath : null;
        }

        for (const extension of extensions) {
            const candidate = path.join(folderPath, cleanName + extension);

            if (fs.existsSync(candidate)) {
                return candidate;
            }
        }

        return null;
    }
}

module.exports = {
    SaveLoadManager
};
