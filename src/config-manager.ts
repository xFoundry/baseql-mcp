import fs from 'fs/promises';
import path from 'path';
import os from 'os';

/**
 * Get the path to the Claude Desktop configuration file
 */
export function getClaudeConfigPath(): string {
  const platform = os.platform();
  
  switch (platform) {
    case 'darwin': // macOS
      return path.join(
        os.homedir(),
        'Library',
        'Application Support',
        'Claude',
        'claude_desktop_config.json'
      );
      
    case 'win32': // Windows
      const appData = process.env.APPDATA;
      if (!appData) {
        throw new Error('APPDATA environment variable not found');
      }
      return path.join(appData, 'Claude', 'claude_desktop_config.json');
      
    case 'linux': // Linux
      return path.join(
        os.homedir(),
        '.config',
        'Claude',
        'claude_desktop_config.json'
      );
      
    default:
      throw new Error(`Unsupported platform: ${platform}`);
  }
}

/**
 * Get the path to the VS Code MCP configuration file
 */
export function getVSCodeConfigPath(): string {
  return path.join(process.cwd(), '.vscode', 'mcp.json');
}

/**
 * Read and parse Claude Desktop configuration
 */
export async function readClaudeConfig(): Promise<any> {
  const configPath = getClaudeConfigPath();
  
  try {
    const content = await fs.readFile(configPath, 'utf-8');
    return JSON.parse(content);
  } catch (error: any) {
    if (error.code === 'ENOENT') {
      // File doesn't exist, return empty config
      return {};
    }
    throw error;
  }
}

/**
 * Update Claude Desktop configuration
 */
export async function updateClaudeConfig(updates: any): Promise<void> {
  const configPath = getClaudeConfigPath();
  
  // Read existing config
  let config = await readClaudeConfig();
  
  // Backup existing config if it exists
  try {
    await fs.access(configPath);
    await fs.copyFile(configPath, `${configPath}.backup`);
  } catch {
    // No existing config to backup
  }
  
  // Merge updates
  config = {
    ...config,
    ...updates,
    mcpServers: {
      ...config.mcpServers,
      ...updates.mcpServers
    }
  };
  
  // Ensure directory exists
  await fs.mkdir(path.dirname(configPath), { recursive: true });
  
  // Write updated config
  await fs.writeFile(configPath, JSON.stringify(config, null, 2));
}

/**
 * Check if a configuration file exists
 */
export async function configExists(configPath: string): Promise<boolean> {
  try {
    await fs.access(configPath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Get all available MCP configurations
 */
export async function getAllConfigurations(): Promise<{
  env: any | null;
  claude: any | null;
  vscode: any | null;
}> {
  const configs = {
    env: null as any,
    claude: null as any,
    vscode: null as any
  };
  
  // Check environment variables
  if (process.env.BASEQL_API_ENDPOINT && process.env.BASEQL_API_KEY) {
    configs.env = {
      endpoint: process.env.BASEQL_API_ENDPOINT,
      apiKey: process.env.BASEQL_API_KEY
    };
  }
  
  // Check Claude Desktop
  try {
    const claudeConfig = await readClaudeConfig();
    if (claudeConfig.mcpServers?.baseql) {
      configs.claude = claudeConfig.mcpServers.baseql;
    }
  } catch {
    // Claude config not available
  }
  
  // Check VS Code
  try {
    const vscodeConfigPath = getVSCodeConfigPath();
    const vscodeContent = await fs.readFile(vscodeConfigPath, 'utf-8');
    const vscodeConfig = JSON.parse(vscodeContent);
    if (vscodeConfig.servers?.baseql) {
      configs.vscode = vscodeConfig.servers.baseql;
    }
  } catch {
    // VS Code config not available
  }
  
  return configs;
}