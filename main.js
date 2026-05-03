const { app, BrowserWindow } = require("electron");

function createWindow() {
    const win = new BrowserWindow({
        width: 1400,
        height: 850,
        minWidth: 1100,
        minHeight: 700,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false
        }
    });

    win.maximize();
    win.loadFile("index.html");

    //debug
    // win.webContents.openDevTools();
}

app.whenReady().then(() => {
    createWindow();
});

app.on("window-all-closed", () => {
    if (process.platform !== "darwin") {
        app.quit();
    }
});

app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
    }
});