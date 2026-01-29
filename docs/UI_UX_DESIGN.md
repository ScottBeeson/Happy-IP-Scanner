# UI/UX Design Guidelines - Happy IP Scanner

## 1. Design Philosophy
**"Simple, Intuitive, Clean."**
The interface should feel lightweight and responsive. We avoid the "hacker" aesthetic of typical network tools (black/green terminals) in favor of a modern, consumer-friendly look.

## 2. Color Palette
- **Primary**: A "Happy" Blue or Indigo (`#4F46E5` or similar). Used for primary actions (Start Scan).
- **Background**: Clean White (`#FFFFFF`) or very light gray (`#F3F4F6`) for the app body.
- **Success**: Green (`#10B981`) for "Active/Online" status indicators.
- **Text**: Dark Slate (`#1E293B`) for high readability.
- **Accent/Warning**: Amber (`#F59E0B`) for identifying Unknown devices effectively.

## 3. Typography
- **Font**: System UI (San Francisco on Mac, Segoe UI on Windows). No custom font downloads to keep it fast and native-feeling.
- **Scale**:
    - **H1**: Project Title (if visible) or Main Range Input.
    - **Body**: 14px or 16px for comfortable reading of IP lists.

## 4. Layout
### 4.1 Header (Control Bar)
- **Top Bar**: Contains the core inputs.
    - [Input Field] "IP Range" (Placeholder: `192.168.1.1 - 192.168.1.254`)
    - [Button] "Start Scan" (Primary Color, rounded corners).
    - [Toggle Switch] "Show Unknown Only" (Label to the right).
- **Height**: ~60-80px. Fixed at top.

### 4.2 Main Content (Results List)
- **Table/List Area**: Scrollable area taking up the rest of the window.
- **Row Design**:
    - Each row represents a device.
    - **Left**: Status Dot (Green = Online).
    - **Middle**: 
        - Primary Line: **IP Address** ... **Hostname**
        - Secondary Line: *Custom Comment* (e.g. "Scott's Phone") - clickable to edit.
    - **Right**: "Known" Toggle (Star icon or Checkbox).
        - *Interaction*: Clicking the star makes it solid (Known). Clicking again makes it outline (Unknown).

### 4.3 Status Bar (Footer)
- **Bottom**: Small footer (20px high).
- **Content**: Scan progress (ProgressBar), Status text ("Scanning... 45%", "Ready").

## 5. Interactions
- **Hover Effects**: Rows highlight slightly on hover (`#F1F5F9`).
- **Transitions**: Smooth fade-in for new rows appearing.
- **Inline Editing**: Clicking the comment area turns it into a small input field to rename/label the device.
- **Toggle Animation**: The "Show Known Only" toggle should smoothly filter the list (CSS transition) rather than a jarring refresh.

## 6. Iconography
- Use safe, SVG icons (e.g., Heroicons or similar open source set).
- **Icons needed**:
    - `Play` (Start Scan)
    - `Stop` (Cancel Scan)
    - `Star` (Known)
    - `Refresh` (Rescan single item - optional)
