import * as vscode from 'vscode';
import { ClaudeInputPanel } from './inputPanel';
import { TerminalBridge } from './terminalBridge';
import { ClaudeInputViewProvider } from './terminalView';

export function activate(context: vscode.ExtensionContext) {
    console.log('Claude Input Enhancer extension is now active');
    
    const terminalBridge = new TerminalBridge();
    let inputPanel: ClaudeInputPanel | undefined;

    // Register the terminal view provider
    const terminalViewProvider = new ClaudeInputViewProvider(context.extensionUri, terminalBridge);
    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider(
            ClaudeInputViewProvider.viewType,
            terminalViewProvider
        )
    );

    // Command: Open Claude Input Panel (fallback for standalone panel)
    const openPanelCommand = vscode.commands.registerCommand(
        'claude-input-enhancer.openInputPanel', 
        () => {
            if (!inputPanel) {
                inputPanel = new ClaudeInputPanel(context.extensionUri, terminalBridge);
            }
            inputPanel.show();
        }
    );

    // Command: Send to Claude Terminal
    const sendToTerminalCommand = vscode.commands.registerCommand(
        'claude-input-enhancer.sendToClaudeTerminal',
        (text: string) => {
            terminalBridge.sendToClaudeTerminal(text);
        }
    );

    context.subscriptions.push(
        openPanelCommand,
        sendToTerminalCommand
    );

    // Cleanup when extension is deactivated
    context.subscriptions.push({
        dispose() {
            inputPanel?.dispose();
        }
    });
}

export function deactivate() {
    console.log('Claude Input Enhancer extension deactivated');
}