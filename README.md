[English](README.md)

# Quest Reader Electron

![Framework](https://img.shields.io/badge/framework-Electron-47848F?logo=electron&logoColor=white)
![Language](https://img.shields.io/badge/language-TypeScript-blue)
![Data](https://img.shields.io/badge/data-JSON-orange)
![License](https://img.shields.io/badge/license-MIT-green)

A desktop Electron application for running branching narrative quests with parameters, choices, images, music, and sound effects.

Inspired by the mechanics of the classic game **Space Rangers**.

Together with the [Text Quest Editor](https://github.com/albruevich/Text-Quest-Editor), it forms a complete toolchain for creating and playing custom text quests.

---

## Demo

<img src="docs/screen_1.webp" width="700">

---

## About the Project

The project is written in **TypeScript** and built with **Electron**.

It is a standalone desktop application for interactive text quests with a flexible JSON-driven architecture.

Use cases:

- play included quests such as **Asteroid Station**
- test quests created in the Text Quest Editor
- use as a base for your own narrative reader

---

## Features

- Branching quest structure with multiple outcomes
- Parameters affecting progression and choices
- Conditional transitions based on quest logic
- Images, sound effects, and background music
- Keyboard and mouse navigation
- JSON-based quest content system

---

## Quest Structure

Each quest is stored as a separate folder inside:

```text
_Quests/
```

Example:

```text
_Quests/
  AsteroidStation/
    quest.json
    Images/
    Sounds/
    Musics/
```

### Contents

- `quest.json` — main quest file
- `Images/` — optional images
- `Sounds/` — optional sound effects
- `Musics/` — optional music

The reader automatically detects all valid quest folders.

---

## How to Run

### From Source

```bash
npm install
npm start
```

---

## Controls

- `↑ / ↓` — navigate choices
- `Enter` — confirm
- `Esc` — leave current quest

---

## Technical Highlights

- Electron desktop application
- TypeScript project structure
- JSON-driven content architecture
- Local file system resource loading
- Multimedia integration
- Modular quest logic

---

## Related Projects

[Text Quest Reader (Unity)](https://github.com/albruevich/Text-Quest-Reader)

[Text Quest Editor](https://github.com/albruevich/Text-Quest-Editor)

---

## Requirements

- Node.js
- npm

---

## Assets

Some images in this project were generated using AI tools.

Sound effects and music may include royalty-free sources such as Pixabay.

---

## License

MIT License

---

## Author

Alexander Bruiaka

GitHub: https://github.com/albruevich
