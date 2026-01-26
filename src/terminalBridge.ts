import * as vscode from 'vscode';

export class TerminalBridge {
    
    /**
     * Find the active Claude Code terminal
     */
    private findClaudeTerminal(): vscode.Terminal | undefined {
        // First try the active terminal
        if (this.isClaudeTerminal(vscode.window.activeTerminal)) {
            return vscode.window.activeTerminal;
        }

        // Then search through all terminals
        for (const terminal of vscode.window.terminals) {
            if (this.isClaudeTerminal(terminal)) {
                return terminal;
            }
        }

        return undefined;
    }

    /**
     * Check if a terminal is running Claude Code
     */
    private isClaudeTerminal(terminal: vscode.Terminal | undefined): boolean {
        if (!terminal) {
            return false;
        }

        // Check terminal name for common Claude Code patterns
        const name = terminal.name.toLowerCase();
        return name.includes('claude') || 
               name.includes('claude-code') ||
               name.includes('ai') ||
               // Fallback: check if it's a shell that might be running Claude
               (name.includes('bash') || name.includes('zsh') || name.includes('powershell'));
    }

    /**
     * Send text to Claude Code terminal
     * @param text The text to send
     * @param autoEnter If true, automatically sends Enter key after text
     */
    public sendToClaudeTerminal(text: string, autoEnter: boolean = false): boolean {
        const claudeTerminal = this.findClaudeTerminal();

        if (!claudeTerminal) {
            vscode.window.showWarningMessage(
                'No Claude Code terminal found. Please make sure Claude Code is running in a terminal.'
            );
            return false;
        }

        // Send text without auto-enter
        claudeTerminal.sendText(text, false);

        // If autoEnter is requested, send Enter key separately with a small delay
        // This helps ensure the terminal has processed the text before receiving Enter
        if (autoEnter) {
            setTimeout(() => {
                claudeTerminal?.sendText('\n', false);
            }, 50);
        }

        // Focus the terminal so user can see the result
        claudeTerminal.show();

        return true;
    }

    /**
     * Get all available terminals for debugging
     */
    public getTerminalInfo(): string[] {
        return vscode.window.terminals.map(terminal => 
            `Name: ${terminal.name}, CreationOptions: ${JSON.stringify(terminal.creationOptions)}`
        );
    }
}
