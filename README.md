[English](README.md)

# Quest Reader Electron

![Framework](https://img.shields.io/badge/framework-Electron-47848F?logo=electron&logoColor=white)
![Language](https://img.shields.io/badge/language-TypeScript-blue)
![Data](https://img.shields.io/badge/data-JSON-orange)
![License](https://img.shields.io/badge/license-MIT-green)

A desktop Electron application for running branching narrative quests with parameters, choices, images, music, and sound effects.

Inspired by the mechanics of the classic game **Space Rangers**.

This project uses a data-driven quest system with JSON content, branching logic, parameters, multimedia support, and desktop-friendly controls.

Together with the [Text Quest Editor](https://github.com/albruevich/Text-Quest-Editor), it forms a complete toolchain for creating and playing custom text quests.

---

## Demo

<img src="docs/screen_1.webp" width="700">

---

## About the Project

The project is written in **TypeScript**, running inside **Electron**.

It was designed as a standalone desktop application for interactive text quests with a flexible data-driven architecture.

The project can be used:

- to play included quests such as **Asteroid Station**
- to test quests created in the Text Quest Editor
- as a base for your own desktop narrative reader
- as an example of porting gameplay systems across technologies

---

## Features

- Branching quest progression
- Parameters / stats system
- Conditional transitions
- Images with fade transitions
- Sound effects and background music
- Keyboard navigation
- Animated text output
- Multi-language quests
- JSON-based content pipeline

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

- `quest.json` — main quest file (logic + data)
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

## Quick Test

After launch:

1. Select a quest  
2. Press **Start Selected Quest**  
3. Play using mouse or keyboard:

- `↑ / ↓` — navigate choices
- `Enter` — confirm
- `Esc` — leave current quest

---

## Why This Project Matters

This repository demonstrates practical skills beyond a single engine:

- Porting logic from C# to TypeScript
- Desktop application development
- Working with local file systems
- Data-driven architecture
- UI/UX adaptation across platforms
- Multimedia integration
- Cross-stack engineering mindset

---

## Related Projects

### Unity Version

[Text Quest Reader (Unity)](https://github.com/albruevich/Text-Quest-Reader)

### Quest Creation Tool

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