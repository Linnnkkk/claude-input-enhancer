import * as vscode from 'vscode';
import { TerminalBridge } from './terminalBridge';

export class ClaudeInputViewProvider implements vscode.WebviewViewProvider {
    public static readonly viewType = 'claudeInputView';

    constructor(
        private readonly extensionUri: vscode.Uri,
        private readonly terminalBridge: TerminalBridge
    ) {}

    public resolveWebviewView(
        webviewView: vscode.WebviewView,
        context: vscode.WebviewViewResolveContext,
        token: vscode.CancellationToken,
    ) {
        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [this.extensionUri]
        };

        webviewView.webview.html = this.getHtmlForWebview(webviewView.webview);

        // Handle messages from the webview
        webviewView.webview.onDidReceiveMessage((message) => {
            switch (message.command) {
                case 'sendToTerminal':
                    const success = this.terminalBridge.sendToClaudeTerminal(message.text);
                    
                    // Clear input if configured to do so
                    const config = vscode.workspace.getConfiguration('claudeInputEnhancer');
                    const clearAfterSend = config.get<boolean>('clearAfterSend', false);
                    
                    if (success && clearAfterSend) {
                        webviewView.webview.postMessage({ 
                            command: 'clearInput' 
                        });
                    }
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
                    flex: 1;
                    width: 100%;
                    min-height: 120px;
                    max-height: 300px;
                    background: var(--vscode-input-background);
                    border: 1px solid var(--vscode-input-border);
                    color: var(--vscode-input-foreground);
                    font-family: var(--vscode-editor-font-family, 'Consolas', 'Monaco', monospace);
                    font-size: 12px;
                    line-height: 1.4;
                    padding: 8px;
                    border-radius: 3px;
                    resize: vertical;
                    outline: none;
                    box-sizing: border-box;
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
                    flex: 1;
                    min-width: 0;
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
            </style>
        </head>
        <body>
            <div class="header">
                🤖 Claude Input
            </div>
            
            <textarea 
                id="inputArea" 
                placeholder="Type your message for Claude here...

Use Ctrl+Enter to send quickly"></textarea>
            
            <div class="button-container">
                <button id="sendButton" title="Send text to Claude terminal">
                    Send to Claude
                </button>
                <button id="clearButton" class="secondary-button" title="Clear input">
                    Clear
                </button>
            </div>
            
            <div class="shortcut-hint">
                <kbd>Ctrl+Enter</kbd> to send
            </div>
            
            <div id="status" class="status"></div>

            <script>
                const vscode = acquireVsCodeApi();
                const inputArea = document.getElementById('inputArea');
                const sendButton = document.getElementById('sendButton');
                const clearButton = document.getElementById('clearButton');
                const statusDiv = document.getElementById('status');

                // Auto-focus the input area
                inputArea.focus();

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
                    
                    showStatus('Sent ✓', 'info');
                }

                // Clear functionality
                function clearInput() {
                    inputArea.value = '';
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

                // Event listeners
                sendButton.addEventListener('click', sendText);
                clearButton.addEventListener('click', clearInput);

                // Keyboard shortcuts
                inputArea.addEventListener('keydown', (e) => {
                    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                        e.preventDefault();
                        sendText();
                    }
                });

                // Handle messages from extension
                window.addEventListener('message', event => {
                    const message = event.data;
                    switch (message.command) {
                        case 'clearInput':
                            clearInput();
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