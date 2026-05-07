const { SaveLoadManager } = require("./SaveLoadManager");

class QuestRepository {
    constructor(audioManager = null) {
        this.saveLoadManager = new SaveLoadManager();
        this.audioManager = audioManager;
    }

    findLocalQuests() {
        return this.saveLoadManager.findQuestFolders();
    }

    async loadQuest(questShort, source) {
        if (source === "remote") {
            return null;
        }

        const loadedQuest = this.saveLoadManager.loadLocalQuest(questShort);

        if (this.audioManager) {
            this.audioManager.setQuestFolder(
                this.saveLoadManager.getLocalQuestFolder(questShort.questName)
            );
        }

        return loadedQuest;
    }

    resolveLocalResourceUrl(selectedQuest, folderName, resourceName, extensions) {
        return this.saveLoadManager.resolveLocalResourceUrl(
            selectedQuest,
            folderName,
            resourceName,
            extensions
        );
    }
}

module.exports = { QuestRepository };
