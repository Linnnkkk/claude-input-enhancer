import * as vscode from 'vscode';
import { TerminalBridge } from './terminalBridge';
import { HistoryManager } from './historyManager';
import { SlashCommandManager } from './slashCommandManager';
import { FileSearchManager } from './fileSearchManager';

export class ClaudeInputViewProvider implements vscode.WebviewViewProvider {
    public static readonly viewType = 'claudeInputView';

    constructor(
        private readonly extensionUri: vscode.Uri,
        private readonly terminalBridge: TerminalBridge,
        private readonly historyManager: HistoryManager,
        private readonly slashCommandManager: SlashCommandManager,
        private readonly fileSearchManager: FileSearchManager
    ) {}

    public resolveWebviewView(
        webviewView: vscode.WebviewView,
        context: vscode.WebviewViewResolveContext,
        token: vscode.CancellationToken,
    ): void | Thenable<void> {
        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [this.extensionUri]
        };

        webviewView.webview.html = this.getHtmlForWebview(webviewView.webview);

        // Handle messages from the webview
        webviewView.webview.onDidReceiveMessage((message) => {
            switch (message.command) {
                case 'sendToTerminal':
                    this.terminalBridge.sendToClaudeTerminal(message.text, true);
                    this.historyManager.addItem(message.text);
                    break;

                case 'getHistory':
                    const history = this.historyManager.getHistory();
                    webviewView.webview.postMessage({
                        command: 'historyData',
                        data: history
                    });
                    break;

                case 'clearHistory':
                    this.historyManager.clearHistory();
                    break;

                case 'getSlashCommands':
                    const query = message.query || '';
                    const commands = this.slashCommandManager.filterCommands(query);
                    webviewView.webview.postMessage({
                        command: 'slashCommandData',
                        data: commands
                    });
                    break;

                case 'getFileSuggestions':
                    const fileQuery = message.query || '';
                    const currentPath = message.currentPath || '';
                    console.log('getFileSuggestions:', { fileQuery, currentPath });
                    this.fileSearchManager.search(fileQuery, currentPath).then(suggestions => {
                        console.log('Search results:', suggestions.length);
                        webviewView.webview.postMessage({
                            command: 'fileSuggestionData',
                            data: suggestions
                        });
                    });
                    break;

                case 'quickStartClaude':
                    vscode.commands.executeCommand('claude-input-enhancer.quickStartClaude');
                    break;

                case 'openMainPanel':
                    vscode.commands.executeCommand('claude-input-enhancer.openInputPanel');
                    break;

                case 'getTerminalInfo':
                    const terminalInfo = this.terminalBridge.getTerminalInfo();
                    webviewView.webview.postMessage({
                        command: 'terminalInfo',
                        data: terminalInfo
                    });
                    break;
            }
        });
    }

    private getHtmlForWebview(webview: vscode.Webview): string {
        return `
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Claude Input</title>
            <style>
                body {
                    font-family: var(--vscode-font-family);
                    font-size: var(--vscode-font-size);
                    color: var(--vscode-foreground);
                    background: var(--vscode-sideBar-background);
                    margin: 0;
                    padding: 8px;
                    height: 100vh;
                    box-sizing: border-box;
                    display: flex;
                    flex-direction: column;
                }

                .header {
                    color: var(--vscode-foreground);
                    font-size: 12px;
                    margin-bottom: 8px;
                    font-weight: 600;
                    display: flex;
                    align-items: center;
                    gap: 4px;
                }

                #inputArea {
                    flex: 0 0 auto;
                    width: 100%;
                    min-height: 60px;
                    max-height: 200px;
                    background: var(--vscode-input-background);
                    border: 1px solid var(--vscode-input-border);
                    color: var(--vscode-input-foreground);
                    font-family: var(--vscode-editor-font-family, 'Consolas', 'Monaco', monospace);
                    font-size: 12px;
                    line-height: 1.4;
                    padding: 8px;
                    border-radius: 3px;
                    resize: none;
                    outline: none;
                    box-sizing: border-box;
                    overflow-y: auto;
                }

                #inputArea:focus {
                    border-color: var(--vscode-focusBorder);
                }

                #inputArea::placeholder {
                    color: var(--vscode-input-placeholderForeground);
                    font-style: italic;
                }

                .button-container {
                    display: flex;
                    gap: 4px;
                    margin-top: 8px;
                    flex-wrap: wrap;
                    justify-content: flex-end;
                }

                button {
                    background: var(--vscode-button-background);
                    color: var(--vscode-button-foreground);
                    border: none;
                    padding: 6px 10px;
                    border-radius: 3px;
                    cursor: pointer;
                    font-size: 11px;
                    font-family: var(--vscode-font-family);
                    transition: background-color 0.2s;
                }

                button:hover {
                    background: var(--vscode-button-hoverBackground);
                }

                .secondary-button {
                    background: var(--vscode-button-secondaryBackground);
                    color: var(--vscode-button-secondaryForeground);
                    font-size: 10px;
                    padding: 4px 6px;
                    flex: none;
                }

                .secondary-button:hover {
                    background: var(--vscode-button-secondaryHoverBackground);
                }

                .status {
                    margin-top: 6px;
                    font-size: 10px;
                    color: var(--vscode-descriptionForeground);
                    text-align: center;
                }

                .shortcut-hint {
                    font-size: 9px;
                    color: var(--vscode-descriptionForeground);
                    margin-top: 4px;
                    text-align: center;
                    opacity: 0.8;
                }

                kbd {
                    background: var(--vscode-keybindingLabel-background);
                    color: var(--vscode-keybindingLabel-foreground);
                    border: 1px solid var(--vscode-keybindingLabel-border);
                    border-radius: 2px;
                    padding: 1px 3px;
                    font-size: 9px;
                    font-family: monospace;
                }

                /* Slash Command Suggestions */
                .slash-suggestions {
                    display: none;
                    position: fixed;
                    background: var(--vscode-sideBar-background);
                    border: 1px solid var(--vscode-panel-border);
                    border-radius: 4px;
                    max-height: 400px;
                    overflow-y: auto;
                    z-index: 2147483647;
                    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.5);
                    min-width: 200px;
                }

                .slash-suggestions.active {
                    display: block;
                }

                .slash-suggestions.above {
                    bottom: auto;
                }

                .slash-suggestions.below {
                    top: auto;
                }

                .slash-suggestion-item {
                    padding: 8px 12px;
                    cursor: pointer;
                    border-left: 3px solid transparent;
                    transition: background-color 0.1s;
                }

                .slash-suggestion-item:hover,
                .slash-suggestion-item.selected {
                    background: var(--vscode-list-hoverBackground);
                    border-left-color: var(--vscode-focusBorder);
                }

                .slash-suggestion-name {
                    font-family: var(--vscode-editor-font-family, 'Consolas', 'Monaco', monospace);
                    font-weight: 600;
                    color: var(--vscode-foreground);
                    font-size: 12px;
                }

                .slash-suggestion-desc {
                    font-size: 10px;
                    color: var(--vscode-descriptionForeground);
                    margin-top: 2px;
                }

                .slash-suggestion-category {
                    font-size: 9px;
                    color: var(--vscode-descriptionForeground);
                    margin-top: 2px;
                    opacity: 0.7;
                }

                .slash-suggestions-empty {
                    padding: 12px;
                    text-align: center;
                    color: var(--vscode-descriptionForeground);
                    font-size: 11px;
                }

                .slash-suggestions-loading {
                    padding: 12px;
                    text-align: center;
                    color: var(--vscode-descriptionForeground);
                    font-size: 11px;
                    animation: pulse 1.5s ease-in-out infinite;
                }

                @keyframes pulse {
                    0%, 100% { opacity: 1; }
                    50% { opacity: 0.5; }
                }

                /* Improved button styles */
                .btn {
                    transition: all 0.15s ease;
                }

                .btn:hover {
                    transform: translateY(-1px);
                    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
                }

                .btn:active {
                    transform: translateY(0);
                }

                .btn:focus {
                    outline: 2px solid var(--vscode-focusBorder);
                    outline-offset: 2px;
                }

                /* Improved input focus */
                #inputArea:focus {
                    border-color: var(--vscode-focusBorder);
                    box-shadow: 0 0 0 1px var(--vscode-focusBorder);
                }

                /* Smooth transitions for suggestions */
                .slash-suggestions {
                    transition: opacity 0.15s ease, transform 0.15s ease;
                }

                .slash-suggestions:not(.active) {
                    opacity: 0;
                    pointer-events: none;
                }

                .slash-suggestions.active {
                    opacity: 1;
                }

                .input-wrapper {
                    position: relative;
                }
            </style>
        </head>
        <body>
            <div class="header">
                🤖 Claude Input
            </div>

            <div class="input-wrapper">
                <div id="slashSuggestions" class="slash-suggestions"></div>
                <textarea
                    id="inputArea"></textarea>
            </div>

            <div class="button-container">
                <button id="clearButton" class="secondary-button" title="Clear input">
                    Clear
                </button>
                <button id="historyButton" class="secondary-button" title="View history">
                    📜 History
                </button>
                <button id="quickStartButton" class="secondary-button" title="Quick start Claude">
                    🚀 Quick Start
                </button>
                <button id="sendButton" title="Send text to Claude terminal">
                    Send to Claude
                </button>
            </div>

            <div id="status" class="status"></div>

            <script>
                const vscode = acquireVsCodeApi();
                const inputArea = document.getElementById('inputArea');
                const sendButton = document.getElementById('sendButton');
                const clearButton = document.getElementById('clearButton');
                const historyButton = document.getElementById('historyButton');
                const quickStartButton = document.getElementById('quickStartButton');
                const statusDiv = document.getElementById('status');
                const slashSuggestions = document.getElementById('slashSuggestions');

                // Auto-focus the input area
                inputArea.focus();

                // Slash command state
                let slashCommands = [];
                let selectedSlashIndex = 0;
                let isSlashActive = false;
                let slashQueryStart = 0;

                // @ mention state
                let fileSuggestions = [];
                let selectedFileIndex = 0;
                let isFileActive = false;
                let fileQueryStart = 0;
                let currentFolderPath = '';

                // Auto-resize textarea based on content
                function autoResize() {
                    inputArea.style.height = 'auto';
                    const newHeight = Math.min(inputArea.scrollHeight, 200);
                    inputArea.style.height = newHeight + 'px';
                }

                // Auto-resize on input
                inputArea.addEventListener('input', autoResize);
                inputArea.addEventListener('keydown', autoResize);

                // Initial resize
                setTimeout(autoResize, 0);

                // Send functionality
                function sendText() {
                    const text = inputArea.value.trim();
                    if (!text) {
                        showStatus('Enter text to send', 'warning');
                        return;
                    }

                    vscode.postMessage({
                        command: 'sendToTerminal',
                        text: text
                    });

                    // Auto-clear after sending
                    inputArea.value = '';
                    autoResize();
                    inputArea.focus();
                    showStatus('Sent ✓', 'info');
                }

                // Clear functionality
                function clearInput() {
                    inputArea.value = '';
                    autoResize();
                    inputArea.focus();
                    showStatus('Cleared', 'info');
                }

                // Show status messages
                function showStatus(message, type = 'info') {
                    statusDiv.textContent = message;
                    statusDiv.style.color = type === 'warning' ? 'var(--vscode-editorWarning-foreground)' : 'var(--vscode-descriptionForeground)';

                    setTimeout(() => {
                        statusDiv.textContent = '';
                    }, 2000);
                }

                // Slash command detection
                function checkForSlashCommand() {
                    const cursorPos = inputArea.selectionStart;
                    const text = inputArea.value;

                    // Find the start of the current command (from last / to cursor)
                    let foundSlash = -1;
                    for (let i = cursorPos - 1; i >= 0; i--) {
                        if (text[i] === '/' || text[i] === '、') {
                            foundSlash = i;
                            break;
                        }
                        // Stop if we hit whitespace or newline (slash must be at start of line or after space)
                        if (text[i] === ' ' || text[i] === '\\n') {
                            break;
                        }
                    }

                    if (foundSlash !== -1) {
                        // Check if / is at start of line or after space
                        const beforeSlash = text[foundSlash - 1];
                        if (!beforeSlash || beforeSlash === ' ' || beforeSlash === '\\n') {
                            const query = text.substring(foundSlash + 1, cursorPos);
                            slashQueryStart = foundSlash;
                            showSlashSuggestions(query);
                            return;
                        }
                    }

                    hideSlashSuggestions();
                }

                function showSlashSuggestions(query) {
                    vscode.postMessage({
                        command: 'getSlashCommands',
                        query: query
                    });
                    isSlashActive = true;
                    selectedSlashIndex = 0;
                }

                function hideSlashSuggestions() {
                    slashSuggestions.classList.remove('active', 'above', 'below');
                    slashSuggestions.style.top = '';
                    slashSuggestions.style.bottom = '';
                    slashSuggestions.style.left = '';
                    slashSuggestions.innerHTML = '';
                    isSlashActive = false;
                    selectedSlashIndex = 0;
                }

                // @ mention detection
                function checkForAtMention() {
                    const cursorPos = inputArea.selectionStart;
                    const text = inputArea.value;

                    // Find the start of the current mention (from last @ to cursor)
                    let foundAt = -1;
                    for (let i = cursorPos - 1; i >= 0; i--) {
                        if (text[i] === '@') {
                            foundAt = i;
                            break;
                        }
                        // Stop if we hit whitespace or newline (@ must be at start of line or after space)
                        if (text[i] === ' ' || text[i] === '\\n') {
                            break;
                        }
                    }

                    if (foundAt !== -1) {
                        // Check if @ is at start of line or after space
                        const beforeAt = text[foundAt - 1];
                        if (!beforeAt || beforeAt === ' ' || beforeAt === '\\n') {
                            const query = text.substring(foundAt + 1, cursorPos);
                            fileQueryStart = foundAt;

                            // Check if this is folder navigation (ends with /)
                            if (query.endsWith('/')) {
                                currentFolderPath = query;
                            }

                            showFileSuggestions(query);
                            return;
                        }
                    }

                    hideFileSuggestions();
                }

                function showFileSuggestions(query) {
                    // Show loading state
                    showFileSuggestionsLoading();

                    vscode.postMessage({
                        command: 'getFileSuggestions',
                        query: query,
                        currentPath: currentFolderPath
                    });
                    isFileActive = true;
                    selectedFileIndex = 0;
                }

                function showFileSuggestionsLoading() {
                    slashSuggestions.innerHTML = '<div class="slash-suggestions-loading">🔍 Searching...</div>';
                    positionSlashSuggestions();
                    slashSuggestions.classList.add('active');
                }

                function hideFileSuggestions() {
                    slashSuggestions.classList.remove('active', 'above', 'below');
                    slashSuggestions.style.top = '';
                    slashSuggestions.style.bottom = '';
                    slashSuggestions.style.left = '';
                    slashSuggestions.innerHTML = '';
                    isFileActive = false;
                    selectedFileIndex = 0;
                    currentFolderPath = '';
                }

                function positionSlashSuggestions() {
                    const inputRect = inputArea.getBoundingClientRect();
                    const viewportHeight = window.innerHeight;

                    // Calculate available space above and below
                    const spaceAbove = inputRect.top;
                    const spaceBelow = viewportHeight - inputRect.bottom;

                    // Height configuration - increased for better visibility
                    const minHeight = 200;
                    const maxHeight = 400;

                    // Position based on available space
                    if (spaceAbove > spaceBelow) {
                        // Show above (more space above)
                        slashSuggestions.classList.add('above');
                        slashSuggestions.classList.remove('below');
                        slashSuggestions.style.bottom = (viewportHeight - inputRect.top) + 'px';
                        // Calculate height based on available space above
                        slashSuggestions.style.maxHeight = Math.min(Math.max(spaceAbove - 20, minHeight), maxHeight) + 'px';
                    } else {
                        // Show below (more space below)
                        slashSuggestions.classList.add('below');
                        slashSuggestions.classList.remove('above');
                        slashSuggestions.style.top = inputRect.bottom + 'px';
                        // Calculate height based on available space below
                        slashSuggestions.style.maxHeight = Math.min(Math.max(spaceBelow - 20, minHeight), maxHeight) + 'px';
                    }

                    // Set left position and width
                    slashSuggestions.style.left = inputRect.left + 'px';
                    slashSuggestions.style.minWidth = inputRect.width + 'px';
                }

                function renderSlashSuggestions(commands) {
                    if (!commands || commands.length === 0) {
                        slashSuggestions.innerHTML = '<div class="slash-suggestions-empty">No commands found</div>';
                    } else {
                        slashSuggestions.innerHTML = commands.map((cmd, index) => \`
                            <div class="slash-suggestion-item \${index === 0 ? 'selected' : ''}" data-index="\${index}" data-command="\${cmd.name}">
                                <div class="slash-suggestion-name">/\${escapeHtml(cmd.name)}</div>
                                <div class="slash-suggestion-desc">\${escapeHtml(cmd.description)}</div>
                                \${cmd.category ? \`<div class="slash-suggestion-category">\${escapeHtml(cmd.category)}</div>\` : ''}
                            </div>
                        \`).join('');

                        // Add click handlers
                        slashSuggestions.querySelectorAll('.slash-suggestion-item').forEach(item => {
                            item.addEventListener('click', () => {
                                insertSlashCommand(item.dataset.command);
                            });
                        });
                    }

                    // Position the suggestions
                    positionSlashSuggestions();

                    slashSuggestions.classList.add('active');
                }

                function insertSlashCommand(command) {
                    const text = inputArea.value;
                    const before = text.substring(0, slashQueryStart);
                    const after = text.substring(inputArea.selectionStart);

                    // Insert with / prefix (command from manager doesn't include /)
                    // slashQueryStart points to / position, so we need to add / before command
                    inputArea.value = before + '/' + command + ' ' + after;

                    // Move cursor after command (including the / and space we added)
                    const newPos = slashQueryStart + command.length + 2;
                    inputArea.setSelectionRange(newPos, newPos);

                    hideSlashSuggestions();
                    autoResize();
                    inputArea.focus();
                }

                function updateSelectedSlashSuggestion() {
                    const items = slashSuggestions.querySelectorAll('.slash-suggestion-item');
                    items.forEach((item, index) => {
                        if (index === selectedSlashIndex) {
                            item.classList.add('selected');
                            item.scrollIntoView({ block: 'nearest' });
                        } else {
                            item.classList.remove('selected');
                        }
                    });
                }

                function renderFileSuggestions(suggestions) {
                    if (!suggestions || suggestions.length === 0) {
                        slashSuggestions.innerHTML = '<div class="slash-suggestions-empty">No files found</div>';
                    } else {
                        slashSuggestions.innerHTML = suggestions.map((item, index) => \`
                            <div class="slash-suggestion-item \${index === 0 ? 'selected' : ''}" data-index="\${index}" data-path="\${item.relativePath}" data-type="\${item.type}">
                                <div class="slash-suggestion-name">\${item.icon || ''} \${escapeHtml(item.name)}</div>
                                <div class="slash-suggestion-desc">\${escapeHtml(item.relativePath)}</div>
                            </div>
                        \`).join('');

                        // Add click handlers
                        slashSuggestions.querySelectorAll('.slash-suggestion-item').forEach(suggestionItem => {
                            suggestionItem.addEventListener('click', () => {
                                const path = suggestionItem.dataset.path;
                                const type = suggestionItem.dataset.type;
                                insertFileMention(path, type === 'folder');
                            });
                        });
                    }

                    // Position the suggestions
                    positionSlashSuggestions();

                    slashSuggestions.classList.add('active');
                }

                function insertFileMention(path, isFolder) {
                    const text = inputArea.value;
                    const before = text.substring(0, fileQueryStart);
                    const after = text.substring(inputArea.selectionStart);

                    // Insert @ with path, add / after folders for navigation
                    const insertText = isFolder ? '@' + path + '/' : '@' + path;
                    inputArea.value = before + insertText + ' ' + after;

                    // Move cursor after insertion
                    const newPos = fileQueryStart + insertText.length + 1;
                    inputArea.setSelectionRange(newPos, newPos);

                    // If it's a folder, trigger navigation
                    if (isFolder) {
                        currentFolderPath = path + '/';
                        checkForAtMention();
                    } else {
                        hideFileSuggestions();
                    }

                    autoResize();
                    inputArea.focus();
                }

                function updateSelectedFileSuggestion() {
                    const items = slashSuggestions.querySelectorAll('.slash-suggestion-item');
                    items.forEach((item, index) => {
                        if (index === selectedFileIndex) {
                            item.classList.add('selected');
                            item.scrollIntoView({ block: 'nearest' });
                        } else {
                            item.classList.remove('selected');
                        }
                    });
                }

                // Open Main Panel (instead of history popup)
                function openHistory() {
                    vscode.postMessage({ command: 'openMainPanel' });
                }

                function escapeHtml(text) {
                    const div = document.createElement('div');
                    div.textContent = text;
                    return div.innerHTML;
                }

                // Quick Start function
                function quickStartClaude() {
                    vscode.postMessage({
                        command: 'quickStartClaude'
                    });
                    showStatus('Starting Claude...', 'info');
                }

                // Event listeners
                sendButton.addEventListener('click', sendText);
                clearButton.addEventListener('click', clearInput);
                historyButton.addEventListener('click', openHistory);
                quickStartButton.addEventListener('click', quickStartClaude);

                // Close popup on Escape
                document.addEventListener('keydown', (e) => {
                    if (e.key === 'Escape') {
                        if (isSlashActive) {
                            hideSlashSuggestions();
                        } else if (isFileActive) {
                            hideFileSuggestions();
                        }
                    }
                });

                // Keyboard shortcuts
                inputArea.addEventListener('keydown', (e) => {
                    // Handle file mention navigation
                    if (isFileActive) {
                        const items = slashSuggestions.querySelectorAll('.slash-suggestion-item');

                        if (e.key === 'ArrowDown') {
                            e.preventDefault();
                            selectedFileIndex = Math.min(selectedFileIndex + 1, items.length - 1);
                            updateSelectedFileSuggestion();
                            return;
                        }

                        if (e.key === 'ArrowUp') {
                            e.preventDefault();
                            selectedFileIndex = Math.max(selectedFileIndex - 1, 0);
                            updateSelectedFileSuggestion();
                            return;
                        }

                        if (e.key === 'Enter') {
                            e.preventDefault();
                            const selected = items[selectedFileIndex];
                            if (selected) {
                                const path = selected.dataset.path;
                                const type = selected.dataset.type;
                                insertFileMention(path, type === 'folder');
                            }
                            return;
                        }

                        if (e.key === 'Tab') {
                            e.preventDefault();
                            const selected = items[selectedFileIndex];
                            if (selected) {
                                const path = selected.dataset.path;
                                const type = selected.dataset.type;
                                insertFileMention(path, type === 'folder');
                            }
                            return;
                        }
                    }

                    // Handle slash command navigation
                    if (isSlashActive) {
                        const items = slashSuggestions.querySelectorAll('.slash-suggestion-item');

                        if (e.key === 'ArrowDown') {
                            e.preventDefault();
                            selectedSlashIndex = Math.min(selectedSlashIndex + 1, items.length - 1);
                            updateSelectedSlashSuggestion();
                            return;
                        }

                        if (e.key === 'ArrowUp') {
                            e.preventDefault();
                            selectedSlashIndex = Math.max(selectedSlashIndex - 1, 0);
                            updateSelectedSlashSuggestion();
                            return;
                        }

                        if (e.key === 'Enter') {
                            e.preventDefault();
                            const selected = items[selectedSlashIndex];
                            if (selected) {
                                insertSlashCommand(selected.dataset.command);
                            }
                            return;
                        }

                        if (e.key === 'Tab') {
                            e.preventDefault();
                            const selected = items[selectedSlashIndex];
                            if (selected) {
                                insertSlashCommand(selected.dataset.command);
                            }
                            return;
                        }
                    }

                    // Enter sends to terminal
                    if (e.key === 'Enter' && !e.shiftKey && !e.ctrlKey && !e.metaKey) {
                        e.preventDefault();
                        sendText();
                    }
                    // Shift+Enter or Ctrl+Enter for new line
                    // Allow default behavior
                });

                // Input handler for slash command detection
                inputArea.addEventListener('input', () => {
                    checkForSlashCommand();
                    checkForAtMention();
                });

                // Handle messages from extension
                window.addEventListener('message', event => {
                    const message = event.data;
                    switch (message.command) {
                        case 'clearInput':
                            clearInput();
                            break;
                        case 'historyData':
                            renderHistory(message.data);
                            break;
                        case 'slashCommandData':
                            renderSlashSuggestions(message.data);
                            break;
                        case 'fileSuggestionData':
                            renderFileSuggestions(message.data);
                            break;
                        case 'terminalInfo':
                            console.log('Terminal Debug Info:', message.data);
                            break;
                    }
                });

                // Restore state
                const state = vscode.getState();
                if (state && state.inputValue) {
                    inputArea.value = state.inputValue;
                }

                // Save state on input change
                inputArea.addEventListener('input', () => {
                    vscode.setState({ inputValue: inputArea.value });
                });
            </script>
        </body>
        </html>
        `;
    }
}
