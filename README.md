# repo2txt

[![Crates.io](https://img.shields.io/crates/v/repo2txt.svg)](https://crates.io/crates/repo2txt)
[![npm version](https://img.shields.io/npm/v/repo2txt/latest?style=for-the-badge)](https://www.npmjs.com/package/repo2txt)
[![License](https://img.shields.io/npm/l/repo2txt?style=for-the-badge)](https://www.npmjs.com/package/repo2txt)
[![GitHub stars](https://img.shields.io/github/stars/s00d/repo2txt?style=for-the-badge)](https://github.com/s00d/repo2txt)
[![Donate](https://img.shields.io/badge/Donate-Donationalerts-ff4081?style=for-the-badge)](https://www.donationalerts.com/r/s00d88)

A high-performance desktop application for preparing code context for LLMs (ChatGPT, Claude, etc.). It allows you to interactively select files and folders, visualize your project structure, and generate a single Markdown file with optimized tokens.

Built with **Rust (Tauri)** and **Vue 3** for blazing fast performance even on massive monorepos.

## 📸 Screenshots

![repo2txt interface](https://github.com/s00d/repo2txt/raw/main/assets/img1.png)

![File tree and preview](https://github.com/s00d/repo2txt/raw/main/assets/img2.png)

![Settings modal](https://github.com/s00d/repo2txt/raw/main/assets/img3.png)

![Generation result](https://github.com/s00d/repo2txt/raw/main/assets/img4.png)

![Dark mode](https://github.com/s00d/repo2txt/raw/main/assets/img5.png)

## ✨ Features

- 🚀 **Blazing Fast** - Written in Rust, capable of scanning 100k+ files in milliseconds.
- ⚡ **Instant Preview** - Virtual scrolling allows rendering huge file trees without lag.
- 🎨 **Modern UI** - Clean, dark-mode ready interface with file icons and syntax highlighting.
- 🔍 **Smart Filtering** - Automatically respects `.gitignore` and `.r2x_ignore`.
- 🛡️ **Binary Detection** - Automatically skips binary files to prevent token wastage.
- 📊 **Token Estimation** - Real-time token counting using `tiktoken` (GPT-4 tokenizer).
- ⚙️ **Configurable** - Customize ignored patterns, binary extensions, and output templates.
- 🖱️ **Drag & Drop** - Simply drag your project folder into the window to start.

## 📦 Installation

### Option 1: Cargo Binstall (Recommended for Rust users)

The easiest way to install the binary directly without compiling:

```bash
cargo binstall repo2txt
```

### Option 2: NPM Wrapper (Recommended for JS/Web devs)

Install via your favorite package manager. The wrapper will automatically download the correct binary for your OS.

```bash
npm install -g repo2txt

# or

pnpm add -g repo2txt

# or

yarn global add repo2txt
```

Then run it from anywhere:

```bash
repo2txt
```

### Option 3: Manual Download

Download the latest executable for Windows, macOS, or Linux from the [Releases Page](https://github.com/s00d/repo2txt/releases).

**Verifying Signatures**: All binaries are signed with GPG. To verify a download:

```bash
# Import the public key (first time only)
gpg --keyserver keyserver.ubuntu.com --recv-keys YOUR_KEY_ID

# Or download from GitHub
curl https://github.com/s00d.gpg | gpg --import

# Verify the signature
gpg --verify repo2txt_2.0.0_<target>.tar.gz.sig repo2txt_2.0.0_<target>.tar.gz
```

The NPM wrapper automatically verifies signatures during installation.

### Platform-Specific Notes

#### macOS

```bash
# If you encounter signing issues
chmod +x /Applications/repo2txt
xattr -cr /Applications/repo2txt
codesign --force --deep --sign - /Applications/repo2txt
```

## 🚀 Quick Start

1. **Open the app** by running `repo2txt` in your terminal or clicking the app icon.

2. **Select a project**:
   - Click "Browse" in the toolbar.
   - Or drag & drop a folder into the application window.

3. **Select files**:
   - Use checkboxes to select files or folders.
   - Use "Select All" / "Deselect All" from the actions menu.
   - Search for specific files using the search bar (supports fuzzy matching).

4. **Generate**:
   - Click "Export" to generate the Markdown file.
   - You can copy the result to clipboard or save it to `output.md`.

## ⌨️ Keyboard Shortcuts

| Key   | Action                               |
|-------|--------------------------------------|
| ↑ / ↓ | Navigate through the file tree       |
| Space | Toggle selection of the focused item |
| Enter | Expand folder / Preview file         |
| → / ← | Expand / Collapse folder             |

## ⚙️ Configuration

You can customize repo2txt via the Settings menu (click the ⚙️ icon).

### Global Filters

Configure patterns that should always be ignored (e.g. `node_modules`, `.git`) and extensions to treat as binary.

### Output Template

Customize how the generated Markdown looks. Standard variables:

- `{{path}}` - Relative file path
- `{{language}}` - Detected programming language
- `{{content}}` - File content

**Default Template:**

```markdown
## {{path}}

```{{language}}
{{content}}
```

### Settings Location

Configuration is saved in `settings.json` in your OS's application data directory:

- **Windows**: `%APPDATA%\repo2txt\settings.json`
- **macOS**: `~/Library/Application Support/repo2txt/settings.json`
- **Linux**: `~/.config/repo2txt/settings.json`

You can also create a per-project `.r2x` file to save the selection state of specific files.

## 🏗️ Architecture

This project uses the **Tauri v2** framework to combine a lightweight Rust backend with a Vue 3 frontend.

### Backend (Rust)

- **Filesystem Operations**: Uses `tokio` for asynchronous IO and `ignore` (ripgrep's engine) for ultra-fast traversing.
- **State Management**: Thread-safe `AppState` with `Mutex` to handle heavy concurrent operations.
- **Token Counting**: Uses `tiktoken-rs` for accurate GPT-4 token estimation.

### Frontend (Vue 3 + TypeScript)

- **State**: `Pinia` store for reactive state management.
- **Rendering**: `vue-virtual-scroller` for rendering lists with unlimited items.
- **Styling**: `Tailwind CSS` with a custom design system.
- **Icons**: `lucide-vue-next`.

## 🛠️ Development

### Prerequisites

- Rust (latest stable)
- Node.js (LTS)
- pnpm

### Setup

```bash
# Clone repository
git clone https://github.com/s00d/repo2txt.git
cd repo2txt

# Install dependencies
pnpm install

# Run in development mode
pnpm tauri dev
```

### Build

```bash
# Build for production
pnpm tauri build
```

## 📄 License

MIT License - see LICENSE file for details

Made with ❤️ for developers who need efficient context for LLMs.
