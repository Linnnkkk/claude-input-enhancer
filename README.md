# Claude Input Enhancer

A VS Code extension that provides an enhanced text input panel for Claude Code terminal interaction.

## Features

- **Rich Text Editor**: Full-featured text editor with multi-line support, cursor movement, copy/paste
- **Smart Terminal Detection**: Automatically finds and connects to Claude Code terminals
- **Keyboard Shortcuts**: Quick access with `Ctrl+Shift+C` (or `Cmd+Shift+C` on Mac)
- **Send with `Ctrl+Enter`**: Quick sending with keyboard shortcut
- **Configurable**: Options for auto-clear after send, panel position, etc.

## Usage

1. Install the extension
2. Open a terminal and run Claude Code
3. Press `Ctrl+Shift+C` (or `Cmd+Shift+C` on Mac) to open the input panel
4. Type your message in the rich text editor
5. Press `Ctrl+Enter` (or `Cmd+Enter` on Mac) or click "Send to Claude" to send

## Commands

- `Claude: Open Claude Input Panel` - Opens the enhanced input panel
- `Claude: Send to Claude Terminal` - Sends text to the active Claude terminal

## Configuration

- `claudeInputEnhancer.clearAfterSend`: Clear input panel after sending text (default: false)
- `claudeInputEnhancer.panelPosition`: Position of the input panel (sidebar/bottom/floating, default: sidebar)

## Development

1. Clone this repository
2. Run `npm install`
3. Press `F5` to open a new Extension Development Host window
4. Test the extension

## Terminal Detection

The extension looks for terminals running Claude Code by checking:
- Terminal names containing "claude", "claude-code", or "ai"
- Active terminals running shell environments that might be running Claude
- Falls back to any available terminal if no Claude-specific terminal is found

## Keyboard Shortcuts

- `Ctrl+Shift+C` / `Cmd+Shift+C`: Open Claude Input Panel
- `Ctrl+Enter` / `Cmd+Enter`: Send text to Claude (when in input panel)