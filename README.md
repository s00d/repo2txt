# repo2txt

[![npm version](https://img.shields.io/npm/v/repo2txt/latest?style=for-the-badge)](https://www.npmjs.com/package/repo2txt)
[![npm downloads](https://img.shields.io/npm/dw/repo2txt?style=for-the-badge)](https://www.npmjs.com/package/repo2txt)
[![License](https://img.shields.io/npm/l/repo2txt?style=for-the-badge)](https://www.npmjs.com/package/repo2txt)
[![GitHub stars](https://img.shields.io/github/stars/s00d/repo2txt?style=for-the-badge)](https://github.com/s00d/repo2txt)
[![Donate](https://img.shields.io/badge/Donate-Donationalerts-ff4081?style=for-the-badge)](https://www.donationalerts.com/r/s00d88)

A powerful console utility for interactively selecting files and folders with checkboxes, building a file tree, and generating a unified Markdown file with all selected files. Perfect for preparing code context for LLMs, documenting project structure, and creating codebase snapshots.

## ✨ Features

- 🎯 **Interactive File Selection** - Navigate through your project with a beautiful terminal UI
- 📊 **Real-time Statistics** - See file count, size, and token count for selected files
- 🔍 **Smart File Filtering** - Automatic `.gitignore` analysis and preset support
- 🚀 **Fast & Efficient** - Stream-based generation handles large projects with ease
- 🎨 **Syntax Highlighting** - Automatic language detection for Markdown code blocks
- 💾 **Clipboard Support** - Copy generated content directly to clipboard
- 🔎 **Search & Preview** - Quickly find and preview files in the terminal

## 🎯 Use Cases

- **LLM Context Preparation** - Prepare code context for large language models
- **Project Documentation** - Generate comprehensive project snapshots
- **Codebase Snapshots** - Create selective backups of important files
- **Project Export** - Export specific parts of your project to a single document

## 📦 Installation

```bash
npm i -g repo2txt
```

After installation, use `repo2txt` from anywhere:

```bash
repo2txt [options]
```

## 🚀 Quick Start

### Basic Usage

Run in the current directory:

```bash
repo2txt
```

The interactive UI will open showing your file tree. Use the controls below to select files and generate Markdown.

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

## ⌨️ Keyboard Controls

### Navigation
- `↑/↓` - Navigate through the list
- `→` or `l` - Expand folder
- `←` or `h` - Collapse folder

### Selection
- `Space` - Select/deselect file or folder
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
| `--ignore-gitignore` | | Ignore `.gitignore` when scanning |
| `--exclude <pattern>` | `-e` | Add exclusion patterns (can be used multiple times) |
| `--skip-ui` | `-s` | Skip interactive UI and generate directly |
| `--clipboard` | `-c` | Copy output to clipboard instead of saving to file |
| `--preset <name>` | `-p` | Use preset from `.repo2txtrc.json` |
| `--help` | `-h` | Show help message |

### Examples

```bash
# Scan specific directory and save to custom file
repo2txt -d ./my-project -o project-snapshot.md

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

# Combine options
repo2txt -d ./src -o output.md -e "*.test.ts" -c
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

## 📄 Output Format

The generated Markdown file contains:

1. **Header** - Document title
2. **File Structure** - Text tree of all selected files
3. **File Contents** - Each file includes:
   - File path as heading
   - Code block with language syntax highlighting
   - Separator (`---`)

### Example Output

```markdown
# Collected Files

## File Structure

```
├── ☑ 📁 src
│   ├── ☑ 📄 types.ts
│   └── ☑ 📄 index.ts
└── ☑ 📄 README.md
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

Built with TypeScript and modern Node.js:

- **blessed** - Interactive terminal UI framework
- **gpt-tokenizer** - Token counting for LLM context
- **ignore** - `.gitignore` parsing
- **citty** - CLI argument parsing
- **chalk** - Colored console output
- **clipboardy** - Clipboard integration

### Project Structure

```
src/
├── types.ts              # Type definitions
├── fileTree.ts           # File tree building and .gitignore handling
├── uiStateController.ts  # UI state management
├── ui.ts                 # Interactive terminal interface
├── generator.ts          # Markdown generation
├── index.ts              # CLI entry point
└── main.ts               # Main entry point
```

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

# Build
pnpm run build

# Run
pnpm start
```

### Development Scripts

```bash
pnpm run dev          # Development with hot reload (tsx)
pnpm run build        # Build project
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

## 🐛 Known Limitations

- Binary files are read as text (may produce incorrect output)
- Very large files (>100MB) may take time to process
- Token counting is approximate (uses GPT tokenizer)

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

---

Made with ❤️ for developers who need to prepare code context for LLMs
# repo2txt
