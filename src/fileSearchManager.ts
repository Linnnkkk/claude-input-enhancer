/**
 * File Search Manager
 * Handles file and folder search for @ mentions in the current workspace
 * Optimized with workspace.findFiles API for fast file enumeration
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
 * Cached file data structure
 */
interface CachedFileData {
    files: FileSuggestion[];
    directoryMap: Map<string, FileSuggestion[]>; // path -> files in directory
    timestamp: number;
}

/**
 * File Search Manager
 * Searches files and folders in the current workspace only
 * Uses workspace.findFiles API for optimized performance
 */
export class FileSearchManager {
    private workspaceRoot: string;
    private cachedData: CachedFileData | null = null;
    private readonly CACHE_TTL = 30000; // 30 seconds cache TTL
    private readonly MAX_RESULTS = 50;
    private readonly MAX_CACHE_FILES = 100000; // Increased from 10k to 100k
    private cacheBuildPromise: Promise<void> | null = null;
    private fileSystemWatcher: vscode.FileSystemWatcher | null = null;

    // Common exclude patterns for workspace.findFiles
    private readonly EXCLUDE_PATTERNS = [
        '**/node_modules/**',
        '**/.git/**',
        '**/dist/**',
        '**/build/**',
        '**/.vscode-test/**',
        '**/coverage/**',
        '**/.next/**',
        '**/out/**',
        '**/.turbo/**',
        '**/.venv/**',
        '**/__pycache__/**',
        '**/target/**',     // Rust
        '**/vendor/**',     // PHP/Composer
        '**/*.min.js',
        '**/*.min.css',
    ];

    constructor() {
        // Get the first workspace folder
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (workspaceFolders && workspaceFolders.length > 0) {
            this.workspaceRoot = workspaceFolders[0].uri.fsPath;
        } else {
            this.workspaceRoot = '';
        }

        // Set up file system watcher for cache invalidation
        this.setupFileSystemWatcher();
    }

    /**
     * Set up file system watcher to detect changes and invalidate cache
     */
    private setupFileSystemWatcher(): void {
        if (!this.workspaceRoot) {
            return;
        }

        try {
            // Watch for file changes in the workspace
            this.fileSystemWatcher = vscode.workspace.createFileSystemWatcher(
                new vscode.RelativePattern(vscode.Uri.file(this.workspaceRoot), '**/*')
            );

            // Invalidate cache on any file change
            this.fileSystemWatcher.onDidCreate(() => this.invalidateCacheQuietly());
            this.fileSystemWatcher.onDidDelete(() => this.invalidateCacheQuietly());
            this.fileSystemWatcher.onDidChange(() => this.invalidateCacheQuietly());
        } catch (error) {
        }
    }

    /**
     * Invalidate cache without awaiting (fire and forget)
     */
    private invalidateCacheQuietly(): void {
        this.cachedData = null;
    }

    /**
     * Get the current workspace root path
     */
    public getWorkspaceRoot(): string {
        return this.workspaceRoot;
    }

    /**
     * Build file cache using workspace.findFiles API
     * Much faster than recursive directory scanning
     */
    private async buildCache(): Promise<void> {
        if (!this.workspaceRoot) {
            return;
        }

        // If a cache build is already in progress, wait for it
        if (this.cacheBuildPromise) {
            return this.cacheBuildPromise;
        }

        this.cacheBuildPromise = (async () => {
            try {
                const startTime = Date.now();

                // Use workspace.findFiles for fast file enumeration
                // Pattern: **/* matches all files recursively
                // Exclude: common patterns to reduce noise
                const uris = await vscode.workspace.findFiles(
                    '**/*',
                    `{${this.EXCLUDE_PATTERNS.join(',')}}`,
                    this.MAX_CACHE_FILES // Increased limit to 100,000 files
                );

                const files: FileSuggestion[] = [];
                const directoryMap = new Map<string, FileSuggestion[]>();
                const allFolders = new Set<string>(); // Track all unique folders

                // Process each URI
                for (const uri of uris) {
                    const relativePath = path.relative(this.workspaceRoot, uri.fsPath);
                    const parsedPath = path.parse(relativePath);
                    const dir = parsedPath.dir;
                    const name = parsedPath.base;
                    const ext = parsedPath.ext;

                    // Create file suggestion
                    const suggestion: FileSuggestion = {
                        name,
                        fullPath: uri.fsPath,
                        relativePath,
                        type: 'file', // workspace.findFiles only returns files
                        icon: this.getFileIcon(ext)
                    };

                    files.push(suggestion);

                    // Add to directory map
                    const dirKey = dir || '.';
                    if (!directoryMap.has(dirKey)) {
                        directoryMap.set(dirKey, []);
                    }
                    directoryMap.get(dirKey)!.push(suggestion);

                    // Track all folders in the path for better folder navigation
                    if (dir) {
                        allFolders.add(dir);
                        // Also add parent folders
                        const parts = dir.split(path.sep);
                        for (let i = 0; i < parts.length; i++) {
                            const folderPath = parts.slice(0, i + 1).join(path.sep);
                            allFolders.add(folderPath);
                        }
                    }
                }

                // Initialize directory map entries for all folders (even if empty)
                // This ensures folders show up in navigation even if they have no files yet
                // or if their files were beyond the cache limit
                for (const folder of allFolders) {
                    if (!directoryMap.has(folder)) {
                        directoryMap.set(folder, []);
                    }
                }

                // Cache the data
                this.cachedData = {
                    files,
                    directoryMap,
                    timestamp: Date.now()
                };

                const elapsed = Date.now() - startTime;
            } catch (error) {
                this.cachedData = null;
            } finally {
                this.cacheBuildPromise = null;
            }
        })();

        await this.cacheBuildPromise;
    }

    /**
     * Get file icon based on extension
     */
    private getFileIcon(ext: string): string {
        const iconMap: Record<string, string> = {
            '.ts': '📘',
            '.tsx': '⚛️',
            '.js': '📜',
            '.jsx': '⚛️',
            '.py': '🐍',
            '.rs': '🦀',
            '.go': '🐹',
            '.java': '☕',
            '.cpp': '⚡',
            '.c': '⚡',
            '.h': '⚡',
            '.css': '🎨',
            '.scss': '🎨',
            '.html': '🌐',
            '.json': '📋',
            '.md': '📝',
            '.txt': '📄',
            '.yaml': '⚙️',
            '.yml': '⚙️',
            '.xml': '📋',
            '.svg': '🖼️',
            '.png': '🖼️',
            '.jpg': '🖼️',
            '.jpeg': '🖼️',
            '.gif': '🖼️',
            '.pdf': '📕',
        };
        return iconMap[ext.toLowerCase()] || '📄';
    }

    /**
     * Check if cache is valid (not expired)
     */
    private isCacheValid(): boolean {
        if (!this.cachedData) {
            return false;
        }
        const age = Date.now() - this.cachedData.timestamp;
        return age < this.CACHE_TTL;
    }

    /**
     * Ensure cache is built and valid
     */
    private async ensureCache(): Promise<void> {
        if (!this.isCacheValid()) {
            await this.buildCache();
        }
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

        await this.ensureCache();

        if (!this.cachedData) {
            return [];
        }

        // If no query and in a folder, show folder contents
        if (!query || query.length === 0) {
            return this.getDirectoryContents(currentPath);
        }

        // With query, filter from cache
        return this.filterFromCache(query, currentPath);
    }

    /**
     * Get direct contents of a directory using cache
     * Uses hybrid approach: cache for speed, lazy loading for completeness
     */
    private async getDirectoryContents(currentPath: string): Promise<FileSuggestion[]> {
        await this.ensureCache();

        if (!this.cachedData) {
            // Ultimate fallback if cache doesn't exist
            return this.getDirectoryContentsFs(currentPath);
        }

        const dirKey = currentPath || '.';

        // Check if we have cached data for this directory
        const cachedFiles = this.cachedData.directoryMap.get(dirKey);

        // Get unique subdirectories from the cached files
        const subdirs = new Set<string>();
        const filesInDir = new Set<string>();

        // First, collect files that are directly in this directory
        if (cachedFiles) {
            for (const file of cachedFiles) {
                filesInDir.add(file.relativePath);
            }
        }

        // Then, scan all files to find subdirectories
        // IMPORTANT: Only add paths that are actually directories (contain files)
        // Don't add paths that match file names
        for (const file of this.cachedData.files) {
            const filePath = file.relativePath;
            const fileDir = path.dirname(filePath);

            // Check if this file is in a subdirectory of currentPath
            if (currentPath === '') {
                // At root, check for direct subdirectories
                const pathParts = filePath.split(path.sep);
                if (pathParts.length > 1) {
                    // This file is in a subdirectory
                    const firstDir = pathParts[0];
                    if (firstDir && firstDir !== '.') {
                        subdirs.add(firstDir);
                    }
                }
                // If pathParts.length === 1, this file is in root directory
                // Don't add it to subdirs (it's a file, not a folder)
            } else {
                // In a subdirectory, check for children
                if (fileDir.startsWith(currentPath + path.sep)) {
                    const relativeToCurrent = fileDir.substring(currentPath.length + 1);
                    const firstSubdir = relativeToCurrent.split(path.sep)[0];
                    if (firstSubdir) {
                        subdirs.add(path.join(currentPath, firstSubdir));
                    }
                }
            }
        }

        // Remove any subdirs that are actually files
        // This prevents files from appearing as folders
        for (const filePath of filesInDir) {
            subdirs.delete(filePath);
        }

        // Check if directory might have more content (lazy load trigger)
        // If we're near the cache limit, use lazy loading for better completeness
        const shouldLazyLoad = this.cachedData.files.length >= (this.MAX_CACHE_FILES * 0.9);

        if (shouldLazyLoad || (!cachedFiles && subdirs.size === 0)) {
            // Use lazy loading for better completeness
            return this.getDirectoryContentsFs(currentPath);
        }

        // Build result with folders first, then files
        const results: FileSuggestion[] = [];

        // Add folders
        const sortedSubdirs = Array.from(subdirs).sort();
        for (const subdir of sortedSubdirs) {
            const name = path.basename(subdir);
            results.push({
                name,
                fullPath: path.join(this.workspaceRoot, subdir),
                relativePath: subdir,
                type: 'folder',
                icon: '📁'
            });
        }

        // Add files (convert Set to Array and sort)
        const sortedFiles = Array.from(filesInDir)
            .map(relPath => this.cachedData!.files.find(f => f.relativePath === relPath))
            .filter((f): f is FileSuggestion => f !== undefined)
            .sort((a, b) => a.name.localeCompare(b.name));

        results.push(...sortedFiles);

        return results;
    }

    /**
     * Fallback: Get directory contents using fs.readDirectory
     * Used when cache doesn't have the directory
     */
    private async getDirectoryContentsFs(currentPath: string): Promise<FileSuggestion[]> {
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
                if (this.EXCLUDE_PATTERNS.some(pattern => {
                    const patternWithoutGlob = pattern.replace(/\*\*/g, '').replace(/\*/g, '');
                    return name.includes(patternWithoutGlob.replace(/\//g, ''));
                })) {
                    continue;
                }

                const relativePath = currentPath ? path.join(currentPath, name) : name;
                const fullPath = path.join(this.workspaceRoot, relativePath);

                suggestions.push({
                    name,
                    fullPath,
                    relativePath,
                    type: type === vscode.FileType.Directory ? 'folder' : 'file',
                    icon: type === vscode.FileType.Directory ? '📁' : this.getFileIcon(path.extname(name))
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
            return [];
        }
    }

    /**
     * Filter files from cache by query
     * Fast client-side filtering - no additional API calls
     */
    private filterFromCache(query: string, currentPath: string): FileSuggestion[] {
        if (!this.cachedData) {
            return [];
        }

        const lowerQuery = query.toLowerCase();
        const results: FileSuggestion[] = [];
        const seenDirs = new Set<string>(); // Track unique directories for folder results
        const seenFilePaths = new Set<string>(); // Track unique file paths to avoid duplicates

        // Filter files that match the query
        for (const file of this.cachedData.files) {
            // If currentPath is specified, only search within that path
            if (currentPath) {
                if (!file.relativePath.startsWith(currentPath + path.sep) && file.relativePath !== currentPath) {
                    continue;
                }
            }

            const nameLower = file.name.toLowerCase();
            let matched = false;

            // Check if file name matches (exact or contains)
            if (nameLower.includes(lowerQuery)) {
                if (!seenFilePaths.has(file.relativePath)) {
                    seenFilePaths.add(file.relativePath);
                    results.push(file);
                }
                matched = true;
            }

            // If file name didn't match, check if any directory in the path matches
            if (!matched) {
                const pathParts = file.relativePath.split(path.sep);
                for (const part of pathParts) {
                    if (part.toLowerCase().includes(lowerQuery)) {
                        if (!seenFilePaths.has(file.relativePath)) {
                            seenFilePaths.add(file.relativePath);
                            results.push(file);
                        }
                        break;
                    }
                }
            }

            // Stop if we've reached max results
            if (results.length >= this.MAX_RESULTS) {
                break;
            }
        }

        // Add matching folders (deduplicated)
        // Only add actual folders, not files
        if (this.cachedData) {
            for (const file of this.cachedData.files) {
                if (results.length >= this.MAX_RESULTS) {
                    break;
                }

                // If currentPath is specified, only search within that path
                if (currentPath) {
                    if (!file.relativePath.startsWith(currentPath + path.sep) && file.relativePath !== currentPath) {
                        continue;
                    }
                }

                const pathParts = file.relativePath.split(path.sep);

                // Only check directories in the path (not the filename itself)
                // Stop at pathParts.length - 1 to exclude the filename
                for (let i = 0; i < pathParts.length - 1; i++) {
                    const dirPart = pathParts[i];
                    const dirPathSoFar = pathParts.slice(0, i + 1).join(path.sep);

                    // Make sure this folder is not actually a file
                    if (this.cachedData.directoryMap.has(dirPathSoFar)) {
                        // This is a directory with files, not a file
                        if (dirPart.toLowerCase().includes(lowerQuery) && !seenDirs.has(dirPathSoFar)) {
                            seenDirs.add(dirPathSoFar);
                            const folderSuggestion: FileSuggestion = {
                                name: dirPart,
                                fullPath: path.join(this.workspaceRoot, dirPathSoFar),
                                relativePath: dirPathSoFar,
                                type: 'folder',
                                icon: '📁'
                            };
                            results.push(folderSuggestion);
                        }
                    }
                }
            }
        }

        // Sort: exact match first, then folders, then alphabetical
        const sorted = results.sort((a, b) => {
            const aExact = a.name.toLowerCase() === lowerQuery;
            const bExact = b.name.toLowerCase() === lowerQuery;
            if (aExact && !bExact) return -1;
            if (!aExact && bExact) return 1;

            if (a.type !== b.type) {
                return a.type === 'folder' ? -1 : 1;
            }
            return a.name.localeCompare(b.name);
        }).slice(0, this.MAX_RESULTS);

        return sorted;
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
        // Dispose old watcher
        if (this.fileSystemWatcher) {
            this.fileSystemWatcher.dispose();
            this.fileSystemWatcher = null;
        }

        // Update workspace root
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (workspaceFolders && workspaceFolders.length > 0) {
            this.workspaceRoot = workspaceFolders[0].uri.fsPath;
        } else {
            this.workspaceRoot = '';
        }

        // Clear cache and set up new watcher
        this.cachedData = null;
        this.setupFileSystemWatcher();
    }

    /**
     * Dispose resources
     */
    public dispose(): void {
        if (this.fileSystemWatcher) {
            this.fileSystemWatcher.dispose();
            this.fileSystemWatcher = null;
        }
        this.cachedData = null;
    }

    /**
     * Manually invalidate and rebuild the cache
     * Useful when files are created/deleted externally
     */
    public async invalidateCache(): Promise<void> {
        this.cachedData = null;
        await this.ensureCache();
    }

    /**
     * Get cache statistics for debugging
     */
    public getCacheStats(): { fileCount: number; dirCount: number; age: number; isValid: boolean } | null {
        if (!this.cachedData) {
            return null;
        }
        return {
            fileCount: this.cachedData.files.length,
            dirCount: this.cachedData.directoryMap.size,
            age: Date.now() - this.cachedData.timestamp,
            isValid: this.isCacheValid()
        };
    }
}
