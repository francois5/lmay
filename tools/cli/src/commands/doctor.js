const chalk = require('chalk');
const ora = require('ora');
const path = require('path');
const fs = require('fs-extra');
const { execSync } = require('child_process');

module.exports = async function doctorCommand(options) {
  const spinner = ora('Running LMAY diagnostics...').start();

  try {
    const diagnostics = [];
    const fixes = [];
    
    console.log(chalk.cyan('\n🏥 LMAY Health Diagnostics'));
    console.log('='.repeat(50));

    // Check Node.js version
    spinner.text = 'Checking Node.js version...';
    await checkNodeVersion(diagnostics, fixes);

    // Check LMAY installation
    spinner.text = 'Checking LMAY installation...';
    await checkLMAYInstallation(diagnostics, fixes);

    // Check project structure
    spinner.text = 'Analyzing project structure...';
    await checkProjectStructure(diagnostics, fixes);

    // Check LMAY files
    spinner.text = 'Validating LMAY files...';
    await checkLMAYFiles(diagnostics, fixes);

    // Check configuration
    spinner.text = 'Checking configuration...';
    await checkConfiguration(diagnostics, fixes);

    // Check dependencies
    spinner.text = 'Checking dependencies...';
    await checkDependencies(diagnostics, fixes);

    // Check file permissions
    spinner.text = 'Checking file permissions...';
    await checkPermissions(diagnostics, fixes);

    spinner.succeed('Diagnostics completed');

    // Display results
    console.log(chalk.cyan('\n📊 Diagnostic Results:'));
    
    const errorCount = diagnostics.filter(d => d.level === 'error').length;
    const warningCount = diagnostics.filter(d => d.level === 'warning').length;
    const infoCount = diagnostics.filter(d => d.level === 'info').length;

    console.log(`  ${chalk.red('Errors:')} ${errorCount}`);
    console.log(`  ${chalk.yellow('Warnings:')} ${warningCount}`);
    console.log(`  ${chalk.blue('Info:')} ${infoCount}`);

    // Display diagnostics
    if (diagnostics.length > 0) {
      console.log(chalk.cyan('\n🔍 Detailed Results:'));
      
      diagnostics.forEach((diagnostic, index) => {
        const icon = getStatusIcon(diagnostic.level);
        console.log(`\n  ${index + 1}. ${icon} ${diagnostic.title}`);
        console.log(`     ${chalk.dim(diagnostic.description)}`);
        
        if (diagnostic.details && options.verbose) {
          console.log(`     ${chalk.dim('Details:')} ${diagnostic.details}`);
        }
        
        if (diagnostic.fix) {
          console.log(`     ${chalk.dim('Fix:')} ${diagnostic.fix}`);
        }
      });
    }

    // Auto-fix if requested
    if (options.fix && fixes.length > 0) {
      console.log(chalk.cyan('\n🔧 Applying automatic fixes...'));
      
      let fixedCount = 0;
      for (const fix of fixes) {
        try {
          console.log(`  ${chalk.blue('→')} ${fix.description}`);
          await fix.action();
          fixedCount++;
          console.log(`    ${chalk.green('✓')} Fixed`);
        } catch (error) {
          console.log(`    ${chalk.red('✗')} Failed: ${error.message}`);
        }
      }
      
      console.log(chalk.green(`\n✨ Applied ${fixedCount}/${fixes.length} fixes`));
      
      if (fixedCount > 0) {
        console.log(chalk.dim('Run "lmay doctor" again to verify fixes'));
      }
    }

    // Recommendations
    const hasIssues = errorCount > 0 || warningCount > 0;
    if (hasIssues) {
      console.log(chalk.cyan('\n💡 Recommendations:'));
      
      if (errorCount > 0) {
        console.log('  • Address errors to ensure LMAY functions properly');
      }
      
      if (warningCount > 0) {
        console.log('  • Review warnings for optimal performance');
      }
      
      if (fixes.length > 0 && !options.fix) {
        console.log('  • Run "lmay doctor --fix" to automatically resolve fixable issues');
      }
      
      if (!options.verbose) {
        console.log('  • Use --verbose for detailed diagnostic information');
      }
    } else {
      console.log(chalk.green('\n✅ All checks passed! LMAY is ready to use.'));
    }

    // Quick start guide for new users
    if (diagnostics.some(d => d.category === 'project' && d.level === 'warning')) {
      console.log(chalk.cyan('\n🚀 Quick Start:'));
      console.log('  1. Initialize LMAY: lmay init --interactive');
      console.log('  2. Generate docs: lmay generate');
      console.log('  3. Validate setup: lmay validate');
    }

    process.exit(errorCount > 0 ? 1 : 0);

  } catch (error) {
    spinner.fail(`Diagnostics failed: ${error.message}`);
    
    if (options.verbose) {
      console.error(chalk.red('\n🔍 Error details:'));
      console.error(error.stack);
    }
    
    process.exit(1);
  }
};

async function checkNodeVersion(diagnostics, fixes) {
  try {
    const nodeVersion = process.version;
    const majorVersion = parseInt(nodeVersion.substring(1).split('.')[0]);
    
    if (majorVersion < 14) {
      diagnostics.push({
        category: 'system',
        level: 'error',
        title: 'Node.js version too old',
        description: `Current version: ${nodeVersion}. LMAY requires Node.js 14.0.0 or higher.`,
        fix: 'Update Node.js to version 14 or higher'
      });
    } else if (majorVersion < 16) {
      diagnostics.push({
        category: 'system',
        level: 'warning',
        title: 'Node.js version compatibility',
        description: `Current version: ${nodeVersion}. Consider upgrading to Node.js 16+ for better performance.`,
        fix: 'Update Node.js to the latest LTS version'
      });
    } else {
      diagnostics.push({
        category: 'system',
        level: 'info',
        title: 'Node.js version',
        description: `Version ${nodeVersion} is compatible with LMAY`
      });
    }
  } catch (error) {
    diagnostics.push({
      category: 'system',
      level: 'error',
      title: 'Cannot detect Node.js version',
      description: error.message
    });
  }
}

async function checkLMAYInstallation(diagnostics, fixes) {
  try {
    // Check if LMAY CLI is properly installed
    const packagePath = path.join(__dirname, '../../package.json');
    
    if (await fs.pathExists(packagePath)) {
      const pkg = JSON.parse(await fs.readFile(packagePath, 'utf8'));
      
      diagnostics.push({
        category: 'installation',
        level: 'info',
        title: 'LMAY CLI installation',
        description: `Version ${pkg.version} installed correctly`
      });
    } else {
      diagnostics.push({
        category: 'installation',
        level: 'error',
        title: 'LMAY CLI not properly installed',
        description: 'Package.json not found in expected location'
      });
    }

    // Check for related tools
    const generatorPath = path.join(__dirname, '../../../generator');
    const validatorPath = path.join(__dirname, '../../../validator');
    
    if (!await fs.pathExists(generatorPath)) {
      diagnostics.push({
        category: 'installation',
        level: 'error',
        title: 'LMAY Generator missing',
        description: 'Generator tool not found in tools directory'
      });
    }
    
    if (!await fs.pathExists(validatorPath)) {
      diagnostics.push({
        category: 'installation',
        level: 'error',
        title: 'LMAY Validator missing',
        description: 'Validator tool not found in tools directory'  
      });
    }

  } catch (error) {
    diagnostics.push({
      category: 'installation',
      level: 'error',
      title: 'Installation check failed',
      description: error.message
    });
  }
}

async function checkProjectStructure(diagnostics, fixes) {
  try {
    const cwd = process.cwd();
    
    // Check if we're in a valid project directory
    const hasPackageJson = await fs.pathExists(path.join(cwd, 'package.json'));
    const hasGitRepo = await fs.pathExists(path.join(cwd, '.git'));
    const hasLMAYFiles = (await fs.readdir(cwd)).some(file => file.endsWith('.lmay'));
    
    if (!hasPackageJson && !hasGitRepo && !hasLMAYFiles) {
      diagnostics.push({
        category: 'project',
        level: 'warning',
        title: 'Not in a project directory',
        description: 'Current directory does not appear to be a project root',
        fix: 'Navigate to your project directory or initialize a new project'
      });
    } else {
      diagnostics.push({
        category: 'project',
        level: 'info',
        title: 'Project directory detected',
        description: 'Current directory appears to be a valid project'
      });
    }

    // Check for LMAY initialization
    if (!hasLMAYFiles) {
      diagnostics.push({
        category: 'project',
        level: 'warning',
        title: 'LMAY not initialized',
        description: 'No LMAY files found in current project',
        fix: 'Run "lmay init" to initialize LMAY documentation'
      });
      
      fixes.push({
        description: 'Initialize LMAY with basic template',
        action: async () => {
          const initCommand = require('./init');
          await initCommand(cwd, { template: 'basic' }, { optsWithGlobals: () => ({}) });
        }
      });
    }

  } catch (error) {
    diagnostics.push({
      category: 'project',
      level: 'error',
      title: 'Project structure check failed',
      description: error.message
    });
  }
}

async function checkLMAYFiles(diagnostics, fixes) {
  try {
    const cwd = process.cwd();
    const lmayFiles = [];
    
    // Find LMAY files
    await findLMAYFiles(cwd, lmayFiles);
    
    if (lmayFiles.length === 0) {
      return; // Already handled in project structure check
    }

    diagnostics.push({
      category: 'lmay',
      level: 'info',
      title: 'LMAY files found',
      description: `Found ${lmayFiles.length} LMAY files in project`
    });

    // Validate each LMAY file
    for (const file of lmayFiles) {
      try {
        const content = await fs.readFile(file, 'utf8');
        
        // Basic YAML syntax check
        const yaml = require('yaml');
        const parsed = yaml.parse(content);
        
        // Check required fields
        if (!parsed.lmay_version) {
          diagnostics.push({
            category: 'lmay',
            level: 'error',
            title: `Invalid LMAY file: ${path.basename(file)}`,
            description: 'Missing required lmay_version field',
            fix: 'Add lmay_version: "1.0" to the file'
          });
          
          fixes.push({
            description: `Fix ${path.basename(file)} - add lmay_version`,
            action: async () => {
              const updatedContent = `lmay_version: "1.0"\n${content}`;
              await fs.writeFile(file, updatedContent);
            }
          });
        }
        
        if (!parsed.project) {
          diagnostics.push({
            category: 'lmay',
            level: 'warning',
            title: `Incomplete LMAY file: ${path.basename(file)}`,
            description: 'Missing project section',
            fix: 'Add project metadata section'
          });
        }
        
      } catch (yamlError) {
        diagnostics.push({
          category: 'lmay',
          level: 'error',
          title: `Invalid YAML in ${path.basename(file)}`,
          description: yamlError.message,
          fix: 'Fix YAML syntax errors'
        });
      }
    }

  } catch (error) {
    diagnostics.push({
      category: 'lmay',
      level: 'error',
      title: 'LMAY file check failed',
      description: error.message
    });
  }
}

async function findLMAYFiles(directory, files, basePath = '') {
  try {
    const entries = await fs.readdir(directory);
    
    for (const entry of entries) {
      if (entry.startsWith('.')) continue;
      
      const fullPath = path.join(directory, entry);
      const stat = await fs.stat(fullPath);
      
      if (stat.isFile() && entry.endsWith('.lmay')) {
        files.push(fullPath);
      } else if (stat.isDirectory() && !shouldSkipDirectory(entry)) {
        await findLMAYFiles(fullPath, files, path.join(basePath, entry));
      }
    }
  } catch (error) {
    // Ignore directory read errors
  }
}

function shouldSkipDirectory(name) {
  const skipDirs = ['node_modules', '.git', 'dist', 'build', '__pycache__'];
  return skipDirs.includes(name);
}

async function checkConfiguration(diagnostics, fixes) {
  try {
    const configPaths = [
      path.join(process.cwd(), 'lmay.config.json'),
      path.join(require('os').homedir(), '.lmayrc')
    ];
    
    let configFound = false;
    
    for (const configPath of configPaths) {
      if (await fs.pathExists(configPath)) {
        configFound = true;
        
        try {
          const content = await fs.readFile(configPath, 'utf8');
          JSON.parse(content); // Validate JSON
          
          diagnostics.push({
            category: 'config',
            level: 'info',
            title: 'Configuration file valid',
            description: `Found valid config at ${configPath}`
          });
          
        } catch (jsonError) {
          diagnostics.push({
            category: 'config',
            level: 'error',
            title: 'Invalid configuration file',
            description: `JSON parsing error in ${configPath}: ${jsonError.message}`,
            fix: 'Fix JSON syntax or reset configuration'
          });
          
          fixes.push({
            description: `Reset ${path.basename(configPath)} to defaults`,
            action: async () => {
              const defaultConfig = {
                lmay: { version: "1.0", autoGenerate: true },
                analysis: { excludePatterns: ["node_modules/**", ".git/**"] },
                output: { rootFile: "root.lmay", format: "yaml" }
              };
              await fs.writeFile(configPath, JSON.stringify(defaultConfig, null, 2));
            }
          });
        }
        break;
      }
    }
    
    if (!configFound) {
      diagnostics.push({
        category: 'config',
        level: 'info',
        title: 'No configuration file found',
        description: 'Using default LMAY configuration',
        fix: 'Create a configuration file with "lmay config"'
      });
    }

  } catch (error) {
    diagnostics.push({
      category: 'config',
      level: 'error',
      title: 'Configuration check failed',
      description: error.message
    });
  }
}

async function checkDependencies(diagnostics, fixes) {
  try {
    const requiredModules = ['commander', 'chalk', 'ora', 'inquirer', 'fs-extra'];
    
    for (const module of requiredModules) {
      try {
        require.resolve(module);
      } catch (error) {
        diagnostics.push({
          category: 'dependencies',
          level: 'error',
          title: `Missing dependency: ${module}`,
          description: 'Required Node.js module not found',
          fix: `Install with: npm install ${module}`
        });
        
        fixes.push({
          description: `Install ${module}`,
          action: async () => {
            execSync(`npm install ${module}`, { cwd: __dirname });
          }
        });
      }
    }
    
    // Check for optional dependencies
    const optionalModules = ['yaml'];
    
    for (const module of optionalModules) {
      try {
        require.resolve(module);
        diagnostics.push({
          category: 'dependencies',
          level: 'info',
          title: `Optional dependency available: ${module}`,
          description: 'Enhanced features enabled'
        });
      } catch (error) {
        diagnostics.push({
          category: 'dependencies',
          level: 'warning',
          title: `Optional dependency missing: ${module}`,
          description: 'Some features may be limited',
          fix: `Install with: npm install ${module}`
        });
      }
    }

  } catch (error) {
    diagnostics.push({
      category: 'dependencies',
      level: 'error',
      title: 'Dependency check failed',
      description: error.message
    });
  }
}

async function checkPermissions(diagnostics, fixes) {
  try {
    const cwd = process.cwd();
    
    // Check read permissions
    try {
      await fs.access(cwd, fs.constants.R_OK);
    } catch (error) {
      diagnostics.push({
        category: 'permissions',
        level: 'error',
        title: 'Cannot read current directory',
        description: 'Insufficient read permissions',
        fix: 'Check directory permissions'
      });
    }
    
    // Check write permissions
    try {
      await fs.access(cwd, fs.constants.W_OK);
      
      diagnostics.push({
        category: 'permissions',
        level: 'info',
        title: 'File permissions',
        description: 'Read and write permissions available'
      });
    } catch (error) {
      diagnostics.push({
        category: 'permissions',
        level: 'error',
        title: 'Cannot write to current directory',
        description: 'Insufficient write permissions',
        fix: 'Check directory permissions or run with appropriate privileges'
      });
    }

  } catch (error) {
    diagnostics.push({
      category: 'permissions',
      level: 'error',
      title: 'Permission check failed',
      description: error.message
    });
  }
}

function getStatusIcon(level) {
  switch (level) {
    case 'error': return chalk.red('✗');
    case 'warning': return chalk.yellow('⚠');
    case 'info': return chalk.blue('ℹ');
    default: return chalk.gray('•');
  }
}