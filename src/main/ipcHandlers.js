const { ipcMain, dialog } = require('electron');
const scanner = require('./scanner');
const { log } = require('./logger');
const store = require('./store');

function setupIpcHandlers(window) {
    log('Setting up IPC handlers');

    // -- Dialog handler --
    ipcMain.handle('dialog:showMessageBox', async (event, options) => {
        return dialog.showMessageBox(window, options);
    });

    // -- Data Persistence handlers --
    ipcMain.handle('data:get-known', async () => {
        return store.getKnownDevices();
    });

    ipcMain.handle('data:add-known', async (event, device) => {
        store.addKnownDevice(device.ip, device.hostname, device.name);
        return true;
    });

    ipcMain.handle('data:remove-known', async (event, ip) => {
        store.removeKnownDevice(ip);
        return true;
    });

    // -- Location handlers --
    ipcMain.handle('data:get-locations', async () => {
        return store.getLocations();
    });

    ipcMain.handle('data:get-current-location', async () => {
        return store.getCurrentLocation();
    });

    ipcMain.handle('data:add-location', async (event, { name, range }) => {
        return store.addLocation(name, range);
    });

    ipcMain.handle('data:remove-location', async (event, id) => {
        return store.removeLocation(id);
    });

    ipcMain.handle('data:remove-known-from-location', async (event, { locationId, ip }) => {
        return store.removeKnownDeviceFromLocation(locationId, ip);
    });

    ipcMain.handle('data:set-current-location', async (event, id) => {
        return store.setCurrentLocation(id);
    });

    ipcMain.handle('data:get-location-details', async (event, id) => {
        return store.getLocation(id);
    });

    ipcMain.handle('data:update-location', async (event, { id, name, range }) => {
        return store.updateLocation(id, { name, range });
    });

    // -- Scanning handlers --
    ipcMain.on('scan:start', async (event, args) => {
        log(`Received scan:start with args: ${JSON.stringify(args)}`);

        if (scanner.isScanning) {
            scanner.cancelScan();
        }

        if (typeof args === 'object' && args.startIP && args.endIP) {
            scanner.scanRange(args.startIP, args.endIP);
        } else if (typeof args === 'string') {
            scanner.scanRange(args);
        } else {
            if (!window.isDestroyed()) {
                window.webContents.send('scan:error', 'Invalid arguments');
            }
        }
    });

    ipcMain.on('scan:stop', () => {
        log('Received scan:stop');
        scanner.cancelScan();
    });

    // Forward scanner events to the renderer window
    scanner.on('scan:start', (data) => {
        log(`Scanner emitted scan:start. Total: ${data.total}`);
        if (!window.isDestroyed()) {
            window.webContents.send('scan:start', data);
        }
    });

    scanner.on('scan:initiate', (ip) => {
        if (!window.isDestroyed()) {
            const isKnown = store.isKnown(ip);
            window.webContents.send('scan:initiate', { ip, isKnown });
        }
    });

    scanner.on('scan:result', (result) => {
        if (!window.isDestroyed()) {
            const isKnown = store.isKnown(result.ip);
            // Update store if hostname changed for a known device? 
            // Optional: Auto-update hostname if known.
            if (isKnown && result.hostname && result.hostname !== store.getKnownDevices()[result.ip]?.hostname) {
                store.addKnownDevice(result.ip, result.hostname);
            }

            window.webContents.send('scan:progress', { ...result, isKnown });
        }
    });

    scanner.on('scan:complete', (results) => {
        log(`Scanner emitted scan:complete. Count: ${results.length}`);
        if (!window.isDestroyed()) {
            window.webContents.send('scan:complete', results);
        }
    });

    scanner.on('error', (err) => {
        const msg = (typeof err === 'string') ? err : (err.message || 'Unknown Error');
        log(`Scanner emitted error: ${msg}`);
        if (!window.isDestroyed()) {
            window.webContents.send('scan:error', msg);
        }
    });
}

module.exports = setupIpcHandlers;
