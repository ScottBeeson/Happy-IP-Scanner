const fs = require('fs');
const path = require('path');
const { app } = require('electron');
const { log } = require('./logger');
const crypto = require('crypto');

class Store {
    constructor(opts) {
        // Renderer process has to get `app` behavior via remote or IPC, but here we are in main.
        const userDataPath = app.getPath('userData');
        this.path = path.join(userDataPath, opts.configName + '.json');

        log(`Store initialized at ${this.path}`);

        this.data = this.parseDataFile(this.path, opts.defaults);
        this.migrate();
    }

    parseDataFile(filePath, defaults) {
        try {
            return JSON.parse(fs.readFileSync(filePath));
        } catch (error) {
            log(`Error reading store file (creating new): ${error.message}`);
            return defaults;
        }
    }

    migrate() {
        // Migration: If we have 'knownDevices' at root but no 'locations', migrate to Default location
        if (this.data.knownDevices && !this.data.locations) {
            log('Migrating store to Locations schema...');
            const defaultId = crypto.randomUUID();
            const defaultLocation = {
                id: defaultId,
                name: 'Default',
                range: '192.168.1.0/24', // Default range
                knownDevices: this.data.knownDevices
            };

            this.data = {
                locations: [defaultLocation],
                currentLocationId: defaultId
            };
            this.save();
        }

        // Ensure we always have at least one location
        if (!this.data.locations || this.data.locations.length === 0) {
            const defaultId = crypto.randomUUID();
            this.data.locations = [{
                id: defaultId,
                name: 'Default',
                range: '192.168.1.0/24',
                knownDevices: {}
            }];
            this.data.currentLocationId = defaultId;
            this.save();
        }
    }

    save() {
        try {
            fs.writeFileSync(this.path, JSON.stringify(this.data, null, 4));
        } catch (error) {
            log(`Error writing to store file: ${error.message}`);
        }
    }

    get(key) {
        return this.data[key];
    }

    set(key, val) {
        this.data[key] = val;
        this.save();
    }

    // -- Location Management --

    getLocations() {
        return this.data.locations.map(loc => ({
            id: loc.id,
            name: loc.name,
            range: loc.range
        }));
    }

    getCurrentLocationId() {
        return this.data.currentLocationId;
    }

    getCurrentLocation() {
        return this.data.locations.find(l => l.id === this.data.currentLocationId) || this.data.locations[0];
    }

    setCurrentLocation(id) {
        if (this.data.locations.find(l => l.id === id)) {
            this.data.currentLocationId = id;
            this.save();
            return true;
        }
        return false;
    }

    addLocation(name, range) {
        const newLocation = {
            id: crypto.randomUUID(),
            name,
            range,
            knownDevices: {}
        };
        this.data.locations.push(newLocation);
        this.data.currentLocationId = newLocation.id; // Auto-switch to new location
        this.save();
        return newLocation;
    }

    removeLocation(id) {
        // Prevent deleting the last location
        if (this.data.locations.length <= 1) return false;

        this.data.locations = this.data.locations.filter(l => l.id !== id);

        // If we deleted the current location, switch to the first one
        if (this.data.currentLocationId === id) {
            this.data.currentLocationId = this.data.locations[0].id;
        }
        this.save();
        return true;
    }

    getLocation(id) {
        return this.data.locations.find(l => l.id === id);
    }

    updateLocation(id, { name, range }) {
        const loc = this.data.locations.find(l => l.id === id);
        if (loc) {
            if (name) loc.name = name;
            if (range) loc.range = range;
            this.save();
            return true;
        }
        return false;
    }

    updateLocationRange(id, range) {
        return this.updateLocation(id, { range });
    }

    // -- Device Management (Scoped to Current Location) --

    getKnownDevices() {
        const loc = this.getCurrentLocation();
        return loc ? (loc.knownDevices || {}) : {};
    }

    addKnownDevice(ip, hostname = '', name = null) {
        const loc = this.getCurrentLocation();
        if (loc) {
            const existing = loc.knownDevices[ip] || {};
            // If name is explicitly null (not provided), try to keep existing name
            // If name is provided (string), use it.
            // Note: In Javascript, default args only trigger on undefined. 
            // We'll pass name as part of the update.

            const finalName = name !== null ? name : (existing.name || '');

            loc.knownDevices[ip] = {
                ip,
                hostname: hostname || existing.hostname || '',
                name: finalName,
                timestamp: Date.now()
            };
            this.save();
        }
    }

    removeKnownDevice(ip) {
        const loc = this.getCurrentLocation();
        if (loc && loc.knownDevices[ip]) {
            delete loc.knownDevices[ip];
            this.save();
        }
    }

    removeKnownDeviceFromLocation(locationId, ip) {
        const loc = this.getLocation(locationId);
        if (loc && loc.knownDevices && loc.knownDevices[ip]) {
            delete loc.knownDevices[ip];
            this.save();
            return true;
        }
        return false;
    }

    isKnown(ip) {
        const devices = this.getKnownDevices();
        return Object.prototype.hasOwnProperty.call(devices, ip);
    }
    // -- Window Management --

    getWindowBounds() {
        return this.data.windowBounds;
    }

    setWindowBounds(bounds) {
        this.data.windowBounds = bounds;
        this.save();
    }
}

// Singleton instance
const store = new Store({
    configName: 'user-preferences',
    defaults: {
        locations: [], // Will be populated by migrate() if empty
        currentLocationId: null,
        windowBounds: null
    }
});

module.exports = store;
