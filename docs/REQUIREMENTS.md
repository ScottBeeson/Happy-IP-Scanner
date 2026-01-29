# Product Requirements Document (PRD) - Happy IP Scanner

## 1. Project Overview
**Happy IP Scanner** is a simple, intuitive, and clean IP scanning desktop application for Windows. It allows users to scan a defined range of IP addresses to identify active devices on the network.

**Killer Feature**: The ability to mark devices as "known". A simple toggle allows users to filter the scan results to show *only* new or unknown devices, making it easy to spot intruders or new hardware.

## 2. Design Philosophy
- **Simple & Intuitive**: Minimal configuration required. The interface should be self-explanatory.
- **Clean**: Avoid clutter. Use whitespace effectively. Modern aesthetic.
- **Code Philosophy**: Easy to understand, modular code. AI-first structure (separation of concerns to limit context loading).

## 3. Core Features

### 3.1 IP Scanning
- **Range Selection**: User can define a start and end IP address, or use CIDR notation (e.g., 192.168.1.0/24).
- **Start/Stop Scan**: Prominent controls to initiate and cancel scans.
- **Progress Indication**: Visual feedback on scan progress (bar and/or counter).
- **Concurrency**: Fast scanning using multiple threads or async operations.

### 3.2 Device Identification
- **Ping**: detect active devices.
- **Hostname Resolution**: Attempt to resolve hostnames for active IPs.
- **MAC Address & Vendor**: (Optional for MVP, but desired) Retrieve MAC address and look up vendor if possible (requires running as admin or ARP table access).
### 3.2 Device Identification
- **Ping**: detect active devices.
- **Hostname Resolution**: Attempt to resolve hostnames for active IPs.
- **MAC Address & Vendor**: (Optional for MVP, but desired) Retrieve MAC address and look up vendor if possible (requires running as admin or ARP table access).
- **Custom Label**: User can assign a custom name (e.g., "Scott's Phone") to a device.
- **Open Ports**: (Future Scope) Simple port checking for common services (HTTP, SSH).

### 3.3 "Known Devices" Management
- **Mark as Known**: A checkbox or toggle next to each device in the results list to mark it as "Known".
### 3.3 "Known Devices" Management
- **Mark as Known**: A checkbox or toggle next to each device in the results list to mark it as "Known".
- **Edit Details**: Ability to add/edit a custom label for the device.
- **Persistence**: "Known" status and custom labels are saved locally and persist across application restarts.
- **Filtering**: A global toggle switch: "Show Unknown Only".
    - When ON: Hides all devices marked as "Known".
    - When OFF: Shows all active devices.

### 3.4 Results View
- **List View**: Clean table or card layout.
### 3.4 Results View
- **List View**: Clean table or card layout.
- **Columns**: IP Address, Status (Active), Hostname, Custom Label (if set), MAC/Vendor (if avail), Known Status.
- **Sorting**: Sort by IP, Hostname, or Status.

## 4. User Flows

### 4.1 Basic Scan
1. User opens app.
2. App defaults to the local network range (e.g., 192.168.1.x).
3. User clicks "Start Scan".
4. Results populate in real-time.
5. User scrolls through list.

### 4.2 Managing Known Devices
1. User identifies their phone and laptop in the list.
2. User clicks the "Known" icon/checkbox for these devices.
3. User toggles "Show Unknown Only".
4. The list updates to hide the phone and laptop.
5. User sees a new IP, identifies it as a guest, and leaves it as "Unknown" or marks it.

## 5. Technical Constraints
- **Platform**: Electron.
- **OS**: Windows (primary).
- **Tech Stack**:
    - Frontend: HTML/CSS/JS (Vanilla or light framework like React/Vue, but aiming for "Easy to understand" -> likely Vanilla or minimal React).
    - Backend: Node.js (Electron Main process).
    - Storage: Local JSON file or SQLite for storing "Known" devices list.

## 6. Milestones
1. **MVP**: Basic scanning, list display, simple "Known" marking (persisted to JSON).
2. **v1.1**: MAC address fetching, Vendor lookup.
3. **v1.2**: Port scanning features.
