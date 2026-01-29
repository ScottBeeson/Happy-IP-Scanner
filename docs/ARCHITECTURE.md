# Technical Design Document - Happy IP Scanner

## 1. Architecture Overview
The application will be built using **Electron**. It will follow a modular architecture to ensure code readability and maintainability, adhering to the "AI-first" code philosophy (small contexts).

### 1.1 Process Model
- **Main Process**: Handles application lifecycle, native system interactions (scanning logic, file I/O), and creates the browser window.
- **Renderer Process**: Handles the UI/UX. Communicates with the Main Process via `ContextBridge` and `IPC`.

### 1.2 IPC Communication
We will use a strictly typed `preload.js` to expose safe APIs to the Renderer.
- **Channels**:
    - `scan:start` (Renderer -> Main): Initiate scan with parameters (Range).
    - `scan:stop` (Renderer -> Main): Cancel current scan.
    - `scan:progress` (Main -> Renderer): Real-time updates of individual IP status.
    - `scan:complete` (Main -> Renderer): Notification that scan is finished.
    - `data:load` (Renderer -> Main): Request "Known Devices" data.
    - `data:save` (Renderer -> Main): Save "Known Devices" data.

## 2. Code Structure & Modules
To support the "Easy to understand" and "AI-friendly" philosophy, we will avoid a monolithic `main.js`.

```
/src
  /main
    main.js           # Entry point, window creation
    ipcHandlers.js    # Setup IPC listeners
    scanner.js        # Core scanning logic (ping, ARP)
    store.js          # File I/O for "Known Devices" persistence
  /renderer
    index.html
    style.css         # CSS Variables, clean design
    renderer.js       # UI Logic, DOM manipulation
    ui-components.js  # Helper functions for creating UI elements
  preload.js          # ContextBridge exposure
```

## 3. Core Components

### 3.1 Scanner Module (`scanner.js`)
- **Library**: We will use Node.js native `net` socket connection attempts (fast) or a lightweight wrapper around system `ping` command (`ping` wrapper).
    - *Decision*: Socket connect (port 80/443/135) is often faster but might miss devices only responding to ICMP. System `ping` is more reliable for general discovery. We will likely use a promise-based queue to limit concurrency (e.g., batch of 50 IPs).
- **Concurrency**: Implementing a helper to run `N` promises in parallel to scan a /24 subnet quickly (255 IPs).

### 3.2 Data Store (`store.js`)
- **Format**: JSON file (`known-devices.json`) stored in `app.getPath('userData')`.
- **Structure**:
```json
{
  "devices": {
    "192.168.1.50": {
      "mac": "AA:BB:CC:DD:EE:FF",
      "hostname": "John-iPhone",
      "comment": "Scott's Phone",
      "known": true,
      "lastSeen": "2023-10-27T10:00:00Z"
    }
  }
}
```
- **Scalability Analysis**: 
    - **Target Scale**: User specified "Up to 1000 known devices". 
    - **JSON Performance**: A JSON object with 1,000 to 5,000 entries is approximately 200KB - 1MB. Node.js `JSON.parse` and `JSON.stringify` handle this in milliseconds. File I/O for this size is negligible on modern SSDs.
    - **Decision**: We will stick with **JSON** for the MVP to adhere to the "Simple/Clean" philosophy and avoid the complexity of native Node modules (SQLite) in Electron (rebuilding for different architectures).
    - **Future Proofing**: The `store.js` module will expose an *asynchronous API* (`getKnownDevices()`, `saveDevice()`) even if the underlying implementation is synchronous file I/O. This ensures we can swap the backend for `sqlite3` or `better-sqlite3` in the future without changing any UI or Scanner logic.

- **Key**: Indexing by MAC address is robust (DHCP changes IPs), but simpler MVP might index by IP if MAC retrieval is tricky without admin privs.
- *Recommendation*: Try to use ARP table retrieval (`arp -a`) to map IP to MAC, and key "Known" status by MAC. Fallback to IP if MAC unavailable.

## 4. Security & Performance
- **Content Security Policy (CSP)**: Strict CSP in `index.html`.
- **Context Isolation**: Enabled.
- **Node Integration**: Disabled in Renderer.
- **Performance**:
    - Virtualized list not strictly necessary for ~254 items, but good DOM management (building fragments) required.
    - recursive scanning or async iterators to prevent UI freezing.

## 5. Third-Party Libraries
Keep dependencies minimal.
- `ip`: For IP range calculation and CIDR parsing.
- `arp` or similar (optional): For MAC address resolution.
```
