/**
 * File Search Manager
 * Handles file and folder search for @ mentions in the current workspace
 */

import * as vscode from 'vscode';
import * as path from 'path';

export interface FileSuggestion {
    name: string;           // File/folder name (without path)
    fullPath: string;       // Full path from workspace root
    relativePath: string;   // Relative path for display
    type: 'file' | 'folder';
    icon?: string;          // Optional icon character
}

export interface FolderContent {
    path: string;           // Current folder path
    parentPath?: string;    // Parent folder path (for ../)
    items: FileSuggestion[]; // Files and folders in this folder
}

/**
 * File Search Manager
 * Searches files and folders in the current workspace only
 */
export class FileSearchManager {
    private workspaceRoot: string;
    private fileCache: Map<string, FileSuggestion[]> = new Map();
    private readonly CACHE_DURATION = 5000; // 5 seconds cache
    private cacheTime: number = 0;

    constructor() {
        // Get the first workspace folder
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (workspaceFolders && workspaceFolders.length > 0) {
            this.workspaceRoot = workspaceFolders[0].uri.fsPath;
        } else {
            this.workspaceRoot = '';
        }
    }

    /**
     * Get the current workspace root path
     */
    public getWorkspaceRoot(): string {
        return this.workspaceRoot;
    }

    /**
     * Search files and folders by query
     * @param query Search query (without @ prefix)
     * @param currentPath Current folder path (empty for workspace root)
     * @returns Matching files and folders
     */
    public async search(query: string, currentPath: string = ''): Promise<FileSuggestion[]> {
        if (!this.workspaceRoot) {
            return [];
        }

        // If no query and in a folder, show folder contents
        if (!query || query.length === 0) {
            return this.getDirectoryContents(currentPath);
        }

        // With query, do recursive search from current path
        return this.recursiveSearch(query, currentPath);
    }

    /**
     * Get direct contents of a directory
     */
    private async getDirectoryContents(currentPath: string): Promise<FileSuggestion[]> {
        const searchPath = currentPath ? path.join(this.workspaceRoot, currentPath) : this.workspaceRoot;

        try {
            const entries = await vscode.workspace.fs.readDirectory(vscode.Uri.file(searchPath));
            const suggestions: FileSuggestion[] = [];

            for (const [name, type] of entries) {
                // Skip only specific hidden folders (not all)
                if (name === '.git') {
                    continue;
                }

                // Skip common exclude patterns
                if (name === 'node_modules' || name === 'dist') {
                    continue;
                }

                const relativePath = currentPath ? path.join(currentPath, name) : name;
                const fullPath = path.join(this.workspaceRoot, relativePath);

                suggestions.push({
                    name,
                    fullPath,
                    relativePath,
                    type: type === vscode.FileType.Directory ? 'folder' : 'file',
                    icon: type === vscode.FileType.Directory ? '📁' : '📄'
                });
            }

            // Sort: folders first, then alphabetically
            return suggestions.sort((a, b) => {
                if (a.type !== b.type) {
                    return a.type === 'folder' ? -1 : 1;
                }
                return a.name.localeCompare(b.name);
            });

        } catch (error) {
            console.error('Failed to get directory contents:', error);
            return [];
        }
    }

    /**
     * Recursive search through subdirectories
     */
    private async recursiveSearch(query: string, currentPath: string): Promise<FileSuggestion[]> {
        const searchPath = currentPath ? path.join(this.workspaceRoot, currentPath) : this.workspaceRoot;
        const lowerQuery = query.toLowerCase();
        const results: FileSuggestion[] = [];
        const maxDepth = 5; // Limit recursion depth
        const maxResults = 50; // Limit results

        async function searchDir(dirPath: string, relativePath: string, depth: number): Promise<void> {
            if (depth > maxDepth || results.length >= maxResults) {
                return;
            }

            try {
                const entries = await vscode.workspace.fs.readDirectory(vscode.Uri.file(dirPath));

                for (const [name, type] of entries) {
                    // Skip only specific hidden folders (not all)
                    if (name === '.git') {
                        continue;
                    }

                    // Skip common exclude patterns
                    if (name === 'node_modules' || name === 'dist') {
                        continue;
                    }

                    const itemRelativePath = relativePath ? path.join(relativePath, name) : name;
                    const itemFullPath = path.join(dirPath, name);
                    const nameLower = name.toLowerCase();

                    // Check if matches query
                    if (nameLower.includes(lowerQuery)) {
                        results.push({
                            name,
                            fullPath: itemFullPath,
                            relativePath: itemRelativePath,
                            type: type === vscode.FileType.Directory ? 'folder' : 'file',
                            icon: type === vscode.FileType.Directory ? '📁' : '📄'
                        });

                        if (results.length >= maxResults) {
                            return;
                        }
                    }

                    // Recursively search subdirectories
                    if (type === vscode.FileType.Directory) {
                        await searchDir(itemFullPath, itemRelativePath, depth + 1);
                    }
                }
            } catch (error) {
                // Ignore permission errors
            }
        }

        await searchDir(searchPath, currentPath, 0);

        // Sort: exact match first, then folders, then alphabetical
        return results.sort((a, b) => {
            const aExact = a.name.toLowerCase() === lowerQuery;
            const bExact = b.name.toLowerCase() === lowerQuery;
            if (aExact && !bExact) return -1;
            if (!aExact && bExact) return 1;

            if (a.type !== b.type) {
                return a.type === 'folder' ? -1 : 1;
            }
            return a.name.localeCompare(b.name);
        });
    }

    /**
     * Get folder contents for navigation
     * @param folderPath Relative path from workspace root
     */
    public async getFolderContents(folderPath: string): Promise<FolderContent> {
        if (!this.workspaceRoot) {
            return { path: '', items: [] };
        }

        const fullPath = path.join(this.workspaceRoot, folderPath);
        const parentPath = folderPath ? path.dirname(folderPath) : '';

        try {
            const items = await this.search('', folderPath);
            return {
                path: folderPath || '/',
                parentPath: parentPath || '',
                items
            };
        } catch (error) {
            console.error('Failed to get folder contents:', error);
            return { path: folderPath, items: [] };
        }
    }

    /**
     * Get parent folder path
     */
    public getParentPath(currentPath: string): string {
        if (!currentPath || currentPath === '' || currentPath === '/') {
            return '';
        }
        const parent = path.dirname(currentPath);
        return parent === '.' ? '' : parent;
    }

    /**
     * Check if a query represents folder navigation (ends with /)
     */
    public isFolderNavigation(query: string): boolean {
        return query.endsWith('/');
    }

    /**
     * Extract folder path from query (for navigation)
     */
    public extractFolderPath(query: string): string {
        // Remove leading @ and trailing /
        let folderPath = query.replace(/^@/, '');
        if (folderPath.endsWith('/')) {
            folderPath = folderPath.slice(0, -1);
        }
        return folderPath;
    }

    /**
     * Format file suggestion for insertion
     * @param suggestion File or folder suggestion
     * @param addTrailingSlash Add / after folders (for navigation)
     */
    public formatForInsertion(suggestion: FileSuggestion, addTrailingSlash: boolean = false): string {
        if (suggestion.type === 'folder' && addTrailingSlash) {
            return `@${suggestion.relativePath}/`;
        }
        return `@${suggestion.relativePath}`;
    }

    /**
     * Refresh workspace root (call when workspace changes)
     */
    public refreshWorkspace(): void {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (workspaceFolders && workspaceFolders.length > 0) {
            this.workspaceRoot = workspaceFolders[0].uri.fsPath;
        } else {
            this.workspaceRoot = '';
        }
        // Clear cache
        this.fileCache.clear();
        this.cacheTime = 0;
    }
}
