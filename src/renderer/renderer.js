const ipRangeInput = document.getElementById('ipRangeInput');
const startScanBtn = document.getElementById('startScanBtn');
const resultsBody = document.getElementById('resultsBody');

const progressBar = document.getElementById('progressBar');
const statusText = document.getElementById('statusText');
const showUnknownOnlyToggle = document.getElementById('showUnknownOnly');
const hideOfflineToggle = document.getElementById('hideOffline');

// Location Elements
// Location Elements
const locationSelect = document.getElementById('locationSelect');
const openLocationManagerBtn = document.getElementById('openLocationManagerBtn');
const locationManagerModal = document.getElementById('locationManagerModal');
const closeModalBtn = document.querySelector('.close-modal');

// Manager Elements
const managerSidebarList = document.getElementById('locationList');
const managerAddBtn = document.getElementById('managerAddLocationBtn');
const managerEmptyState = document.getElementById('managerEmptyState');
const managerForm = document.getElementById('managerForm');
const editLocationName = document.getElementById('editLocationName');
const editLocationRange = document.getElementById('editLocationRange');
const knownDevicesList = document.getElementById('knownDevicesList');
const knownCountBadge = document.getElementById('knownCount');
const saveManagerBtn = document.getElementById('saveManagerBtn');
const deleteLocationBtn = document.getElementById('deleteLocationBtn');


let isScanning = false;
let devices = []; // Store simplified device objects
let knownDevicesCache = {}; // Map IP -> Device info
let currentLocationId = null;

// Initialize
init();

async function init() {


    await loadLocations();
    await loadKnownDevices();
}

async function loadLocations() {
    try {
        const locations = await window.electronAPI.getLocations();
        const current = await window.electronAPI.getCurrentLocation();
        currentLocationId = current.id;

        // Update Range Input
        ipRangeInput.value = current.range;

        // Populate Select
        locationSelect.innerHTML = '';
        locations.forEach(loc => {
            const option = document.createElement('option');
            option.value = loc.id;
            option.textContent = loc.name;
            if (loc.id === current.id) option.selected = true;
            locationSelect.appendChild(option);
        });

    } catch (err) {
        console.error('Failed to load locations:', err);
    }
}

async function loadKnownDevices() {
    try {
        // This now returns devices for the CURRENT location from backend
        const known = await window.electronAPI.getKnownDevices();
        knownDevicesCache = known || {};
        console.log('Loaded known devices:', Object.keys(knownDevicesCache).length);

        // If we are not scanning, we might want to show known devices? 
        // Current logic only clears table on start scan. 
        // Maybe we should render known devices initially if we want?
        // For now, let's keep the "Ready to scan..." empty state or just clear list.
        // Actually, user wants to see their "remembered devices... and quickly scan them again".
        // So showing them initially is good.
        renderDeviceList();

    } catch (err) {
        console.error('Failed to load known devices:', err);
    }
}

function renderDeviceList() {
    resultsBody.innerHTML = '';
    devices = []; // Reset current session devices

    // Previously we populated known devices here.
    // Now we only show devices that are actually part of the scan.
    // Known devices will be marked as such via onScanInitiate checks.

    applyFilter();
}


// -- Event Listeners --

locationSelect.addEventListener('change', async (e) => {
    const newId = e.target.value;
    if (newId !== currentLocationId) {
        await window.electronAPI.setCurrentLocation(newId);
        // Refresh everything
        init();
    }
});



// -- Location Manager Logic --

let managerLocations = [];
let currentEditingId = null;

openLocationManagerBtn.addEventListener('click', async () => {
    locationManagerModal.classList.add('visible');
    await refreshManager();
});

closeModalBtn.addEventListener('click', () => {
    locationManagerModal.classList.remove('visible');
});

window.addEventListener('click', (e) => {
    if (e.target === locationManagerModal) {
        locationManagerModal.classList.remove('visible');
    }
});

managerAddBtn.addEventListener('click', () => {
    // Show empty form for new location
    currentEditingId = null;

    // UI Updates
    document.querySelectorAll('.location-list li').forEach(li => li.classList.remove('active'));
    managerEmptyState.style.display = 'none';
    managerForm.style.display = 'flex';
    document.getElementById('editLocationTitle').textContent = 'Create New Location';

    editLocationName.value = '';
    editLocationRange.value = '';

    // New location has no known devices initially
    renderKnownDevicesList([]);

    // Hide delete button for new creation
    deleteLocationBtn.style.display = 'none';
    editLocationName.focus();
});

async function refreshManager() {
    try {
        managerLocations = await window.electronAPI.getLocations();
        renderManagerSidebar();

        // If we were editing something, try to reselet it, else show empty state
        if (currentEditingId) {
            // Check if still exists
            const exists = managerLocations.find(l => l.id === currentEditingId);
            if (exists) {
                await loadLocationDetails(currentEditingId);
            } else {
                showManagerEmptyState();
            }
        } else {
            showManagerEmptyState();
        }
    } catch (err) {
        console.error('Failed to refresh manager:', err);
    }
}

function showManagerEmptyState() {
    currentEditingId = null;
    managerEmptyState.style.display = 'flex';
    managerForm.style.display = 'none';
    document.querySelectorAll('.location-list li').forEach(li => li.classList.remove('active'));
}

function renderManagerSidebar() {
    managerSidebarList.innerHTML = '';
    managerLocations.forEach(loc => {
        const li = document.createElement('li');
        li.textContent = loc.name;
        li.dataset.id = loc.id;
        if (loc.id === currentEditingId) li.classList.add('active');

        li.addEventListener('click', () => {
            loadLocationDetails(loc.id);
        });

        managerSidebarList.appendChild(li);
    });
}

async function loadLocationDetails(id) {
    currentEditingId = id;

    // Update Sidebar Active State
    document.querySelectorAll('.location-list li').forEach(li => {
        li.classList.toggle('active', li.dataset.id === id);
    });

    try {
        const details = await window.electronAPI.getLocationDetails(id); // create this wrapper in renderer or use invoke 'data:get-location-details'
        if (!details) return;

        managerEmptyState.style.display = 'none';
        managerForm.style.display = 'flex';
        document.getElementById('editLocationTitle').textContent = 'Edit Location';
        deleteLocationBtn.style.display = 'block';

        editLocationName.value = details.name;
        editLocationRange.value = details.range;

        // Known Devices
        // details.knownDevices is a map object { ip: {ip, hostname...} }
        const devices = details.knownDevices ? Object.values(details.knownDevices) : [];
        renderKnownDevicesList(devices);

    } catch (err) {
        console.error('Failed to load details:', err);
    }
}

// Helper for dialogs
async function showConfirm(message) {
    const response = await window.electronAPI.showMessageBox({
        type: 'question',
        buttons: ['Yes', 'No'],
        defaultId: 0,
        title: 'Confirm',
        message: message
    });
    return response.response === 0;
}

async function showAlert(message) {
    await window.electronAPI.showMessageBox({
        type: 'info',
        buttons: ['OK'],
        title: 'Alert',
        message: message
    });
}

function renderKnownDevicesList(devices) {
    knownDevicesList.innerHTML = '';
    knownCountBadge.textContent = devices.length;

    if (devices.length === 0) {
        const row = document.createElement('tr');
        row.innerHTML = `<td colspan="4" style="text-align:center; color:#aaa;">No known devices</td>`;
        knownDevicesList.appendChild(row);
        return;
    }

    // Sort by IP?
    devices.forEach(d => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td style="text-align:center;">
                <button class="btn-remove" title="Forget Device">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
                        <path d="M5.5 5.5A.5.5 0 0 1 6 6v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm2.5 0a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm3 .5a.5.5 0 0 0-1 0v6a.5.5 0 0 0 1 0V6z"/>
                        <path fill-rule="evenodd" d="M14.5 3a1 1 0 0 1-1 1H13v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4h-.5a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1H6a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1h3.5a1 1 0 0 1 1 1v1zM4.118 4 4 4.059V13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V4.059L11.882 4H4.118zM2.5 3V2h11v1h-11z"/>
                    </svg>
                </button>
            </td>
            <td>${d.ip}</td>
            <td>
                <div style="display: flex; align-items: center; gap: 5px;">
                    <input type="text" class="name-input" value="${d.name || ''}" placeholder="Note">
                    <button class="save-name-btn" style="display:none; cursor: pointer; background: none; border: none; font-size: 1.2em;" title="Save">💾</button>
                </div>
            </td>
        `;

        const nameInput = row.querySelector('.name-input');
        const saveBtn = row.querySelector('.save-name-btn');

        nameInput.addEventListener('input', () => {
            saveBtn.style.display = 'inline-block';
        });

        nameInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                saveBtn.click();
            }
        });

        saveBtn.addEventListener('click', async () => {
            const newName = nameInput.value;
            // We need to update the known device.
            // Since we are in manager, we know these are known items.
            await window.electronAPI.addKnownDevice({ ip: d.ip, hostname: d.hostname, name: newName });

            // Update cache just in case
            if (knownDevicesCache[d.ip]) {
                knownDevicesCache[d.ip].name = newName;
            }

            saveBtn.style.display = 'none';
        });

        // Remove handler
        row.querySelector('.btn-remove').addEventListener('click', async (e) => {
            if (await showConfirm(`Forget device ${d.ip}?`)) {
                // If we are creating a new location, we can't really remove devices as they don't depend on ID yet.
                // But we only show this list for existing locations or empty for new.
                if (currentEditingId) {
                    await window.electronAPI.removeKnownDeviceFromLocation({ locationId: currentEditingId, ip: d.ip }); // wrapper needed
                    // Reload details to refresh list
                    await loadLocationDetails(currentEditingId);
                }
            }
        });

        knownDevicesList.appendChild(row);
    });
}

saveManagerBtn.addEventListener('click', async () => {
    const name = editLocationName.value.trim();
    const range = editLocationRange.value.trim();

    if (!name || !range) {
        await showAlert('Name and Range are required.');
        return;
    }

    // Basic CIDR validation (very loose)
    if (!range.includes('/') && !range.includes('-')) {
        if (!await showConfirm('Range does not look like a CIDR (e.g. 192.168.1.0/24) or Range (x-y). Save anyway?')) return;
    }


    const originalText = saveManagerBtn.textContent;
    saveManagerBtn.disabled = true;
    saveManagerBtn.textContent = 'Saving...';

    try {
        if (currentEditingId) {
            // Update
            await window.electronAPI.updateLocation({ id: currentEditingId, name, range });
        } else {
            // Create New
            const newLoc = await window.electronAPI.addLocation({ name, range });
            currentEditingId = newLoc.id;
        }

        await refreshManager();
        await loadLocations();

        // Success Feedback
        saveManagerBtn.textContent = 'Saved!';
        saveManagerBtn.classList.remove('btn-primary');
        saveManagerBtn.classList.add('btn-success');

        // Revert after 1.5s
        setTimeout(() => {
            saveManagerBtn.textContent = originalText;
            saveManagerBtn.classList.remove('btn-success');
            saveManagerBtn.classList.add('btn-primary');
            saveManagerBtn.disabled = false;
        }, 1500);

    } catch (err) {
        await showAlert('Failed to save: ' + err.message);
        saveManagerBtn.textContent = originalText;
        saveManagerBtn.disabled = false;
    }
});

deleteLocationBtn.addEventListener('click', async () => {
    if (!currentEditingId) return;

    if (await showConfirm('Are you sure you want to delete this location? check check.')) {
        try {
            const success = await window.electronAPI.removeLocation(currentEditingId);
            if (!success) {
                await showAlert('Could not delete location (must have at least one).');
                return;
            }
            showManagerEmptyState();
            await refreshManager();
            await loadLocations();
        } catch (err) {
            await showAlert('Error deleting: ' + err.message);
        }
    }
});


startScanBtn.addEventListener('click', () => {
    if (isScanning) {
        window.electronAPI.stopScan();
        setScanningState(false);
    } else {
        const range = ipRangeInput.value;

        // We do NOT clear table immediately if we want to keep known devices visible?
        // Actually, typically a new scan refreshes statuses. 
        // Let's reset the status of existing items to 'scanning' or similar, 
        // and remove unknown items from previous scan.

        // Ideally:
        // 1. Keep known devices in list.
        // 2. Remove unknown devices from list.
        // 3. Mark all as "scanning".

        // Simple approach for now: clear if starting fresh, but `renderDeviceList` populates known.
        // So:
        renderDeviceList();

        setScanningState(true);
        window.electronAPI.startScan(range);
    }
});

ipRangeInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
        startScanBtn.click();
    }
});

// Filter Toggle
showUnknownOnlyToggle.addEventListener('change', () => {
    applyFilter();
});

hideOfflineToggle.addEventListener('change', () => {
    applyFilter();
});

function applyFilter() {
    const showUnknownOnly = showUnknownOnlyToggle.checked;
    const hideOffline = hideOfflineToggle.checked;
    const rows = resultsBody.querySelectorAll('tr');

    rows.forEach(row => {
        const isKnown = row.classList.contains('known-device');
        const status = row.dataset.status; // 'active', 'dead', 'scanning', 'unknown'

        let visible = true;

        if (showUnknownOnly && isKnown) {
            visible = false;
        }

        if (hideOffline && status === 'inactive') {
            visible = false;
        }

        row.style.display = visible ? '' : 'none';
    });
}

function setScanningState(scanning) {
    isScanning = scanning;
    startScanBtn.textContent = scanning ? 'Stop Scan' : 'Start Scan';
    startScanBtn.classList.toggle('btn-danger', scanning);
    if (scanning) {
        statusText.textContent = 'Scanning...';
        progressBar.style.width = '5%';

        // Update UI to show scanning state for all rows?
        document.querySelectorAll('.status-dot').forEach(dot => {
            if (!dot.classList.contains('active')) { // Keep active ones? No, re-verify.
                dot.className = 'status-dot scanning';
                dot.title = 'Scanning...';
            }
        });

    } else {
        statusText.textContent = 'Ready';
        progressBar.style.width = '0%';
    }
}

// Listen for errors
window.electronAPI.onScanError((message) => {
    setScanningState(false);
    statusText.textContent = `Error: ${message}`;
    statusText.style.color = 'red';
    showAlert(`Scan Error: ${message}`);
});

// Update status when result comes in
window.electronAPI.onScanProgress((result) => {
    // result now has { ip, status, hostname, isKnown }
    updateDeviceStatus(result);
});

// Add row when scan starts for an IP
window.electronAPI.onScanInitiate((data) => {
    const ip = data.ip || data;
    const isKnown = data.isKnown || knownDevicesCache[ip] !== undefined;

    // Check if row already exists (e.g. it was a known device)
    const safeId = ip.replace(/\./g, '-');
    const existingRow = document.getElementById(`device-${safeId}`);

    if (existingRow) {
        // Just ensure it's marked as scanning, maybe update hostname if available
        return;
    }

    // Only add if not exists
    console.log('Renderer received scan:initiate', ip, isKnown);
    const hostname = (isKnown && knownDevicesCache[ip]?.hostname) ? knownDevicesCache[ip].hostname : '...';
    const name = (isKnown && knownDevicesCache[ip]?.name) ? knownDevicesCache[ip].name : '';

    if (hostname === 'Active') hostname = '';

    const device = { ip, status: 'scanning', hostname, name, isKnown };
    devices.push(device);
    addDeviceRow(device);
});

window.electronAPI.onScanComplete(() => {
    setScanningState(false);
    statusText.textContent = `Scan Complete.`;
    progressBar.style.width = '100%';
});


function addDeviceRow(device) {
    // Avoid duplicates
    const safeId = device.ip.replace(/\./g, '-');
    if (document.getElementById(`device-${safeId}`)) return;

    const row = document.createElement('tr');
    row.id = `device-${safeId}`;

    if (device.isKnown) {
        row.classList.add('known-device');
    }

    // Status class
    let statusClass = 'scanning';
    if (device.status === 'active') statusClass = 'active';
    if (device.status === 'unknown') statusClass = ''; // gray/empty

    row.dataset.status = device.status; // For filtering

    row.innerHTML = `
        <td><div class="status-dot ${statusClass}" title="${device.status}"></div></td>
        <td>${device.ip}</td>
        <td class="hostname-cell" id="hostname-${safeId}">${device.hostname || ''}</td>
        <td>
            <div style="display: flex; align-items: center; gap: 5px;">
                <input type="text" class="name-input" value="${device.name || ''}" placeholder="Note">
                <button class="save-name-btn" style="display:none; cursor: pointer; background: none; border: none; font-size: 1.2em;" title="Save">💾</button>
            </div>
        </td>
        <td>
            <button class="known-toggle ${device.isKnown ? 'is-known' : ''}" title="Mark as Known">★</button>
        </td>
    `;

    const nameInput = row.querySelector('.name-input');
    const saveBtn = row.querySelector('.save-name-btn');

    nameInput.addEventListener('input', () => {
        saveBtn.style.display = 'inline-block';
    });

    nameInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            saveBtn.click();
        }
    });

    saveBtn.addEventListener('click', async () => {
        const newName = nameInput.value;
        let currentHostname = document.getElementById(`hostname-${safeId}`).textContent;
        if (currentHostname === 'Active') currentHostname = '';

        // This implicitly marks as known if not already?
        // User said "implement the name/comment field for 'known' devices".
        // If it's unknown, should saving name mark it as known? 
        // Probably yes, otherwise where do we save it?
        // Let's mark as known.

        await window.electronAPI.addKnownDevice({ ip: device.ip, hostname: currentHostname, name: newName });

        // Update cache
        if (!knownDevicesCache[device.ip]) {
            knownDevicesCache[device.ip] = { ip: device.ip, hostname: currentHostname };
        }
        knownDevicesCache[device.ip].name = newName;
        knownDevicesCache[device.ip].hostname = currentHostname;

        // Update UI state for "Star" button
        const toggleBtn = row.querySelector('.known-toggle');
        toggleBtn.classList.add('is-known');
        row.classList.add('known-device');
        device.isKnown = true;

        saveBtn.style.display = 'none';

        // If filters are on, this might disappear if we are showing unknown only? 
        // Let's apply filter
        applyFilter();
    });

    const toggleBtn = row.querySelector('.known-toggle');
    toggleBtn.addEventListener('click', async () => {
        const wasKnown = toggleBtn.classList.contains('is-known');
        const isNowKnown = !wasKnown;

        toggleBtn.classList.toggle('is-known', isNowKnown);
        row.classList.toggle('known-device', isNowKnown);

        if (isNowKnown) {
            let currentHostname = document.getElementById(`hostname-${safeId}`).textContent;
            if (currentHostname === 'Active') currentHostname = '';
            await window.electronAPI.addKnownDevice({ ip: device.ip, hostname: currentHostname });
            // Update cache
            knownDevicesCache[device.ip] = { ip: device.ip, hostname: currentHostname };
        } else {
            await window.electronAPI.removeKnownDevice(device.ip);
            delete knownDevicesCache[device.ip];
        }

        // Re-apply filter if active
        applyFilter();
    });

    resultsBody.appendChild(row);

    // Check filter immediately
    const showUnknownOnly = showUnknownOnlyToggle.checked;
    const hideOffline = hideOfflineToggle.checked;

    let visible = true;
    if (showUnknownOnly && device.isKnown) visible = false;
    if (hideOffline && device.status === 'inactive') visible = false;

    if (!visible) row.style.display = 'none';
}

function updateDeviceStatus(result) {
    const safeId = result.ip.replace(/\./g, '-');
    let row = document.getElementById(`device-${safeId}`);

    if (!row) {
        // Should have been created by initiate, but just in case
        addDeviceRow({ ...result, isKnown: !!knownDevicesCache[result.ip] });
        row = document.getElementById(`device-${safeId}`);
    }

    if (row) {
        const dot = row.querySelector('.status-dot');
        const hostnameCell = document.getElementById(`hostname-${safeId}`);

        dot.className = 'status-dot';
        dot.classList.add(result.status);
        dot.title = result.status;

        row.dataset.status = result.status;

        // Apply filter to this row immediately
        const showUnknownOnly = showUnknownOnlyToggle.checked;
        const hideOffline = hideOfflineToggle.checked;
        const isKnown = row.classList.contains('known-device');

        // Determine visibility
        let visible = true;
        if (showUnknownOnly && isKnown) visible = false;
        if (hideOffline && result.status === 'inactive') visible = false;

        row.style.display = visible ? '' : 'none';

        if (result.status === 'active') {
            hostnameCell.textContent = result.hostname || '';
            // Update known device hostname if it changed
            if (result.isKnown) {
                // Optimization: only update if changed logic could be here
            }
        } else {
            if (result.status === 'inactive') {
                // Keep hostname for known devices if they are dead?
                // result.hostname might be null if dead.
                if (result.isKnown && knownDevicesCache[result.ip]?.hostname) {
                    hostnameCell.textContent = knownDevicesCache[result.ip].hostname + ' (Offline)';
                } else {
                    hostnameCell.textContent = '';
                }
            }
        }
    }
}
