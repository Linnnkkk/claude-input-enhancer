import * as vscode from 'vscode';
import { TerminalBridge } from './terminalBridge';
import { HistoryManager } from './historyManager';
import { SlashCommandManager } from './slashCommandManager';
import { FileSearchManager } from './fileSearchManager';

export class ClaudeInputPanel {
    private panel?: vscode.WebviewPanel;
    private disposables: vscode.Disposable[] = [];

    constructor(
        private readonly extensionUri: vscode.Uri,
        private readonly terminalBridge: TerminalBridge,
        private readonly historyManager: HistoryManager,
        private readonly slashCommandManager: SlashCommandManager,
        private readonly fileSearchManager: FileSearchManager
    ) {}

    public show(): void {
        const column = vscode.ViewColumn.Beside;

        if (this.panel) {
            this.panel.reveal(column);
            return;
        }

        this.panel = vscode.window.createWebviewPanel(
            'claudeInputPanel',
            'Claude Input',
            column,
            {
                enableScripts: true,
                retainContextWhenHidden: true,
                localResourceRoots: [this.extensionUri]
            }
        );

        this.panel.webview.html = this.getWebviewContent();
        this.setupWebviewMessageHandling();

        this.panel.onDidDispose(
            () => {
                this.panel = undefined;
                this.dispose();
            },
            null,
            this.disposables
        );
    }

    private setupWebviewMessageHandling(): void {
        if (!this.panel) return;

        this.panel.webview.onDidReceiveMessage(
            (message) => {
                switch (message.command) {
                    case 'sendToTerminal':
                        this.terminalBridge.sendToClaudeTerminal(message.text, true);
                        this.historyManager.addItem(message.text);
                        break;

                    case 'getHistory':
                        const history = this.historyManager.getRecent(10);
                        this.panel?.webview.postMessage({
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
                        this.panel?.webview.postMessage({
                            command: 'slashCommandData',
                            data: commands
                        });
                        break;

                    case 'getFileSuggestions':
                        const fileQuery = message.query || '';
                        const currentPath = message.currentPath || '';
                        this.fileSearchManager.search(fileQuery, currentPath).then(suggestions => {
                            this.panel?.webview.postMessage({
                                command: 'fileSuggestionData',
                                data: suggestions
                            });
                        });
                        break;

                    case 'getTerminalInfo':
                        const terminalInfo = this.terminalBridge.getTerminalInfo();
                        this.panel?.webview.postMessage({
                            command: 'terminalInfo',
                            data: terminalInfo
                        });
                        break;
                }
            },
            undefined,
            this.disposables
        );
    }

    private getWebviewContent(): string {
        return `
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Claude Input Panel</title>
            <style>
                body {
                    font-family: var(--vscode-font-family);
                    font-size: var(--vscode-font-size);
                    color: var(--vscode-foreground);
                    background: var(--vscode-editor-background);
                    margin: 0;
                    padding: 16px;
                    height: 100vh;
                    box-sizing: border-box;
                    display: flex;
                    flex-direction: column;
                }

                h1 {
                    color: var(--vscode-foreground);
                    font-size: 18px;
                    margin: 0 0 16px 0;
                    font-weight: 600;
                }

                /* Inline History Styles */
                .history-section {
                    margin-bottom: 12px;
                }

                .history-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 8px;
                }

                .history-title {
                    font-size: 12px;
                    font-weight: 600;
                    color: var(--vscode-foreground);
                }

                .history-actions {
                    display: flex;
                    gap: 4px;
                }

                .history-list {
                    display: flex;
                    flex-wrap: wrap;
                    gap: 6px;
                }

                .history-item {
                    background: var(--vscode-editor-selectionBackground);
                    color: var(--vscode-foreground);
                    padding: 6px 10px;
                    border-radius: 4px;
                    cursor: pointer;
                    font-family: var(--vscode-editor-font-family, 'Consolas', 'Monaco', monospace);
                    font-size: 11px;
                    transition: background-color 0.15s;
                }

                .history-item:hover {
                    background: var(--vscode-list-hoverBackground);
                }

                .history-empty {
                    font-size: 12px;
                    color: var(--vscode-descriptionForeground);
                    padding: 8px 0;
                    font-style: italic;
                }

                /* Slash Command Suggestions */
                .slash-suggestions {
                    display: none;
                    position: fixed;
                    background: var(--vscode-editor-background);
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
                    font-size: 11px;
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

                #inputArea {
                    flex: 0 0 auto;
                    width: 100%;
                    min-height: 60px;
                    max-height: 200px;
                    background: var(--vscode-input-background);
                    border: 1px solid var(--vscode-input-border);
                    color: var(--vscode-input-foreground);
                    font-family: var(--vscode-editor-font-family, 'Consolas', 'Monaco', monospace);
                    font-size: var(--vscode-editor-font-size, 14px);
                    line-height: 1.5;
                    padding: 12px;
                    border-radius: 4px;
                    resize: none;
                    outline: none;
                    box-sizing: border-box;
                    overflow-y: auto;
                }

                #inputArea:focus {
                    border-color: var(--vscode-focusBorder);
                }

                .button-container {
                    display: flex;
                    gap: 8px;
                    margin-top: 16px;
                    flex-wrap: wrap;
                    justify-content: flex-end;
                }

                button {
                    background: var(--vscode-button-background);
                    color: var(--vscode-button-foreground);
                    border: none;
                    padding: 8px 16px;
                    border-radius: 4px;
                    cursor: pointer;
                    font-size: 13px;
                    font-family: var(--vscode-font-family);
                    transition: background-color 0.2s;
                }

                button:hover {
                    background: var(--vscode-button-hoverBackground);
                }

                .secondary-button {
                    background: var(--vscode-button-secondaryBackground);
                    color: var(--vscode-button-secondaryForeground);
                    font-size: 11px;
                    padding: 6px 12px;
                }

                .secondary-button:hover {
                    background: var(--vscode-button-secondaryHoverBackground);
                }

                .status {
                    margin-top: 8px;
                    font-size: 12px;
                    color: var(--vscode-descriptionForeground);
                }

                .shortcut-hint {
                    font-size: 11px;
                    color: var(--vscode-descriptionForeground);
                    margin-top: 4px;
                }
            </style>
        </head>
        <body>
            <h1>🤖 Claude Input Panel</h1>

            <!-- Inline History Section -->
            <div class="history-section">
                <div class="history-header">
                    <span class="history-title">📜 Recent History</span>
                    <div class="history-actions">
                        <button id="clearHistoryButton" class="secondary-button" title="Clear all history">
                            Clear
                        </button>
                    </div>
                </div>
                <div id="historyList" class="history-list">
                    <div class="history-empty">Loading history...</div>
                </div>
            </div>

            <div class="input-wrapper">
                <div id="slashSuggestions" class="slash-suggestions"></div>
                <textarea
                    id="inputArea"></textarea>
            </div>

            <div class="button-container">
                <button id="clearButton" class="secondary-button" title="Clear the input area">
                    Clear
                </button>
                <button id="debugButton" class="secondary-button" title="Show terminal debug info">
                    Debug Info
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
                const debugButton = document.getElementById('debugButton');
                const clearHistoryButton = document.getElementById('clearHistoryButton');
                const historyList = document.getElementById('historyList');
                const statusDiv = document.getElementById('status');
                const slashSuggestions = document.getElementById('slashSuggestions');

                // Auto-focus the input area
                inputArea.focus();

                // Slash command state
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

                // Load history on startup
                vscode.postMessage({ command: 'getHistory' });

                // Send functionality
                function sendText() {
                    const text = inputArea.value.trim();
                    if (!text) {
                        showStatus('Please enter some text to send.', 'warning');
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
                    showStatus('Sent to Claude terminal', 'info');

                    // Refresh history
                    setTimeout(() => {
                        vscode.postMessage({ command: 'getHistory' });
                    }, 100);
                }

                // Clear functionality
                function clearInput() {
                    inputArea.value = '';
                    autoResize();
                    inputArea.focus();
                    showStatus('Input cleared', 'info');
                }

                // Debug info functionality
                function showDebugInfo() {
                    vscode.postMessage({
                        command: 'getTerminalInfo'
                    });
                }

                // Clear history functionality
                function clearHistory() {
                    if (confirm('Clear all history?')) {
                        vscode.postMessage({ command: 'clearHistory' });
                        renderHistory([]);
                        showStatus('History cleared', 'info');
                    }
                }

                // Show status messages
                function showStatus(message, type = 'info') {
                    statusDiv.textContent = message;
                    statusDiv.style.color = type === 'warning' ? 'var(--vscode-editorWarning-foreground)' : 'var(--vscode-descriptionForeground)';

                    setTimeout(() => {
                        statusDiv.textContent = '';
                    }, 3000);
                }

                // Render inline history
                function renderHistory(history) {
                    if (!history || history.length === 0) {
                        historyList.innerHTML = '<div class="history-empty">No history yet. Send some messages!</div>';
                        return;
                    }

                    historyList.innerHTML = history.slice().reverse().map(item => \`
                        <div class="history-item" title="\${escapeHtml(item.text)}" data-text="\${encodeURIComponent(item.text)}">
                            \${escapeHtml(item.text)}
                        </div>
                    \`).join('');

                    // Add click handlers
                    historyList.querySelectorAll('.history-item').forEach(item => {
                        item.addEventListener('click', () => {
                            const text = decodeURIComponent(item.dataset.text);
                            inputArea.value = text;
                            autoResize();
                            inputArea.focus();
                            showStatus('Inserted from history', 'info');
                        });
                    });
                }

                function escapeHtml(text) {
                    const div = document.createElement('div');
                    div.textContent = text;
                    return div.innerHTML;
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
                    if (spaceAbove > spaceBelow || spaceBelow < 200) {
                        // Show above (more space above or not enough space below)
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

                // Event listeners
                sendButton.addEventListener('click', sendText);
                clearButton.addEventListener('click', clearInput);
                debugButton.addEventListener('click', showDebugInfo);
                clearHistoryButton.addEventListener('click', clearHistory);

                // Close on Escape
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
                            const info = message.data.join('\\\\n');
                            showStatus('Terminal Info:\\\\n' + info, 'info');
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

    public dispose(): void {
        this.panel?.dispose();
        while (this.disposables.length) {
            const disposable = this.disposables.pop();
            if (disposable) {
                disposable.dispose();
            }
        }
    }
}
