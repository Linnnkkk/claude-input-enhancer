import * as vscode from 'vscode';
import { TerminalBridge } from './terminalBridge';

export class ClaudeInputPanel {
    private panel?: vscode.WebviewPanel;
    private disposables: vscode.Disposable[] = [];

    constructor(
        private readonly extensionUri: vscode.Uri,
        private readonly terminalBridge: TerminalBridge
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
                        const success = this.terminalBridge.sendToClaudeTerminal(message.text);
                        
                        // Clear input if configured to do so
                        const config = vscode.workspace.getConfiguration('claudeInputEnhancer');
                        const clearAfterSend = config.get<boolean>('clearAfterSend', false);
                        
                        if (success && clearAfterSend) {
                            this.panel?.webview.postMessage({ 
                                command: 'clearInput' 
                            });
                        }
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
                
                #inputArea {
                    flex: 1;
                    width: 100%;
                    min-height: 200px;
                    background: var(--vscode-input-background);
                    border: 1px solid var(--vscode-input-border);
                    color: var(--vscode-input-foreground);
                    font-family: var(--vscode-editor-font-family, 'Consolas', 'Monaco', monospace);
                    font-size: var(--vscode-editor-font-size, 14px);
                    line-height: 1.5;
                    padding: 12px;
                    border-radius: 4px;
                    resize: vertical;
                    outline: none;
                    box-sizing: border-box;
                }
                
                #inputArea:focus {
                    border-color: var(--vscode-focusBorder);
                }
                
                .button-container {
                    display: flex;
                    gap: 8px;
                    margin-top: 16px;
                    flex-wrap: wrap;
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
            
            <textarea 
                id="inputArea" 
                placeholder="Type your message for Claude here...&#10;&#10;• Use Ctrl+Enter (Cmd+Enter on Mac) to send&#10;• Full text editing capabilities&#10;• Multi-line support"></textarea>
            
            <div class="button-container">
                <button id="sendButton" title="Send text to Claude terminal">
                    Send to Claude
                </button>
                <button id="clearButton" class="secondary-button" title="Clear the input area">
                    Clear
                </button>
                <button id="debugButton" class="secondary-button" title="Show terminal debug info">
                    Debug Info
                </button>
            </div>
            
            <div class="shortcut-hint">
                💡 Tip: Press <kbd>Ctrl+Enter</kbd> (<kbd>Cmd+Enter</kbd> on Mac) to send quickly
            </div>
            
            <div id="status" class="status"></div>

            <script>
                const vscode = acquireVsCodeApi();
                const inputArea = document.getElementById('inputArea');
                const sendButton = document.getElementById('sendButton');
                const clearButton = document.getElementById('clearButton');
                const debugButton = document.getElementById('debugButton');
                const statusDiv = document.getElementById('status');

                // Auto-focus the input area
                inputArea.focus();

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
                    
                    showStatus('Sent to Claude terminal', 'info');
                }

                // Clear functionality
                function clearInput() {
                    inputArea.value = '';
                    inputArea.focus();
                    showStatus('Input cleared', 'info');
                }

                // Debug info functionality
                function showDebugInfo() {
                    vscode.postMessage({
                        command: 'getTerminalInfo'
                    });
                }

                // Show status messages
                function showStatus(message, type = 'info') {
                    statusDiv.textContent = message;
                    statusDiv.style.color = type === 'warning' ? 'var(--vscode-editorWarning-foreground)' : 'var(--vscode-descriptionForeground)';
                    
                    setTimeout(() => {
                        statusDiv.textContent = '';
                    }, 3000);
                }

                // Event listeners
                sendButton.addEventListener('click', sendText);
                clearButton.addEventListener('click', clearInput);
                debugButton.addEventListener('click', showDebugInfo);

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
                            const info = message.data.join('\\n');
                            showStatus('Terminal Info:\\n' + info, 'info');
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