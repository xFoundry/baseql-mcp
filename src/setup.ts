import inquirer from 'inquirer';
import chalk from 'chalk';
import ora from 'ora';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import { GraphQLClient } from 'graphql-request';
import { validateEndpoint, validateApiKey } from './validators.js';
import { getClaudeConfigPath, updateClaudeConfig } from './config-manager.js';

export async function setupWizard() {
  console.clear();
  console.log(chalk.blue.bold('🚀 BaseQL MCP Server Setup Wizard\n'));
  
  // Step 1: Welcome and prerequisites check
  const { hasAccount } = await inquirer.prompt({
    type: 'confirm',
    name: 'hasAccount',
    message: 'Do you have a BaseQL account?',
    default: false
  });
  
  if (!hasAccount) {
    console.log(chalk.yellow('\n📝 Please sign up at https://baseql.com'));
    console.log(chalk.gray('Once you have an account, run this setup again.\n'));
    process.exit(0);
  }
  
  // Step 2: Collect credentials
  const credentials = await inquirer.prompt([
    {
      type: 'input',
      name: 'endpoint',
      message: 'Enter your BaseQL endpoint URL:',
      validate: validateEndpoint
    },
    {
      type: 'password',
      name: 'apiKey',
      message: 'Enter your API key (with Bearer prefix):',
      validate: validateApiKey,
      mask: '*'
    }
  ]);
  
  // Step 3: Test connection
  const spinner = ora('Testing connection...').start();
  const isValid = await testConnection(credentials);
  
  if (!isValid) {
    spinner.fail('Connection failed');
    console.log(chalk.red('\n❌ Please check your credentials and try again.'));
    process.exit(1);
  }
  
  spinner.succeed('Connection successful!');
  
  // Step 4: Configure installation
  const { installType } = await inquirer.prompt({
    type: 'list',
    name: 'installType',
    message: 'How would you like to install?',
    choices: [
      { name: '🖥️  Claude Desktop (Recommended)', value: 'claude' },
      { name: '📝 VS Code / Cursor', value: 'vscode' },
      { name: '🔧 Manual Configuration', value: 'manual' }
    ]
  });
  
  // Step 5: Save configuration option
  const { saveEnv } = await inquirer.prompt({
    type: 'confirm',
    name: 'saveEnv',
    message: 'Save credentials to .env file for local development?',
    default: true
  });
  
  if (saveEnv) {
    await saveEnvFile(credentials);
  }
  
  // Step 6: Install based on choice
  switch (installType) {
    case 'claude':
      await installForClaude(credentials);
      break;
    case 'vscode':
      await installForVSCode(credentials);
      break;
    case 'manual':
      await showManualInstructions(credentials);
      break;
  }
  
  // Step 7: Show success message and next steps
  console.log(chalk.green.bold('\n✅ Installation complete!\n'));
  showNextSteps(installType);
}

async function testConnection(credentials: { endpoint: string; apiKey: string }): Promise<boolean> {
  try {
    const client = new GraphQLClient(credentials.endpoint, {
      headers: {
        Authorization: credentials.apiKey
      }
    });
    
    // Try a simple introspection query
    const query = `{ __schema { queryType { name } } }`;
    await client.request(query);
    return true;
  } catch (error) {
    return false;
  }
}

async function saveEnvFile(credentials: { endpoint: string; apiKey: string }) {
  const envContent = `# BaseQL MCP Server Configuration
BASEQL_API_ENDPOINT=${credentials.endpoint}
BASEQL_API_KEY=${credentials.apiKey}
`;
  
  try {
    // Check if .env already exists
    const envPath = path.join(process.cwd(), '.env');
    let existingContent = '';
    
    try {
      existingContent = await fs.readFile(envPath, 'utf-8');
    } catch {
      // File doesn't exist, that's fine
    }
    
    if (existingContent) {
      // Backup existing .env
      await fs.writeFile(`${envPath}.backup`, existingContent);
      console.log(chalk.gray('Backed up existing .env to .env.backup'));
    }
    
    // Write new .env
    await fs.writeFile(envPath, envContent);
    console.log(chalk.green('✅ Saved credentials to .env file'));
  } catch (error) {
    console.log(chalk.yellow('⚠️  Could not save .env file'));
  }
}

async function installForClaude(credentials: { endpoint: string; apiKey: string }) {
  try {
    const configPath = getClaudeConfigPath();
    
    // Read existing config or create new one
    let config: any = {};
    try {
      const content = await fs.readFile(configPath, 'utf-8');
      config = JSON.parse(content);
    } catch {
      // Config doesn't exist yet
    }
    
    // Update config
    config.mcpServers = config.mcpServers || {};
    config.mcpServers.baseql = {
      command: 'npx',
      args: ['-y', '@baseql/mcp-server', 'serve'],
      env: {
        BASEQL_API_ENDPOINT: credentials.endpoint,
        BASEQL_API_KEY: credentials.apiKey
      }
    };
    
    // Backup existing config
    if (await fileExists(configPath)) {
      await fs.copyFile(configPath, `${configPath}.backup`);
      console.log(chalk.gray('Backed up existing Claude config'));
    }
    
    // Ensure directory exists
    await fs.mkdir(path.dirname(configPath), { recursive: true });
    
    // Write updated config
    await fs.writeFile(configPath, JSON.stringify(config, null, 2));
    console.log(chalk.green('✅ Claude Desktop configuration updated'));
  } catch (error: any) {
    console.log(chalk.red('❌ Failed to update Claude Desktop configuration'));
    console.log(chalk.gray(error.message));
    await showManualInstructions(credentials);
  }
}

async function installForVSCode(credentials: { endpoint: string; apiKey: string }) {
  const config = {
    "baseql": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "@baseql/mcp-server", "serve"],
      "env": {
        "BASEQL_API_ENDPOINT": credentials.endpoint,
        "BASEQL_API_KEY": credentials.apiKey
      }
    }
  };
  
  console.log(chalk.blue('\n📝 Add this to your VS Code settings.json or .vscode/mcp.json:\n'));
  console.log(chalk.gray(JSON.stringify(config, null, 2)));
  
  // Try to create .vscode/mcp.json
  try {
    const vscodePath = path.join(process.cwd(), '.vscode');
    await fs.mkdir(vscodePath, { recursive: true });
    
    const mcpConfigPath = path.join(vscodePath, 'mcp.json');
    const mcpConfig = {
      "servers": config
    };
    
    await fs.writeFile(mcpConfigPath, JSON.stringify(mcpConfig, null, 2));
    console.log(chalk.green('\n✅ Created .vscode/mcp.json'));
  } catch {
    console.log(chalk.yellow('\n⚠️  Could not create .vscode/mcp.json automatically'));
  }
}

async function showManualInstructions(credentials: { endpoint: string; apiKey: string }) {
  console.log(chalk.blue('\n📋 Manual Configuration Instructions:\n'));
  
  console.log(chalk.yellow('For Claude Desktop:'));
  console.log('Add this to your claude_desktop_config.json:');
  console.log(chalk.gray(JSON.stringify({
    "mcpServers": {
      "baseql": {
        "command": "npx",
        "args": ["-y", "@baseql/mcp-server", "serve"],
        "env": {
          "BASEQL_API_ENDPOINT": credentials.endpoint,
          "BASEQL_API_KEY": credentials.apiKey
        }
      }
    }
  }, null, 2)));
  
  console.log(chalk.yellow('\nFor local development:'));
  console.log('Run with environment variables:');
  console.log(chalk.gray(`BASEQL_API_ENDPOINT="${credentials.endpoint}" \\`));
  console.log(chalk.gray(`BASEQL_API_KEY="${credentials.apiKey}" \\`));
  console.log(chalk.gray('npx @baseql/mcp-server serve'));
}

function showNextSteps(installType: string) {
  console.log(chalk.cyan('📚 Next Steps:\n'));
  
  switch (installType) {
    case 'claude':
      console.log('1. Restart Claude Desktop');
      console.log('2. Type: "Using BaseQL, list all tables"');
      console.log('3. Start querying your data!\n');
      break;
    case 'vscode':
      console.log('1. Restart VS Code');
      console.log('2. Open GitHub Copilot Chat');
      console.log('3. Type: "@baseql list tables"');
      console.log('4. Start querying your data!\n');
      break;
    case 'manual':
      console.log('1. Apply the configuration to your MCP client');
      console.log('2. Restart the client');
      console.log('3. Start using BaseQL MCP server!\n');
      break;
  }
  
  console.log(chalk.gray('Documentation: https://github.com/baseql/mcp-server'));
  console.log(chalk.gray('Support: support@baseql.com\n'));
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}