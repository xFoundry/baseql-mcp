import { program } from 'commander';
import { BaseQLMCPServer } from './server.js';
import { setupWizard } from './setup.js';
import { validateConfig } from './validator.js';
import chalk from 'chalk';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';

// Load environment variables
dotenv.config();

// Get package.json for version
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const packageJson = JSON.parse(
  fs.readFileSync(join(__dirname, '..', 'package.json'), 'utf-8')
);

program
  .name('baseql-mcp')
  .description('BaseQL MCP Server - Query Airtable and Google Sheets via GraphQL')
  .version(packageJson.version);

program
  .command('serve')
  .description('Start the MCP server')
  .option('--endpoint <url>', 'BaseQL API endpoint')
  .option('--key <key>', 'BaseQL API key')
  .option('--transport <type>', 'Transport type (stdio|http)', 'stdio')
  .option('--use-keychain', 'Use system keychain for credentials')
  .action(async (options) => {
    try {
      console.error(chalk.blue('🚀 Starting BaseQL MCP Server...'));
      
      // Override with command line options if provided
      const config = {
        endpoint: options.endpoint || process.env.BASEQL_API_ENDPOINT,
        apiKey: options.key || process.env.BASEQL_API_KEY,
        transport: options.transport as 'stdio' | 'http',
        useKeychain: options.useKeychain
      };

      // If using keychain, try to load credentials from it
      if (config.useKeychain) {
        try {
          // This would need keytar implementation
          console.error(chalk.yellow('⚠️  Keychain support coming soon'));
        } catch (error) {
          console.error(chalk.red('Failed to load credentials from keychain'));
        }
      }

      // Validate we have required credentials
      if (!config.endpoint || !config.apiKey) {
        console.error(chalk.red('❌ Missing required credentials'));
        console.error(chalk.yellow('Run "baseql-mcp setup" to configure'));
        process.exit(1);
      }

      const server = new BaseQLMCPServer({
        endpoint: config.endpoint,
        apiKey: config.apiKey,
        transport: config.transport
      });

      await server.start();
    } catch (error: any) {
      console.error(chalk.red('❌ Failed to start server:'), error.message);
      process.exit(1);
    }
  });

program
  .command('setup')
  .description('Interactive setup wizard')
  .action(async () => {
    try {
      await setupWizard();
    } catch (error: any) {
      console.error(chalk.red('❌ Setup failed:'), error.message);
      process.exit(1);
    }
  });

program
  .command('validate')
  .description('Validate configuration')
  .action(async () => {
    try {
      const isValid = await validateConfig();
      if (!isValid) {
        process.exit(1);
      }
    } catch (error: any) {
      console.error(chalk.red('❌ Validation failed:'), error.message);
      process.exit(1);
    }
  });

// Parse command line arguments
program.parse();

// Show help if no command provided
if (!process.argv.slice(2).length) {
  program.outputHelp();
}