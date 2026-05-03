const fs = require("fs");
const path = require("path");
const { pathToFileURL } = require("url");

class AudioManager {
    constructor() {
        this.musicFadeDuration = 0.5;
        this.defaultMusicVolume = 0.1;
        this.defaultSfxVolume = 0.25;

        this.currentMusicName = null;
        this.currentQuestFolder = null;

        this.globalSoundsFolder = path.join(__dirname, "_Sounds");

        this.activeMusic = new Audio();
        this.inactiveMusic = new Audio();

        this.activeMusic.loop = true;
        this.inactiveMusic.loop = true;

        this.activeMusic.volume = 0;
        this.inactiveMusic.volume = 0;

        this.fadeTimer = null;

        this.audioExtensions = [
            ".ogg",
            ".mp3",
            ".wav",
            ".aif",
            ".aiff"
        ];
    }

    setQuestFolder(folderPath) {
        this.currentQuestFolder = folderPath;
    }

    getCurrentMusicName() {
        return this.currentMusicName;
    }

    playMusic(musicName, stoppable = true) {
        if (!musicName) {
            if (stoppable) {
                this.stopMusic();
            }

            return;
        }

        if (!this.activeMusic.paused && this.currentMusicName === musicName) {
            return;
        }

        const audioPath = this.findQuestAudioPath("Musics", musicName);

        if (!audioPath) {
            console.warn("Music not found:", musicName);

            if (stoppable) {
                this.stopMusic();
            }

            return;
        }

        this.crossfadeToMusic(audioPath, musicName);
    }

    playSfx(sfxName) {
        this.playQuestSfx(sfxName);
    }

    playQuestSfx(sfxName) {
        if (!sfxName) {
            return;
        }

        const audioPath = this.findQuestAudioPath("Sounds", sfxName);

        if (!audioPath) {
            console.warn("Quest SFX not found:", sfxName);
            return;
        }

        this.playAudioOnce(audioPath, this.defaultSfxVolume);
    }

    playClick() {
        this.playGlobalSfx("click", 0.4);
    }

    playHover() {
        this.playGlobalSfx("hover", 0.6);
    }

    playGlobalSfx(sfxName, volume = 1.0) {
        if (!sfxName) {
            return;
        }

        const audioPath = this.findAudioPathInFolder(this.globalSoundsFolder, sfxName);

        if (!audioPath) {
            console.warn("Global SFX not found:", sfxName);
            return;
        }

        this.playAudioOnce(audioPath, this.defaultSfxVolume * volume);
    }

    playAudioOnce(audioPath, volume) {
        const audio = new Audio(pathToFileURL(audioPath).href);
        audio.volume = volume;

        audio.play().catch(error => {
            console.warn("Failed to play audio:", audioPath, error);
        });
    }

    stopSfx() {
        // One-shot HTML Audio objects stop naturally.
    }

    stopMusic() {
        this.clearFade();

        const source = this.activeMusic;
        const startVolume = source.volume;

        this.fadeVolume(
            source,
            startVolume,
            0,
            this.musicFadeDuration,
            () => {
                source.pause();
                source.removeAttribute("src");
                source.load();
                this.currentMusicName = null;
            }
        );

        this.inactiveMusic.pause();
        this.inactiveMusic.removeAttribute("src");
        this.inactiveMusic.load();
        this.inactiveMusic.volume = 0;
    }

    crossfadeToMusic(audioPath, musicName) {
        this.clearFade();

        const newUrl = pathToFileURL(audioPath).href;

        if (this.activeMusic.src === newUrl && !this.activeMusic.paused) {
            this.currentMusicName = musicName;
            return;
        }

        this.inactiveMusic.pause();
        this.inactiveMusic.src = newUrl;
        this.inactiveMusic.loop = true;
        this.inactiveMusic.volume = 0;
        this.inactiveMusic.currentTime = 0;

        this.inactiveMusic.play().catch(error => {
            console.warn("Failed to play music:", musicName, error);
        });

        const oldMusic = this.activeMusic;
        const newMusic = this.inactiveMusic;

        const oldStartVolume = oldMusic.paused ? 0 : oldMusic.volume;

        this.crossfade(
            oldMusic,
            newMusic,
            oldStartVolume,
            this.defaultMusicVolume,
            this.musicFadeDuration,
            () => {
                oldMusic.pause();
                oldMusic.removeAttribute("src");
                oldMusic.load();
                oldMusic.volume = 0;

                newMusic.volume = this.defaultMusicVolume;

                this.swapMusicSources();
                this.currentMusicName = musicName;
            }
        );
    }

    crossfade(oldMusic, newMusic, oldFrom, newTo, duration, onComplete) {
        if (duration <= 0) {
            oldMusic.volume = 0;
            newMusic.volume = newTo;
            onComplete?.();
            return;
        }

        const startTime = performance.now();

        this.fadeTimer = setInterval(() => {
            const elapsed = (performance.now() - startTime) / 1000;
            const t = Math.min(elapsed / duration, 1);

            oldMusic.volume = oldFrom * (1 - t);
            newMusic.volume = newTo * t;

            if (t >= 1) {
                this.clearFade();
                onComplete?.();
            }
        }, 16);
    }

    fadeVolume(audio, from, to, duration, onComplete) {
        if (duration <= 0) {
            audio.volume = to;
            onComplete?.();
            return;
        }

        const startTime = performance.now();

        this.fadeTimer = setInterval(() => {
            const elapsed = (performance.now() - startTime) / 1000;
            const t = Math.min(elapsed / duration, 1);

            audio.volume = from + (to - from) * t;

            if (t >= 1) {
                this.clearFade();
                onComplete?.();
            }
        }, 16);
    }

    clearFade() {
        if (this.fadeTimer) {
            clearInterval(this.fadeTimer);
            this.fadeTimer = null;
        }
    }

    swapMusicSources() {
        const temp = this.activeMusic;
        this.activeMusic = this.inactiveMusic;
        this.inactiveMusic = temp;
    }

    findQuestAudioPath(folderName, audioName) {
        if (!this.currentQuestFolder || !audioName) {
            return null;
        }

        const folderPath = path.join(this.currentQuestFolder, folderName);

        return this.findAudioPathInFolder(folderPath, audioName);
    }

    findAudioPathInFolder(folderPath, audioName) {
        if (!folderPath || !audioName || !fs.existsSync(folderPath)) {
            return null;
        }

        const cleanName = audioName.trim();
        const nameWithoutExtension = path.parse(cleanName).name;
        const extension = path.extname(cleanName);

        if (extension) {
            const directPath = path.join(folderPath, cleanName);

            if (fs.existsSync(directPath)) {
                return directPath;
            }
        }

        for (const ext of this.audioExtensions) {
            const fullPath = path.join(folderPath, nameWithoutExtension + ext);

            if (fs.existsSync(fullPath)) {
                return fullPath;
            }
        }

        return null;
    }

    clearAll() {
        this.stopMusic();
        this.stopSfx();
    }
}

module.exports = {
    AudioManager
};