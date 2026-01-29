const { app, BrowserWindow, screen } = require('electron');
const path = require('path');

const setupIpcHandlers = require('./ipcHandlers');
const store = require('./store');

function createWindow() {
    let windowOptions = {
        width: 800,
        height: 600,
        webPreferences: {
            preload: path.join(__dirname, '../preload.js'),
            nodeIntegration: false,
            contextIsolation: true
        }
    };

    const savedBounds = store.getWindowBounds();
    if (savedBounds) {
        // Validate that the saved position is visible on some display
        const display = screen.getDisplayMatching(savedBounds);
        const bounds = display.bounds;

        // Simple check: Is the top-left corner within the display bounds?
        const isVisible = (
            savedBounds.x >= bounds.x &&
            savedBounds.x < bounds.x + bounds.width &&
            savedBounds.y >= bounds.y &&
            savedBounds.y < bounds.y + bounds.height
        );

        if (isVisible) {
            windowOptions = { ...windowOptions, ...savedBounds };
        }
    }

    const win = new BrowserWindow(windowOptions);

    if (savedBounds && savedBounds.isMaximized) {
        win.maximize();
    }

    setupIpcHandlers(win);

    win.loadFile(path.join(__dirname, '../renderer/index.html'));
    console.log('Window loaded');

    win.on('close', () => {
        const isMaximized = win.isMaximized();
        const bounds = isMaximized ? win.getNormalBounds() : win.getBounds();
        store.setWindowBounds({ ...bounds, isMaximized });
    });
}

app.whenReady().then(() => {
    console.log('App ready');
    createWindow();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});
