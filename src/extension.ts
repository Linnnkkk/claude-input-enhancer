import * as vscode from 'vscode';
import { ClaudeInputPanel } from './inputPanel';
import { TerminalBridge } from './terminalBridge';
import { ClaudeInputViewProvider } from './terminalView';
import { HistoryManager } from './historyManager';
import { SlashCommandManager } from './slashCommandManager';
import { FileSearchManager } from './fileSearchManager';

export function activate(context: vscode.ExtensionContext) {
    console.log('Claude Input Enhancer extension is now active');

    const terminalBridge = new TerminalBridge();
    const historyManager = new HistoryManager(context);
    const slashCommandManager = new SlashCommandManager();
    const fileSearchManager = new FileSearchManager();
    let inputPanel: ClaudeInputPanel | undefined;

    // Register the terminal view provider
    const terminalViewProvider = new ClaudeInputViewProvider(
        context.extensionUri,
        terminalBridge,
        historyManager,
        slashCommandManager,
        fileSearchManager
    );
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
                inputPanel = new ClaudeInputPanel(
                    context.extensionUri,
                    terminalBridge,
                    historyManager,
                    slashCommandManager,
                    fileSearchManager
                );
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

    // Command: Quick Start Claude
    const quickStartCommand = vscode.commands.registerCommand(
        'claude-input-enhancer.quickStartClaude',
        async () => {
            await quickStartClaude(terminalViewProvider);
        }
    );

    context.subscriptions.push(
        openPanelCommand,
        sendToTerminalCommand,
        quickStartCommand
    );

    // Cleanup when extension is deactivated
    context.subscriptions.push({
        dispose() {
            inputPanel?.dispose();
        }
    });
}

/**
 * Quick Start Claude function
 * 1. Opens a terminal
 * 2. Runs "claude --dangerously-skip-permissions"
 * 3. Moves terminal to right sidebar
 * 4. Moves plugin sidebar below terminal
 */
async function quickStartClaude(terminalViewProvider: ClaudeInputViewProvider): Promise<void> {
    try {
        // Step 1: Create a new terminal
        const terminal = vscode.window.createTerminal('Claude');
        terminal.show();

        // Wait a bit for terminal to be ready
        await sleep(500);

        // Step 2: Send the claude command
        terminal.sendText('claude --dangerously-skip-permissions');

        // Wait for command to start
        await sleep(1000);

        // Step 3: Move terminal to right sidebar (Auxiliary sidebar)
        // Note: VS Code API doesn't directly support moving terminals to sidebar
        // We need to use vscode.window.activeTerminal and suggest user to drag it
        // However, we can try to execute a command to move it

        // Show information message about manual step
        vscode.window.showInformationMessage(
            'Claude started! Please drag the terminal to the right sidebar, then drag this extension panel below it.'
        );

    } catch (error) {
        vscode.window.showErrorMessage(`Failed to start Claude: ${error}`);
    }
}

/**
 * Sleep utility for delays
 */
function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

export function deactivate() {
    console.log('Claude Input Enhancer extension deactivated');
}
