#!/usr/bin/env node
/**
 * Deployment script for the e-commerce web application
 * Handles building, testing, and deploying to different environments
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Configuration
const ENVIRONMENTS = {
  development: {
    name: 'Development',
    server: 'dev.example.com',
    port: 22,
    path: '/var/www/ecommerce-dev'
  },
  staging: {
    name: 'Staging',
    server: 'staging.example.com',
    port: 22,
    path: '/var/www/ecommerce-staging'
  },
  production: {
    name: 'Production',
    server: 'prod.example.com',
    port: 22,
    path: '/var/www/ecommerce-prod'
  }
};

class Deployer {
  constructor(environment = 'development') {
    this.environment = environment;
    this.config = ENVIRONMENTS[environment];
    
    if (!this.config) {
      throw new Error(`Unknown environment: ${environment}`);
    }
    
    console.log(`🚀 Deploying to ${this.config.name} environment`);
  }

  /**
   * Run command and log output
   */
  runCommand(command, description) {
    console.log(`\n📋 ${description}`);
    console.log(`   Running: ${command}`);
    
    try {
      const output = execSync(command, { 
        encoding: 'utf8',
        stdio: 'inherit'
      });
      console.log(`   ✅ ${description} completed`);
      return output;
    } catch (error) {
      console.error(`   ❌ ${description} failed:`, error.message);
      throw error;
    }
  }

  /**
   * Pre-deployment checks
   */
  async preDeploymentChecks() {
    console.log('\n🔍 Running pre-deployment checks...');
    
    // Check if package.json exists
    if (!fs.existsSync('package.json')) {
      throw new Error('package.json not found');
    }
    
    // Check if we're in a git repository
    try {
      execSync('git status', { stdio: 'ignore' });
    } catch (error) {
      throw new Error('Not in a git repository');
    }
    
    // Check for uncommitted changes (production only)
    if (this.environment === 'production') {
      const status = execSync('git status --porcelain', { encoding: 'utf8' });
      if (status.trim()) {
        throw new Error('Uncommitted changes detected. Please commit all changes before production deployment.');
      }
    }
    
    console.log('   ✅ Pre-deployment checks passed');
  }

  /**
   * Install dependencies
   */
  async installDependencies() {
    this.runCommand('npm ci', 'Installing server dependencies');
    this.runCommand('cd client && npm ci', 'Installing client dependencies');
  }

  /**
   * Run tests
   */
  async runTests() {
    console.log('\n🧪 Running tests...');
    
    // Run server tests
    this.runCommand('npm run test:server', 'Running server tests');
    
    // Run client tests
    this.runCommand('npm run test:client -- --coverage --watchAll=false', 'Running client tests');
    
    // Run linting
    this.runCommand('npm run lint', 'Running code linting');
  }

  /**
   * Build application
   */
  async buildApplication() {
    console.log('\n🔨 Building application...');
    
    // Build client
    this.runCommand('npm run client:build', 'Building client application');
    
    // Create deployment package
    this.runCommand('mkdir -p dist', 'Creating deployment directory');
    this.runCommand('cp -r server dist/', 'Copying server files');
    this.runCommand('cp -r client/build dist/client', 'Copying client build');
    this.runCommand('cp package*.json dist/', 'Copying package files');
    
    console.log('   ✅ Application built successfully');
  }

  /**
   * Deploy to server
   */
  async deployToServer() {
    console.log(`\n🚀 Deploying to ${this.config.name} server...`);
    
    const { server, port, path: remotePath } = this.config;
    
    // Create deployment archive
    this.runCommand('tar -czf deployment.tar.gz -C dist .', 'Creating deployment archive');
    
    // Upload to server
    this.runCommand(
      `scp -P ${port} deployment.tar.gz ${server}:${remotePath}/`,
      'Uploading deployment archive'
    );
    
    // Extract and restart on server
    const remoteCommands = [
      `cd ${remotePath}`,
      'tar -xzf deployment.tar.gz',
      'npm ci --production',
      'pm2 restart ecommerce || pm2 start server/index.js --name ecommerce',
      'rm deployment.tar.gz'
    ].join(' && ');
    
    this.runCommand(
      `ssh -p ${port} ${server} "${remoteCommands}"`,
      'Extracting and restarting application on server'
    );
    
    console.log(`   ✅ Deployment to ${this.config.name} completed`);
  }

  /**
   * Cleanup
   */
  async cleanup() {
    console.log('\n🧹 Cleaning up...');
    
    // Remove temporary files
    ['dist', 'deployment.tar.gz'].forEach(item => {
      if (fs.existsSync(item)) {
        this.runCommand(`rm -rf ${item}`, `Removing ${item}`);
      }
    });
    
    console.log('   ✅ Cleanup completed');
  }

  /**
   * Main deployment process
   */
  async deploy() {
    const startTime = Date.now();
    
    try {
      await this.preDeploymentChecks();
      await this.installDependencies();
      await this.runTests();
      await this.buildApplication();
      await this.deployToServer();
      
      const duration = ((Date.now() - startTime) / 1000).toFixed(2);
      console.log(`\n🎉 Deployment completed successfully in ${duration}s`);
      console.log(`   Environment: ${this.config.name}`);
      console.log(`   Server: ${this.config.server}`);
      
    } catch (error) {
      console.error('\n💥 Deployment failed:', error.message);
      process.exit(1);
    } finally {
      await this.cleanup();
    }
  }
}

// CLI interface
if (require.main === module) {
  const environment = process.argv[2] || 'development';
  
  const deployer = new Deployer(environment);
  deployer.deploy().catch(console.error);
}

module.exports = Deployer;