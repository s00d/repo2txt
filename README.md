# repo2txt

[![npm version](https://img.shields.io/npm/v/repo2txt/latest?style=for-the-badge)](https://www.npmjs.com/package/repo2txt)
[![npm downloads](https://img.shields.io/npm/dw/repo2txt?style=for-the-badge)](https://www.npmjs.com/package/repo2txt)
[![License](https://img.shields.io/npm/l/repo2txt?style=for-the-badge)](https://www.npmjs.com/package/repo2txt)
[![GitHub stars](https://img.shields.io/github/stars/s00d/repo2txt?style=for-the-badge)](https://github.com/s00d/repo2txt)
[![Donate](https://img.shields.io/badge/Donate-Donationalerts-ff4081?style=for-the-badge)](https://www.donationalerts.com/r/s00d88)

A powerful utility for interactively selecting files and folders with checkboxes, building a file tree, and generating a unified Markdown file with all selected files. Perfect for preparing code context for LLMs, documenting project structure, and creating codebase snapshots.

Available in two modes:
- **Terminal UI** - Beautiful console-based interface with keyboard navigation
- **Web UI** - Modern cross-platform web interface accessible in any browser

## ✨ Features

- 🎯 **Interactive File Selection** - Navigate through your project with beautiful UI (terminal or web)
- 📊 **Real-time Statistics** - See file count, size, and token count for selected files
- 🔍 **Smart File Filtering** - Automatic `.gitignore` and `.r2x_ignore` analysis, preset support, and exclusion of system/binary/private files
- 🚀 **Fast & Efficient** - Stream-based generation handles large projects with ease
- 🎨 **Syntax Highlighting** - Automatic language detection for Markdown code blocks
- 💾 **Clipboard Support** - Copy generated content directly to clipboard
- 🔎 **Search & Preview** - Quickly find and preview files
- 💾 **State Persistence** - UI state (selected files, expanded folders) is saved to `.r2x` config file
- 🌐 **Web Interface** - Modern React-based web UI with Tailwind CSS (launch with `--ui` flag)
- 📈 **Token Counting** - Approximate LLM token count using GPT tokenizer
- 🎛️ **Recursive Selection** - Toggle parent folder to select/deselect all children

## 🎯 Use Cases

- **LLM Context Preparation** - Prepare code context for large language models
- **Project Documentation** - Generate comprehensive project snapshots
- **Codebase Snapshots** - Create selective backups of important files
- **Project Export** - Export specific parts of your project to a single document

## 📦 Installation

```bash
npm i -g repo2txt
```

After installation, use `repo2txt` or `r2t` from anywhere:

```bash
repo2txt [options]
# or
r2t [options]
```

## 🚀 Quick Start

### Terminal UI Mode

Run in the current directory with terminal interface:

```bash
repo2txt
```

The interactive terminal UI will open showing your file tree. Use keyboard controls to select files and generate Markdown.

### Web UI Mode

Launch the web interface (opens automatically in your browser):

```bash
repo2txt --ui
# or
repo2txt -u
```

The web interface will start on `http://localhost:8765` (or next available port). Use your mouse to:
- Click checkboxes to select/deselect files
- Click folder icons to expand/collapse directories
- Use the toolbar to generate Markdown and view results

### Skip UI Mode

Generate Markdown directly using default `.gitignore` selection:

```bash
repo2txt --skip-ui
```

### Copy to Clipboard

```bash
repo2txt --clipboard
# or
repo2txt -c
```

## ⌨️ Keyboard Controls (Terminal UI)

### Navigation
- `↑/↓` - Navigate through the list
- `→` or `l` - Expand folder
- `←` or `h` - Collapse folder

### Selection
- `Space` - Select/deselect file or folder (recursively toggles children)
- `Double click` - Toggle selection

### Actions
- `Enter` - Apply selection and generate Markdown
- `F` or `p` - Preview selected file
- `/` - Search files

### Exit
- `Esc` or `q` - Cancel and exit

## 📋 Command Line Options

```bash
repo2txt [directory] [options]
```

### Options

| Option | Short | Description |
|--------|-------|-------------|
| `--directory <path>` | `-d` | Target directory to scan (default: current directory) |
| `--output <file>` | `-o` | Output file path (default: `output.md`) |
| `--ignore-gitignore` | `-i` | Ignore `.gitignore` when scanning |
| `--exclude <pattern>` | `-e` | Add exclusion patterns (can be used multiple times) |
| `--skip-ui` | `-s` | Skip interactive UI and generate directly |
| `--clipboard` | `-c` | Copy output to clipboard instead of saving to file |
| `--preset <name>` | `-p` | Use preset from `.repo2txtrc.json` |
| `--ui` | `-u` | Launch web interface instead of terminal UI |
| `--clean` | | Delete `.r2x` config file before running (reset saved state) |
| `--help` | `-h` | Show help message |

### Examples

```bash
# Scan specific directory and save to custom file
repo2txt -d ./my-project -o project-snapshot.md

# Launch web interface
repo2txt --ui

# Ignore .gitignore rules
repo2txt --ignore-gitignore

# Add multiple exclusion patterns
repo2txt -e "*.log" -e "temp/*" -e "dist/*"

# Skip UI and generate directly
repo2txt --skip-ui

# Copy to clipboard
repo2txt --clipboard

# Use preset configuration
repo2txt --preset code

# Reset saved state (delete .r2x config)
repo2txt --clean

# Combine options
repo2txt -d ./src -o output.md -e "*.test.ts" -c

# Reset state and launch web UI
repo2txt --clean --ui
```

## ⚙️ Configuration

### `.repo2txtrc.json`

Create a `.repo2txtrc.json` file in your project root to define presets:

```json
{
  "presets": {
    "code": {
      "exclude": ["*.test.ts", "*.spec.ts", "dist/*", "node_modules/*"],
      "ignoreGitignore": false
    },
    "config": {
      "include": ["*.json", "*.yaml", "*.toml", "*.env*"],
      "ignoreGitignore": true
    }
  }
}
```

Then use with:

```bash
repo2txt --preset code
```

### `.r2x` State File

The application automatically saves your UI state (selected files, expanded folders) to a `.r2x` file in the target directory after generating Markdown. This file:
- Saves your selection and folder expansion state in a nested structure
- Stores state for all nodes including children recursively
- Is automatically loaded on next run
- Is excluded from scanning (not included in generated output)
- Uses JSON format with nested tree structure matching file hierarchy

You can safely commit `.r2x` files to version control to share selection preferences with your team.

**Reset saved state:**

To start fresh and clear saved selections, use the `--clean` flag:

```bash
repo2txt --clean
```

This will delete the `.r2x` file before launching the interface.

### `.r2x_ignore` File

Similar to `.gitignore`, you can create a `.r2x_ignore` file in your project root to exclude specific files and directories from the file tree. This file:
- Uses the same syntax as `.gitignore`
- Patterns are automatically merged with `.gitignore` rules
- Files matching patterns will not appear in the file tree at all
- The `.r2x_ignore` file itself is automatically excluded

**Example `.r2x_ignore`:**

```
# Exclude test files
*.test.ts
*.spec.ts
*.test.js
*.spec.js

# Exclude temporary directories
temp/
old/
backup/

# Exclude specific patterns
*.log
*.cache
```

**Note:** Patterns in `.r2x_ignore` work alongside `.gitignore`. Both are respected unless you use the `--ignore-gitignore` flag.

## 📄 Output Format

The generated Markdown file contains:

1. **Header** - Document title
2. **File Structure** - Text tree of all selected files with checkboxes
3. **File Contents** - Each file includes:
   - File path as heading
   - Code block with language syntax highlighting
   - Separator (`---`)

### Example Output

```markdown
# Collected Files

## File Structure

```
├── [✓] ▶ src
│   ├── [✓] types.ts
│   └── [✓] index.ts
└── [✓] README.md
```

---

## src/types.ts

```typescript
export interface FileNode {
  name: string;
  path: string;
  // ...
}
```

---
```

## 🏗️ Architecture

Built with TypeScript and modern Node.js using a clean class-based architecture with event-driven design:

### Core Dependencies
- **blessed** - Interactive terminal UI framework
- **gpt-tokenizer** - Token counting for LLM context
- **ignore** - `.gitignore` parsing
- **citty** - CLI argument parsing
- **chalk** - Colored console output
- **clipboardy** - Clipboard integration
- **electron** - Desktop application wrapper for web UI

### Web UI Dependencies
- **React** - Frontend framework
- **Vite** - Build tool and dev server
- **Express** - Backend API server
- **Tailwind CSS** - Utility-first CSS framework

### Architecture Overview

The project uses a clean separation of concerns:

- **`RepositoryTree`** - Core class that manages file tree structure and node state
  - Stores all file nodes and state (selected/expanded)
  - Handles file scanning, state synchronization, and persistence
  - Emits events for state changes (`state-changed`, `nodes-scanned`)
  - Completely independent of UI layers
  
- **UI Layers** - Terminal and Web interfaces that consume `RepositoryTree`
  - Receive data from `RepositoryTree` via methods and events
  - Interact with repository through public API only
  - No direct access to internal state management

### Project Structure

```
src/
├── types.ts              # Type definitions (FileNode, UIState)
├── repositoryTree.ts     # Core class: file tree & state management
├── ui.ts                 # Interactive terminal interface (blessed)
├── ui-web.ts             # Web server and API endpoints (Express)
├── generator.ts          # Markdown generation logic
├── index.ts              # CLI entry point and command definition
└── main.ts               # Main entry point

web/
├── index.html            # Web UI entry point
├── main.tsx              # React app initialization
├── app.tsx               # Main app component
├── api.ts                # API client
├── styles.css            # Global styles (Tailwind)
└── components/
    ├── FileTree.tsx      # File tree component
    ├── FilePreview.tsx   # File preview component
    ├── StatsPanel.tsx    # Statistics panel
    ├── Toolbar.tsx       # Action toolbar
    └── Modal.tsx         # Result modal
```

### Key Design Principles

1. **Single Responsibility** - `RepositoryTree` handles only data management
2. **Event-Driven** - UI layers subscribe to repository events
3. **No UI Dependencies** - Core class has no knowledge of UI implementations
4. **State Persistence** - Automatic save/load of complete tree state
5. **Lazy Loading** - Directories scanned only when needed

## 🛠️ Development

### Prerequisites

- Node.js 18+
- pnpm 8+

### Setup

```bash
# Clone repository
git clone https://github.com/s00d/repo2txt.git
cd repo2txt

# Install dependencies
pnpm install

# Build (CLI + Web UI)
pnpm run build

# Run terminal UI
pnpm start

# Run web UI
pnpm run dev -- --ui
```

### Development Scripts

```bash
pnpm run dev          # Development with hot reload (tsx)
pnpm run dev -- --ui # Development with web UI
pnpm run build        # Build project (CLI + Web UI)
pnpm run build:web    # Build only web UI
pnpm run typecheck    # Type checking
pnpm run lint         # Lint code
pnpm run format       # Format code
pnpm run test         # Run tests
pnpm run test:ui      # Run tests with UI
```

## 📊 Performance

- **Lazy Loading** - Directories are scanned only when expanded
- **Streaming I/O** - Large files are processed efficiently
- **Caching** - File statistics and token counts are cached
- **Optimized Rendering** - UI updates are pre-calculated for smooth performance
- **Binary File Exclusion** - Common binary file types are automatically excluded
- **System File Exclusion** - System directories (`.git`, `node_modules`, etc.) are excluded by default

## 🐛 Known Limitations

- Binary files are excluded from scanning (images, videos, archives, etc.)
- Very large files (>100MB) may take time to process
- Token counting is approximate (uses GPT tokenizer)
- Private files (`.env`, keys, certificates) are excluded by default

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details

## 🔗 Links

- **Repository**: [https://github.com/s00d/repo2txt](https://github.com/s00d/repo2txt)
- **Issues**: [https://github.com/s00d/repo2txt/issues](https://github.com/s00d/repo2txt/issues)
- **NPM Package**: [https://www.npmjs.com/package/repo2txt](https://www.npmjs.com/package/repo2txt)

---

Made with ❤️ for developers who need to prepare code context for LLMs
