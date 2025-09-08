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
     */
    public sendToClaudeTerminal(text: string): boolean {
        const claudeTerminal = this.findClaudeTerminal();
        
        if (!claudeTerminal) {
            vscode.window.showWarningMessage(
                'No Claude Code terminal found. Please make sure Claude Code is running in a terminal.'
            );
            return false;
        }

        // Send the text to the terminal
        claudeTerminal.sendText(text, false); // false = don't add newline, let user control that
        
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