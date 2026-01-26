# Claude Input Enhancer

A VS Code extension that provides an enhanced text input interface for Claude Code terminal interaction. Features slash commands, file mentions, and an intuitive input panel in the sidebar.

## Features

- **📋 Dual Input Modes**
  - **Sidebar Panel**: Always available in the sidebar for quick access
  - **Main Panel**: Opens in editor area via `Ctrl+Shift+C` for focused work

- **⚡ Slash Commands**
  - Type `/` to trigger command suggestions
  - Supports 46+ built-in Claude Code commands
  - Quick access to skills like `/commit`, `/plan`, `/review`, etc.
  - Also trigger with dunhao `、` (auto-converts to `/`)

- **📁 File & Folder Mentions**
  - Type `@` to mention files and folders
  - Navigate into folders with `@folder/`
  - Quick file search across your workspace

- **🚀 Quick Start**
  - One-click button to start Claude Code terminal
  - Automatically runs `claude --dangerously-skip-permissions`

- **📜 History**
  - View recent messages in the main panel
  - Click history items to restore previous text
  - Newest items appear at the bottom

- **⌨️ Keyboard Shortcuts**
  - `Enter` → Send to terminal + auto-clear + auto-enter in terminal
  - `Shift+Enter` → New line within text
  - `Ctrl+Shift+C` → Open main panel

## Installation

### From VSIX
1. Download the latest `.vsix` file from [Releases](https://github.com/yourusername/claude-input-enhancer/releases)
2. Open VS Code
3. Go to Extensions → Install from VSIX
4. Select the downloaded file

### From Source
```bash
git clone https://github.com/yourusername/claude-input-enhancer.git
cd claude-input-enhancer
npm install
npm run compile
```

Then press `F5` to launch Extension Development Host.

## Usage

### Basic Input
1. Open the Sidebar Panel (click the Claude icon in activity bar)
2. Type your message
3. Press `Enter` to send, or `Shift+Enter` for new line

### Slash Commands
- Type `/` or `、` to see available commands
- Navigate with arrow keys
- Press `Enter` to select a command

### File Mentions
- Type `@` followed by file/folder name
- Select a folder to navigate inside it
- Press `Enter` to insert the file path

### Quick Start Claude
Click the 🚀 Quick Start button in the sidebar to:
1. Create a new terminal
2. Run `claude --dangerously-skip-permissions`
3. Get started with Claude Code

## Commands

| Command | Shortcut | Description |
|---------|----------|-------------|
| `Claude: Open Claude Input Panel` | `Ctrl+Shift+C` | Opens main input panel in editor area |
| `Claude: Send to Claude Terminal` | - | Sends text from active input to terminal |

## Configuration

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `claudeInputEnhancer.clearAfterSend` | boolean | `false` | Clear input after sending text |
| `claudeInputEnhancer.panelPosition` | string | `sidebar` | Position of input panel (sidebar/bottom/floating) |

## Terminal Detection

The extension automatically detects Claude Code terminals by checking:
- Terminal names containing "claude", "claude-code", or "ai"
- Active terminals running shell environments
- Falls back to any available terminal if needed

## Development

```bash
# Install dependencies
npm install

# Compile TypeScript
npm run compile

# Watch mode (auto-compile on changes)
npm run watch

# Package extension
npm run vscode:prepublish
npx vsce package
```

## Project Structure

```
claude-input-enhancer/
├── src/
│   ├── extension.ts           # Extension activation point
│   ├── terminalView.ts        # Sidebar webview view
│   ├── inputPanel.ts          # Main panel webview
│   ├── terminalBridge.ts      # Terminal communication
│   ├── slashCommandManager.ts # Slash command system
│   ├── fileSearchManager.ts   # File search for @ mentions
│   └── historyManager.ts      # Chat history management
├── package.json               # Extension manifest
├── tsconfig.json              # TypeScript configuration
└── resources/
    └── comment.svg            # Extension icon
```


## License

MIT

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## Issues

If you find a bug or have a feature request, please open an issue on GitHub.
