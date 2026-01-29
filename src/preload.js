const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    startScan: (range) => ipcRenderer.send('scan:start', range),
    stopScan: () => ipcRenderer.send('scan:stop'),
    onScanProgress: (callback) => ipcRenderer.on('scan:progress', (event, result) => callback(result)),
    onScanComplete: (callback) => ipcRenderer.on('scan:complete', (event) => callback()),
    onStartScan: (callback) => ipcRenderer.on('scan:start', (event, data) => callback(data)),
    onScanInitiate: (callback) => ipcRenderer.on('scan:initiate', (event, ip) => callback(ip)),
    onScanError: (callback) => ipcRenderer.on('scan:error', (event, message) => callback(message)),

    // Data persistence
    getKnownDevices: () => ipcRenderer.invoke('data:get-known'),
    addKnownDevice: (device) => ipcRenderer.invoke('data:add-known', device),
    removeKnownDevice: (ip) => ipcRenderer.invoke('data:remove-known', ip),

    // Locations
    getLocations: () => ipcRenderer.invoke('data:get-locations'),
    getCurrentLocation: () => ipcRenderer.invoke('data:get-current-location'),
    addLocation: (data) => ipcRenderer.invoke('data:add-location', data), // { name, range }
    removeLocation: (id) => ipcRenderer.invoke('data:remove-location', id),
    setCurrentLocation: (id) => ipcRenderer.invoke('data:set-current-location', id),
    getLocationDetails: (id) => ipcRenderer.invoke('data:get-location-details', id),
    updateLocation: (data) => ipcRenderer.invoke('data:update-location', data), // { id, name, range }
    removeKnownDeviceFromLocation: (data) => ipcRenderer.invoke('data:remove-known-from-location', data), // { locationId, ip }

    // Dialogs
    showMessageBox: (options) => ipcRenderer.invoke('dialog:showMessageBox', options)
});
