/**
 * Slash Command Manager
 * Provides accurate slash commands for Claude Code
 * Built-in commands are hardcoded, custom commands (skills/plugins/hooks/agents) are discovered dynamically
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

export interface SlashCommand {
    name: string;
    description: string;
    category?: string;
    source?: 'skill' | 'command' | 'builtin' | 'plugin' | 'hook' | 'agent';
}

/**
 * Built-in Claude Code commands (accurate as of 2025-01-26)
 * These commands are always available in Claude Code
 * Note: Names stored without / prefix (added during insertion)
 */
const BUILTIN_COMMANDS: SlashCommand[] = [
    { name: 'add-dir', description: 'Add a new working directory', category: 'Built-in', source: 'builtin' },
    { name: 'agents', description: 'Manage agent configurations', category: 'Built-in', source: 'builtin' },
    { name: 'chrome', description: 'Claude in Chrome (Beta) settings', category: 'Built-in', source: 'builtin' },
    { name: 'clear', description: 'Clear conversation history and free up context', category: 'Built-in', source: 'builtin' },
    { name: 'compact', description: 'Clear conversation history but keep a summary', category: 'Built-in', source: 'builtin' },
    { name: 'config', description: 'Show configuration help', category: 'Built-in', source: 'builtin' },
    { name: 'context', description: 'Visualize current context usage as a colored grid', category: 'Built-in', source: 'builtin' },
    { name: 'cost', description: 'Show the total cost and duration of the current session', category: 'Built-in', source: 'builtin' },
    { name: 'doctor', description: 'Diagnose and verify your Claude Code installation and settings', category: 'Built-in', source: 'builtin' },
    { name: 'exit', description: 'Exit the REPL', category: 'Built-in', source: 'builtin' },
    { name: 'export', description: 'Export the current conversation to a file or clipboard', category: 'Built-in', source: 'builtin' },
    { name: 'fork', description: 'Create a fork of the current conversation at this point', category: 'Built-in', source: 'builtin' },
    { name: 'help', description: 'Show help and available commands', category: 'Built-in', source: 'builtin' },
    { name: 'hooks', description: 'Manage hook configurations for tool events', category: 'Built-in', source: 'builtin' },
    { name: 'ide', description: 'Manage IDE integrations and show status', category: 'Built-in', source: 'builtin' },
    { name: 'init', description: 'Initialize a new CLAUDE.md file with codebase documentation', category: 'Built-in', source: 'builtin' },
    { name: 'install-github-app', description: 'Set up Claude GitHub Actions for a repository', category: 'Built-in', source: 'builtin' },
    { name: 'install-slack-app', description: 'Install the Claude Slack app', category: 'Built-in', source: 'builtin' },
    { name: 'login', description: 'Sign in with your Anthropic account', category: 'Built-in', source: 'builtin' },
    { name: 'logout', description: 'Sign out from your Anthropic account', category: 'Built-in', source: 'builtin' },
    { name: 'mcp', description: 'Manage MCP servers', category: 'Built-in', source: 'builtin' },
    { name: 'memory', description: 'Edit Claude memory files', category: 'Built-in', source: 'builtin' },
    { name: 'mobile', description: 'Show QR code to download the Claude mobile app', category: 'Built-in', source: 'builtin' },
    { name: 'model', description: 'Set the AI model for Claude Code', category: 'Built-in', source: 'builtin' },
    { name: 'output-style', description: 'Set the output style directly or from a selection menu', category: 'Built-in', source: 'builtin' },
    { name: 'permissions', description: 'Manage allow & deny tool permission rules', category: 'Built-in', source: 'builtin' },
    { name: 'plan', description: 'Restate requirements, assess risks, and create step-by-step implementation plan', category: 'Built-in', source: 'builtin' },
    { name: 'plugin', description: 'Manage Claude Code plugins', category: 'Built-in', source: 'builtin' },
    { name: 'pr-comments', description: 'Get comments from a GitHub pull request', category: 'Built-in', source: 'builtin' },
    { name: 'release-notes', description: 'View release notes', category: 'Built-in', source: 'builtin' },
    { name: 'rename', description: 'Rename the current conversation', category: 'Built-in', source: 'builtin' },
    { name: 'resume', description: 'Resume a conversation', category: 'Built-in', source: 'builtin' },
    { name: 'review', description: 'Review a pull request', category: 'Built-in', source: 'builtin' },
    { name: 'rewind', description: 'Restore the code and/or conversation to a previous point', category: 'Built-in', source: 'builtin' },
    { name: 'sandbox', description: 'Configure sandbox settings', category: 'Built-in', source: 'builtin' },
    { name: 'security-review', description: 'Use this skill for security review', category: 'Built-in', source: 'builtin' },
    { name: 'skills', description: 'List available skills', category: 'Built-in', source: 'builtin' },
    { name: 'stats', description: 'Show your Claude Code usage statistics and activity', category: 'Built-in', source: 'builtin' },
    { name: 'status', description: 'Show Claude Code status including version, model, account', category: 'Built-in', source: 'builtin' },
    { name: 'statusline', description: 'Set up Claude Code\'s status line UI', category: 'Built-in', source: 'builtin' },
    { name: 'stickers', description: 'Order Claude Code stickers', category: 'Built-in', source: 'builtin' },
    { name: 'tasks', description: 'List and manage background tasks', category: 'Built-in', source: 'builtin' },
    { name: 'terminal-setup', description: 'Install Shift+Enter key binding for newlines', category: 'Built-in', source: 'builtin' },
    { name: 'theme', description: 'Change the theme', category: 'Built-in', source: 'builtin' },
    { name: 'todos', description: 'List current todo items', category: 'Built-in', source: 'builtin' },
    { name: 'upgrade', description: 'Upgrade to Max for higher rate limits and more Opus', category: 'Built-in', source: 'builtin' },
    { name: 'usage', description: 'Show plan usage limits', category: 'Built-in', source: 'builtin' },
];

/**
 * Parse frontmatter from a markdown file
 */
function parseFrontmatter(content: string): Record<string, any> | null {
    const frontmatterRegex = /^---\s*\n([\s\S]*?)\n---/;
    const match = content.match(frontmatterRegex);

    if (!match) {
        return null;
    }

    const frontmatter: Record<string, any> = {};
    const lines = match[1].split('\n');

    for (const line of lines) {
        const colonIndex = line.indexOf(':');
        if (colonIndex > 0) {
            const key = line.substring(0, colonIndex).trim();
            let value = line.substring(colonIndex + 1).trim();

            // Remove quotes if present
            if ((value.startsWith('"') && value.endsWith('"')) ||
                (value.startsWith("'") && value.endsWith("'"))) {
                value = value.slice(1, -1);
            }

            frontmatter[key] = value;
        }
    }

    return frontmatter;
}

/**
 * Discover user-invocable skills from SKILL.md files
 * These are custom skills added by the user
 *
 * Scans:
 * 1. Global skills: ~/.claude/skills/
 * 2. Project-specific skills: <workspace>/.claude/skills/
 */
function discoverCustomSkills(claudePath: string, workspaceRoots: string[] = []): SlashCommand[] {
    const commands: SlashCommand[] = [];

    // Helper to scan a skills directory
    function scanSkillsDirectory(skillsDir: string, category: string): void {
        if (!fs.existsSync(skillsDir)) {
            return;
        }

        const skillEntries = fs.readdirSync(skillsDir, { withFileTypes: true });

        for (const entry of skillEntries) {
            if (!entry.isDirectory()) {
                continue;
            }

            const skillPath = path.join(skillsDir, entry.name);
            const skillMdPath = path.join(skillPath, 'SKILL.md');

            if (fs.existsSync(skillMdPath)) {
                try {
                    const content = fs.readFileSync(skillMdPath, 'utf-8');
                    const frontmatter = parseFrontmatter(content);

                    // Check if this is a user-invocable skill (has name in frontmatter)
                    if (frontmatter && frontmatter.name) {
                        // Strip / prefix if present (we add it during insertion)
                        let commandName = frontmatter.name;
                        if (commandName.startsWith('/')) {
                            commandName = commandName.substring(1);
                        }

                        commands.push({
                            name: commandName,
                            description: frontmatter.description || `Skill: ${commandName}`,
                            category: category,
                            source: 'skill'
                        });
                    }
                } catch (error) {
                    // Skip skills that can't be read
                }
            }
        }
    }

    // 1. Scan global skills directory
    const globalSkillsDir = path.join(claudePath, 'skills');
    scanSkillsDirectory(globalSkillsDir, 'Global Skills');

    // 2. Scan project-specific skills directories (from workspace roots)
    for (const workspaceRoot of workspaceRoots) {
        const projectSkillsDir = path.join(workspaceRoot, '.claude', 'skills');

        if (fs.existsSync(projectSkillsDir) && projectSkillsDir !== globalSkillsDir) {
            // Get workspace folder name for category
            const workspaceName = path.basename(workspaceRoot);
            scanSkillsDirectory(projectSkillsDir, `Project: ${workspaceName}`);
        }
    }

    return commands;
}

/**
 * Discover commands from plugin commands/*.md files
 *
 * IMPORTANT: Only read from plugin root directories (where .claude-plugin/plugin.json exists)
 * Do NOT recursively scan all subdirectories - this causes duplicates
 *
 * Command format:
 * - Plugin skill: /plugin-name (from SKILL.md name field)
 * - Plugin sub-command: /plugin-name:command-name (from commands/*.md files)
 */
function discoverPluginCommands(claudePath: string): SlashCommand[] {
    const commands: SlashCommand[] = [];
    const pluginsDir = path.join(claudePath, 'plugins');

    if (!fs.existsSync(pluginsDir)) {
        return commands;
    }

    // Find all plugin root directories (directories containing .claude-plugin/plugin.json)
    function findPluginRoots(dir: string, baseCategory: string = 'Plugins'): string[] {
        const pluginRoots: string[] = [];

        if (!fs.existsSync(dir)) {
            return pluginRoots;
        }

        const entries = fs.readdirSync(dir, { withFileTypes: true });

        for (const entry of entries) {
            const fullPath = path.join(dir, entry.name);

            if (entry.isDirectory()) {
                // Check if this is a plugin root (has .claude-plugin/plugin.json)
                const pluginJsonPath = path.join(fullPath, '.claude-plugin', 'plugin.json');
                if (fs.existsSync(pluginJsonPath)) {
                    pluginRoots.push(fullPath);
                } else {
                    // Recursively search subdirectories
                    pluginRoots.push(...findPluginRoots(fullPath, baseCategory));
                }
            }
        }

        return pluginRoots;
    }

    // Read commands from a single plugin root directory
    function readPluginCommands(pluginRoot: string, baseCategory: string): void {
        try {
            // Read plugin name from plugin.json
            const pluginJsonPath = path.join(pluginRoot, '.claude-plugin', 'plugin.json');
            let pluginName = '';

            if (fs.existsSync(pluginJsonPath)) {
                try {
                    const pluginJson = JSON.parse(fs.readFileSync(pluginJsonPath, 'utf-8'));
                    pluginName = pluginJson.name || '';
                } catch (e) {
                }
            }

            if (!pluginName) {
                return; // Skip if no plugin name
            }

            // Check for SKILL.md in skills/ subdirectory
            const skillsDir = path.join(pluginRoot, 'skills');
            if (fs.existsSync(skillsDir)) {
                const skillEntries = fs.readdirSync(skillsDir, { withFileTypes: true });
                for (const skillEntry of skillEntries) {
                    if (skillEntry.isDirectory()) {
                        const skillMdPath = path.join(skillsDir, skillEntry.name, 'SKILL.md');
                        if (fs.existsSync(skillMdPath)) {
                            try {
                                const content = fs.readFileSync(skillMdPath, 'utf-8');
                                const frontmatter = parseFrontmatter(content);

                                if (frontmatter && frontmatter.name) {
                                    let skillName = frontmatter.name;
                                    if (skillName.startsWith('/')) {
                                        skillName = skillName.substring(1);
                                    }

                                    // Use skill name directly as command (e.g., /planning-with-files)
                                    commands.push({
                                        name: skillName,
                                        description: frontmatter.description || `Skill: ${skillName}`,
                                        category: baseCategory,
                                        source: 'skill'
                                    });
                                }
                            } catch (error) {
                            }
                        }
                    }
                }
            }

            // Check for commands/ subdirectory
            const commandsDir = path.join(pluginRoot, 'commands');
            if (fs.existsSync(commandsDir)) {
                const commandFiles = fs.readdirSync(commandsDir);
                for (const file of commandFiles) {
                    if (file.endsWith('.md')) {
                        const commandMdPath = path.join(commandsDir, file);
                        try {
                            const content = fs.readFileSync(commandMdPath, 'utf-8');
                            const frontmatter = parseFrontmatter(content);

                            // Command format: plugin-name:command-name
                            const commandNameOnly = file.replace(/\.md$/, '');
                            const fullCommandName = `${pluginName}:${commandNameOnly}`;

                            commands.push({
                                name: fullCommandName,
                                description: frontmatter?.description || `Command: ${fullCommandName}`,
                                category: baseCategory,
                                source: 'command'
                            });
                        } catch (error) {
                        }
                    }
                }
            }
        } catch (error) {
        }
    }

    // Search in marketplaces and cache directories
    const subdirs = fs.readdirSync(pluginsDir, { withFileTypes: true });
    for (const subdir of subdirs) {
        if (subdir.isDirectory()) {
            const subdirPath = path.join(pluginsDir, subdir.name);
            const category = `Plugins (${subdir.name})`;

            // Find all plugin roots in this subdirectory
            const pluginRoots = findPluginRoots(subdirPath, category);

            // Read commands from each plugin root
            for (const pluginRoot of pluginRoots) {
                readPluginCommands(pluginRoot, category);
            }
        }
    }

    return commands;
}

/**
 * Get Claude Code configuration path
 */
function getClaudePath(): string {
    const homeDir = os.homedir();
    return path.join(homeDir, '.claude');
}

/**
 * Get all available commands (built-in + custom)
 * Deduplicates commands by name (first occurrence wins)
 */
function getAllCommands(workspaceRoots: string[] = []): SlashCommand[] {
    const claudePath = getClaudePath();
    const commandMap = new Map<string, SlashCommand>();

    // Helper to add commands without duplicates
    const addCommands = (commands: SlashCommand[]) => {
        for (const cmd of commands) {
            if (!commandMap.has(cmd.name)) {
                commandMap.set(cmd.name, cmd);
            }
        }
    };

    // Start with built-in commands (highest priority)
    addCommands(BUILTIN_COMMANDS);

    // Add custom skills (including project-specific skills)
    addCommands(discoverCustomSkills(claudePath, workspaceRoots));

    // Add plugin commands
    addCommands(discoverPluginCommands(claudePath));

    return Array.from(commandMap.values());
}

export class SlashCommandManager {
    private commands: SlashCommand[] = [];
    private lastUpdateTime: number = 0;
    private readonly CACHE_DURATION = 2000; // 2 seconds cache for dynamic reloading
    private workspaceRoots: string[] = [];

    constructor(workspaceRoots: string[] = []) {
        this.workspaceRoots = workspaceRoots;
        this.refreshCommands();
        this.setupFileSystemWatcher();
    }

    /**
     * Set up file system watcher for plugin changes
     * This enables dynamic reloading when plugins are added/modified
     */
    private setupFileSystemWatcher(): void {
        try {
            const claudePath = getClaudePath();
            const pluginsDir = path.join(claudePath, 'plugins');

            if (!fs.existsSync(pluginsDir)) {
                return;
            }

            // Watch for changes in plugins directory
            fs.watch(pluginsDir, { recursive: true }, (eventType, filename) => {
                if (filename && (filename.endsWith('.md') || filename.includes('commands'))) {
                    this.refreshCommands();
                }
            });
        } catch (error) {
            // Non-fatal: commands will still refresh via cache duration
        }
    }

    /**
     * Refresh commands from Claude Code configuration
     */
    private refreshCommands(): void {
        try {
            this.commands = getAllCommands(this.workspaceRoots);
            this.lastUpdateTime = Date.now();
        } catch (error) {
            // Keep existing commands if refresh fails
        }
    }

    /**
     * Update workspace roots and refresh commands
     */
    public updateWorkspaceRoots(workspaceRoots: string[]): void {
        this.workspaceRoots = workspaceRoots;
        this.refreshCommands();
    }

    /**
     * Get all available commands
     */
    public getAllCommands(): SlashCommand[] {
        // Check if we need to refresh custom commands (reduced cache for dynamic loading)
        if (Date.now() - this.lastUpdateTime > this.CACHE_DURATION) {
            this.refreshCommands();
        }

        return [...this.commands];
    }

    /**
     * Filter commands by query
     */
    public filterCommands(query: string): SlashCommand[] {
        const allCommands = this.getAllCommands();

        if (!query || query.length === 0) {
            return allCommands;
        }

        const lowerQuery = query.toLowerCase();

        return allCommands.filter(cmd => {
            const name = cmd.name.toLowerCase();
            const descLower = cmd.description.toLowerCase();

            // Exact match on name (highest priority)
            if (name === '/' + lowerQuery || name === lowerQuery) {
                return true;
            }

            // Starts with name (without /)
            if (name.startsWith('/' + lowerQuery)) {
                return true;
            }

            // Contains in name (without /)
            if (name.includes(lowerQuery)) {
                return true;
            }

            // Contains in description
            if (descLower.includes(lowerQuery)) {
                return true;
            }

            return false;
        });
    }

    /**
     * Get command by name
     */
    public getCommand(name: string): SlashCommand | undefined {
        return this.commands.find(cmd => cmd.name === name || cmd.name === '/' + name);
    }

    /**
     * Force refresh commands
     */
    public forceRefresh(): void {
        this.refreshCommands();
    }

    /**
     * Add custom command (temporary, for testing)
     */
    public addCommand(command: SlashCommand): void {
        // Remove if exists
        this.commands = this.commands.filter(cmd => cmd.name !== command.name);
        // Add to front
        this.commands.unshift(command);
    }

    /**
     * Remove command by name
     */
    public removeCommand(name: string): void {
        this.commands = this.commands.filter(cmd => cmd.name !== name);
    }
}
