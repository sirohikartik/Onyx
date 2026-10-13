# Onyx ⚡

> **A pitch-black, minimalist, Obsidian-style note-taking app crafted in native Rust.**  
> Designed for OLED screens, distraction-free Markdown writing, instant clipboard image attachment, and seamless GitHub SSH synchronization.

---

## 🌟 Key Features

- **True Pitch Black (`#000000`)**: Absolute black OLED aesthetic with subtle `#181818` borders and Obsidian signature violet accents (`#8b5cf6`).
- **Instant Image Pasting (`Cmd+V`)**: Paste screenshots directly from your clipboard or drag and drop image files into the editor. Images are automatically saved to your vault's `attachments/` folder and embedded with Markdown links (`![filename](attachments/...)`).
- **Hierarchical File Tree**:
  - Unlimited folder and subfolder nesting.
  - Hover and right-click context menus for:
    - New Note inside folder
    - New Subfolder
    - Inline Rename
    - Delete with confirmation dialog
  - Real-time search and filter across all notes.
- **Native GitHub Sync via SSH**:
  - Connects to your private GitHub notes repository (e.g., `git@github-personal:sirohikartik/notes-vault.git`).
  - One-click stage, commit, rebase-pull, and push to remote.
  - Live Git status badge (Clean, X changes pending, Syncing).
  - Git history modal with previous commits and timestamps.
- **Three Viewing Modes**:
  - **Split View**: Synchronized editor and live rendered Markdown.
  - **Edit Mode**: Distraction-free writing with line numbers.
  - **Preview Mode**: Reading view with GitHub Flavored Markdown typography.
- **Interactive Checklists**: Clickable `- [ ]` / `- [x]` checkboxes that update and autosave directly in the underlying file.
- **Code Syntax Highlighting**: Powered by `highlight.js` with GitHub Dark theme for over 100 languages.
- **Image Lightbox**: Click any inline image in preview mode to open a full-resolution lightbox viewer.

---

## 🏗️ Architecture

```
onyx/
├── src-tauri/             # Native Rust Backend (Tauri v2)
│   ├── src/
│   │   ├── lib.rs         # Filesystem, Base64 image handler, and Git runner
│   │   └── main.rs        # Entry point and macOS window setup
│   └── Cargo.toml         # Rust dependencies: walkdir, chrono, base64, serde
├── src/                   # Frontend Workspace
│   ├── components/
│   │   ├── Editor.tsx     # Textarea editor, line numbers, paste & drop handlers
│   │   ├── FileTree.tsx   # Collapsible vault explorer & context menu
│   │   ├── Preview.tsx    # Marked renderer, syntax highlighting, image cache
│   │   ├── GitModal.tsx   # Git commit dialog & history viewer
│   │   └── SettingsModal.tsx # Vault location & SSH configuration
│   ├── App.tsx            # Main application layout and state management
│   ├── App.css            # Custom Obsidian pitch-black CSS & typography
│   └── types.ts           # TypeScript interfaces
├── vite.config.ts         # Vite build configuration with Tailwind CSS v4
└── package.json           # Frontend dependencies: React, Lucide, Marked, Highlight.js
```

---

## ⌨️ Keyboard Shortcuts

| Shortcut | Description |
| :--- | :--- |
| <kbd>Cmd</kbd> + <kbd>N</kbd> | Create a new Markdown note |
| <kbd>Cmd</kbd> + <kbd>S</kbd> | Manually save note (autosave is also enabled) |
| <kbd>Cmd</kbd> + <kbd>V</kbd> | Paste clipboard image (auto-saved to `attachments/`) |
| <kbd>Cmd</kbd> + <kbd>Shift</kbd> + <kbd>S</kbd> | Sync current vault with GitHub remote |
| <kbd>Cmd</kbd> + <kbd>B</kbd> | Bold selected text (`**text**`) |
| <kbd>Cmd</kbd> + <kbd>I</kbd> | Italicize selected text (`*text*`) |
| <kbd>Tab</kbd> / <kbd>Shift</kbd> + <kbd>Tab</kbd> | Indent / Outdent 2 spaces |

---

## 🛠️ Installation & Setup

### Prerequisites

- **macOS** (Apple Silicon or Intel)
- **Xcode Command Line Tools**: `xcode-select --install`
- **Rust & Cargo**: [rustup.rs](https://rustup.rs)
- **Node.js 18+ & npm**: `brew install node`

### Clone and Install

```bash
# Clone the repository
git clone git@github-personal:sirohikartik/Onyx.git
cd Onyx

# Install frontend dependencies
npm install
```

### Run in Development

```bash
npm run tauri dev
```

### Build Native macOS App (`.app` and `.dmg`)

```bash
# Build native release bundle
npx tauri build
```

The resulting application bundles will be located at:
- `src-tauri/target/release/bundle/macos/Onyx.app`
- `src-tauri/target/release/bundle/dmg/Onyx_*.dmg`

To install directly to your system Applications folder:
```bash
cp -R src-tauri/target/release/bundle/macos/Onyx.app /Applications/
```

---

## ⚙️ Configuration

Onyx stores local preferences in `~/.config/onyx/config.json`:

```json
{
  "vault_path": "/Users/kartiksirohi/notes-vault",
  "git_remote": "git@github-personal:sirohikartik/notes-vault.git"
}
```

You can change your vault directory or configure your GitHub SSH remote at any time via the in-app **Settings** modal.

---

## 📄 License

MIT License. Crafted by [Kartik Sirohi](https://github.com/sirohikartik).
