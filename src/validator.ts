import { GraphQLClient } from 'graphql-request';
import chalk from 'chalk';
import ora from 'ora';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import dotenv from 'dotenv';
import { ConfigSchema } from './validators.js';
import { getClaudeConfigPath } from './config-manager.js';

// Load environment variables
dotenv.config();

export async function validateConfig(): Promise<boolean> {
  console.log(chalk.blue.bold('🔍 Validating BaseQL MCP Configuration\n'));
  
  // Step 1: Load configuration
  console.log(chalk.cyan('Loading configuration...'));
  const config = await loadConfig();
  
  if (!config) {
    console.log(chalk.red('❌ No configuration found'));
    console.log(chalk.yellow('Run "baseql-mcp setup" to configure'));
    return false;
  }
  
  // Step 2: Validate schema
  console.log(chalk.cyan('Validating configuration schema...'));
  try {
    ConfigSchema.parse(config);
    console.log(chalk.green('✅ Configuration schema valid'));
  } catch (error: any) {
    console.log(chalk.red('❌ Configuration invalid:'));
    error.issues?.forEach((issue: any) => {
      console.log(chalk.red(`  - ${issue.path.join('.')}: ${issue.message}`));
    });
    return false;
  }
  
  // Step 3: Test API connection
  const spinner = ora('Testing API connection...').start();
  try {
    const client = new GraphQLClient(config.endpoint, {
      headers: {
        Authorization: config.apiKey
      }
    });
    
    const query = `{ __schema { queryType { name } } }`;
    await client.request(query);
    spinner.succeed('API connection successful');
  } catch (error: any) {
    spinner.fail('API connection failed');
    console.log(chalk.red(`  ${error.message}`));
    return false;
  }
  
  // Step 4: Check MCP integration
  console.log(chalk.cyan('Checking MCP client integration...'));
  const isInstalled = await checkMCPInstallation();
  
  if (isInstalled) {
    console.log(chalk.green('✅ MCP server found in Claude Desktop configuration'));
  } else {
    console.log(chalk.yellow('⚠️  MCP server not found in Claude Desktop configuration'));
    console.log(chalk.gray('  This is okay if you\'re using a different MCP client'));
  }
  
  // Step 5: Test server functionality
  console.log(chalk.cyan('\nTesting server functionality...'));
  const functionalityOk = await testServerFunctionality(config);
  
  if (functionalityOk) {
    console.log(chalk.green('✅ Server functionality verified'));
  } else {
    console.log(chalk.yellow('⚠️  Some server functions may not be working correctly'));
  }
  
  // Summary
  console.log(chalk.green.bold('\n📊 Validation complete!'));
  console.log(chalk.gray('Your BaseQL MCP server is properly configured.\n'));
  
  return true;
}

async function loadConfig(): Promise<{ endpoint: string; apiKey: string } | null> {
  // Try environment variables first
  if (process.env.BASEQL_API_ENDPOINT && process.env.BASEQL_API_KEY) {
    return {
      endpoint: process.env.BASEQL_API_ENDPOINT,
      apiKey: process.env.BASEQL_API_KEY
    };
  }
  
  // Try .env file
  try {
    const envPath = path.join(process.cwd(), '.env');
    const envContent = await fs.readFile(envPath, 'utf-8');
    const envVars: any = {};
    
    envContent.split('\n').forEach(line => {
      const [key, ...valueParts] = line.split('=');
      if (key && valueParts.length > 0) {
        const cleanKey = key.trim();
        const value = valueParts.join('=').trim();
        if (cleanKey && !cleanKey.startsWith('#')) {
          envVars[cleanKey] = value;
        }
      }
    });
    
    if (envVars.BASEQL_API_ENDPOINT && envVars.BASEQL_API_KEY) {
      return {
        endpoint: envVars.BASEQL_API_ENDPOINT,
        apiKey: envVars.BASEQL_API_KEY
      };
    }
  } catch {
    // .env file doesn't exist or can't be read
  }
  
  // Try Claude Desktop configuration
  try {
    const configPath = getClaudeConfigPath();
    const configContent = await fs.readFile(configPath, 'utf-8');
    const config = JSON.parse(configContent);
    
    const baseqlConfig = config.mcpServers?.baseql;
    if (baseqlConfig?.env?.BASEQL_API_ENDPOINT && baseqlConfig?.env?.BASEQL_API_KEY) {
      return {
        endpoint: baseqlConfig.env.BASEQL_API_ENDPOINT,
        apiKey: baseqlConfig.env.BASEQL_API_KEY
      };
    }
  } catch {
    // Claude config doesn't exist or doesn't have BaseQL configuration
  }
  
  return null;
}

async function checkMCPInstallation(): Promise<boolean> {
  try {
    const configPath = getClaudeConfigPath();
    const configContent = await fs.readFile(configPath, 'utf-8');
    const config = JSON.parse(configContent);
    
    return !!config.mcpServers?.baseql;
  } catch {
    return false;
  }
}

async function testServerFunctionality(config: { endpoint: string; apiKey: string }): Promise<boolean> {
  try {
    const client = new GraphQLClient(config.endpoint, {
      headers: {
        Authorization: config.apiKey
      }
    });
    
    // Try to list tables
    const query = `
      query TestQuery {
        __schema {
          types {
            name
            kind
          }
        }
      }
    `;
    
    const data = await client.request(query) as any;
    
    // Check if we got some types back
    const hasTypes = data.__schema?.types?.length > 0;
    
    if (hasTypes) {
      const tableCount = data.__schema.types.filter((type: any) => 
        type.kind === "OBJECT" && 
        !type.name.startsWith("__") &&
        !["Query", "Mutation", "Subscription"].includes(type.name)
      ).length;
      
      console.log(chalk.gray(`  Found ${tableCount} tables in your BaseQL schema`));
    }
    
    return hasTypes;
  } catch {
    return false;
  }
}