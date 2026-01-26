import * as vscode from 'vscode';

export interface HistoryItem {
    text: string;
    timestamp: number;
}

export class HistoryManager {
    private static readonly MAX_HISTORY = 50;
    private static readonly STORAGE_KEY = 'claudeInputHistory';

    private history: HistoryItem[] = [];

    constructor(private context: vscode.ExtensionContext) {
        this.loadHistory();
    }

    /**
     * Load history from persistent storage
     */
    private loadHistory(): void {
        const stored = this.context.globalState.get<HistoryItem[]>(HistoryManager.STORAGE_KEY, []);
        this.history = stored;
    }

    /**
     * Save history to persistent storage
     */
    private saveHistory(): void {
        this.context.globalState.update(HistoryManager.STORAGE_KEY, this.history);
    }

    /**
     * Add a new item to history
     */
    public addItem(text: string): void {
        const trimmed = text.trim();
        if (!trimmed) {
            return;
        }

        // Remove duplicate if exists
        this.history = this.history.filter(item => item.text !== trimmed);

        // Add to front
        this.history.unshift({
            text: trimmed,
            timestamp: Date.now()
        });

        // Limit history size
        if (this.history.length > HistoryManager.MAX_HISTORY) {
            this.history = this.history.slice(0, HistoryManager.MAX_HISTORY);
        }

        this.saveHistory();
    }

    /**
     * Get all history items
     */
    public getHistory(): HistoryItem[] {
        return [...this.history];
    }

    /**
     * Get recent N items
     */
    public getRecent(count: number): HistoryItem[] {
        return this.history.slice(0, count);
    }

    /**
     * Clear all history
     */
    public clearHistory(): void {
        this.history = [];
        this.saveHistory();
    }

    /**
     * Remove a specific item from history
     */
    public removeItem(text: string): void {
        this.history = this.history.filter(item => item.text !== text);
        this.saveHistory();
    }
}
