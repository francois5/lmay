const chalk = require('chalk');
const ora = require('ora');
const path = require('path');
const fs = require('fs-extra');
const inquirer = require('inquirer');

const TEMPLATES = {
  basic: {
    name: 'Basic Project',
    description: 'Simple project with basic LMAY structure',
    files: ['root.lmay', 'lmay.config.json'],
    folders: ['src', 'docs']
  },
  web: {
    name: 'Web Application',
    description: 'Web application with frontend/backend structure',
    files: ['root.lmay', 'client.lmay', 'server.lmay', 'lmay.config.json'],
    folders: ['client', 'server', 'shared', 'docs']
  },
  microservices: {
    name: 'Microservices Architecture',
    description: 'Distributed microservices system',
    files: ['root.lmay', 'api-gateway.lmay', 'user-service.lmay', 'product-service.lmay'],
    folders: ['services', 'shared', 'infrastructure', 'docs']
  },
  distributed: {
    name: 'Distributed System',
    description: 'Complex distributed system with multiple components',
    files: ['root.lmay', 'core-services.lmay', 'edge-compute.lmay', 'data-pipeline.lmay', 'control-plane.lmay'],
    folders: ['core-services', 'edge-compute', 'data-pipeline', 'control-plane', 'infrastructure', 'monitoring']
  }
};

module.exports = async function initCommand(projectPath, options, command) {
  const spinner = ora('Initializing LMAY project...').start();

  try {
    const opts = command.optsWithGlobals();
    const targetPath = path.resolve(projectPath);
    
    if (opts.verbose) {
      spinner.info(`Target path: ${chalk.cyan(targetPath)}`);
    }

    // Ensure target directory exists
    await fs.ensureDir(targetPath);
    
    // Check if directory already contains LMAY files
    const existingFiles = await checkExistingLMAYFiles(targetPath);
    if (existingFiles.length > 0) {
      spinner.stop();
      
      const answer = await inquirer.prompt([{
        type: 'confirm',
        name: 'overwrite',
        message: `Directory contains existing LMAY files (${existingFiles.join(', ')}). Continue?`,
        default: false
      }]);
      
      if (!answer.overwrite) {
        console.log(chalk.yellow('Initialization cancelled'));
        return;
      }
      
      spinner.start('Continuing with initialization...');
    }

    let template = options.template;
    let projectConfig = {};

    // Interactive mode
    if (options.interactive) {
      spinner.stop();
      
      const answers = await inquirer.prompt([
        {
          type: 'list',
          name: 'template',
          message: 'Choose a project template:',
          choices: Object.entries(TEMPLATES).map(([key, template]) => ({
            name: `${template.name} - ${template.description}`,
            value: key
          }))
        },
        {
          type: 'input',
          name: 'projectName',
          message: 'Project name:',
          default: path.basename(targetPath),
          validate: input => input.trim().length > 0 || 'Project name is required'
        },
        {
          type: 'input',
          name: 'description',
          message: 'Project description:',
          default: 'A project documented with LMAY'
        },
        {
          type: 'checkbox',
          name: 'languages',
          message: 'Primary programming languages:',
          choices: [
            'javascript', 'typescript', 'python', 'java', 'go', 
            'rust', 'php', 'ruby', 'csharp', 'cpp', 'other'
          ]
        },
        {
          type: 'checkbox',
          name: 'frameworks',
          message: 'Frameworks/technologies used:',
          choices: [
            'react', 'vue', 'angular', 'express', 'fastapi', 
            'spring', 'django', 'flask', 'gin', 'fiber', 'other'
          ]
        },
        {
          type: 'confirm',
          name: 'includeExamples',
          message: 'Include example files and documentation?',
          default: true
        },
        {
          type: 'confirm',
          name: 'setupGitignore',
          message: 'Setup .gitignore for LMAY files?',
          default: true
        }
      ]);
      
      template = answers.template;
      projectConfig = {
        name: answers.projectName,
        description: answers.description,
        languages: answers.languages,
        frameworks: answers.frameworks,
        includeExamples: answers.includeExamples,
        setupGitignore: answers.setupGitignore
      };
      
      spinner.start('Generating project structure...');
    } else {
      // Non-interactive mode - use defaults
      projectConfig = {
        name: path.basename(targetPath),
        description: 'A project documented with LMAY',
        languages: ['javascript'],
        frameworks: [],
        includeExamples: options.examples,
        setupGitignore: true
      };
    }

    const templateConfig = TEMPLATES[template];
    if (!templateConfig) {
      throw new Error(`Unknown template: ${template}`);
    }

    if (opts.verbose) {
      spinner.info(`Using template: ${templateConfig.name}`);
    }

    // Create directory structure
    spinner.text = 'Creating directory structure...';
    
    if (!options.minimal) {
      for (const folder of templateConfig.folders) {
        await fs.ensureDir(path.join(targetPath, folder));
        
        if (opts.verbose) {
          console.log(`  ${chalk.green('✓')} Created directory: ${folder}`);
        }
      }
    }

    // Generate LMAY files
    spinner.text = 'Generating LMAY files...';
    await generateTemplateFiles(targetPath, template, projectConfig, opts.verbose);

    // Create configuration file
    spinner.text = 'Creating configuration file...';
    await createConfigFile(targetPath, projectConfig);

    // Setup .gitignore if requested
    if (projectConfig.setupGitignore) {
      spinner.text = 'Setting up .gitignore...';
      await setupGitignore(targetPath);
    }

    // Copy example files if requested
    if (projectConfig.includeExamples && !options.minimal) {
      spinner.text = 'Copying example files...';
      await copyExampleFiles(targetPath, template);
    }

    // Create README if it doesn't exist
    const readmePath = path.join(targetPath, 'README.md');
    if (!await fs.pathExists(readmePath)) {
      spinner.text = 'Creating README.md...';
      await createReadme(targetPath, projectConfig, template);
    }

    spinner.succeed('LMAY project initialized successfully!');

    // Display summary
    console.log(chalk.green('\n📁 Project Structure Created:'));
    console.log(`  ${chalk.blue('→')} Template: ${templateConfig.name}`);
    console.log(`  ${chalk.blue('→')} LMAY files: ${templateConfig.files.length}`);
    
    if (!options.minimal) {
      console.log(`  ${chalk.blue('→')} Directories: ${templateConfig.folders.length}`);
    }

    // Next steps
    console.log(chalk.cyan('\n💡 Next Steps:'));
    console.log(`  1. ${chalk.bold('cd')} ${path.relative(process.cwd(), targetPath)}`);
    console.log(`  2. Customize the generated ${chalk.bold('root.lmay')} file`);
    console.log(`  3. Generate documentation: ${chalk.bold('lmay generate')}`);
    console.log(`  4. Validate your setup: ${chalk.bold('lmay validate')}`);
    
    if (projectConfig.includeExamples) {
      console.log(`  5. Review the example files in ${chalk.bold('docs/')} directory`);
    }

  } catch (error) {
    spinner.fail(`Initialization failed: ${error.message}`);
    
    if (opts.verbose) {
      console.error(chalk.red('\n🔍 Error details:'));
      console.error(error.stack);
    }
    
    process.exit(1);
  }
};

async function checkExistingLMAYFiles(directory) {
  const lmayFiles = [];
  
  try {
    const files = await fs.readdir(directory);
    for (const file of files) {
      if (file.endsWith('.lmay')) {
        lmayFiles.push(file);
      }
    }
  } catch (error) {
    // Directory doesn't exist or can't be read
  }
  
  return lmayFiles;
}

async function generateTemplateFiles(targetPath, template, config, verbose) {
  const templateConfig = TEMPLATES[template];
  
  // Generate root.lmay
  const rootLmayContent = generateRootLMAY(config, template);
  await fs.writeFile(path.join(targetPath, 'root.lmay'), rootLmayContent);
  
  if (verbose) {
    console.log(`  ${chalk.green('✓')} Generated: root.lmay`);
  }

  // Generate additional template-specific files
  switch (template) {
    case 'web':
      await generateWebTemplate(targetPath, config, verbose);
      break;
      
    case 'microservices':
      await generateMicroservicesTemplate(targetPath, config, verbose);
      break;
      
    case 'distributed':
      await generateDistributedTemplate(targetPath, config, verbose);
      break;
  }
}

function generateRootLMAY(config, template) {
  const now = new Date().toISOString();
  
  return `lmay_version: "1.0"

project:
  name: "${config.name}"
  version: "1.0.0"
  description: "${config.description}"
  languages: ${JSON.stringify(config.languages)}
  ${config.frameworks.length > 0 ? `frameworks: ${JSON.stringify(config.frameworks)}` : ''}

architecture:
  pattern: "${getArchitecturePattern(template)}"
  entry_points:
    - file: "src/index.js"
      type: "main"

structure:
  src:
    path: "src"
    type: "directory"
    description: "Main source code directory"
    primary_language: "${config.languages[0] || 'javascript'}"

  docs:
    path: "docs"
    type: "directory"
    description: "Documentation and examples"

dependencies:
  external: []

interfaces: []

metadata:
  generated_at: "${now}"
  template: "${template}"
  generator_version: "1.0.0"
`;
}

function getArchitecturePattern(template) {
  const patterns = {
    basic: 'Layered',
    web: 'MVC',
    microservices: 'Microservices',
    distributed: 'Distributed'
  };
  
  return patterns[template] || 'Layered';
}

async function generateWebTemplate(targetPath, config, verbose) {
  // Generate client.lmay
  const clientContent = `lmay_version: "1.0"

module:
  type: "frontend"
  role: "Client-side application and user interface"
  parent: "root.lmay"

hierarchy:
  depth: 1
  parent: "../root.lmay"

project:
  name: "${config.name}-client"
  description: "Frontend client application"
  technology_stack: ["${config.languages.join('", "')}"]

structure:
  src:
    path: "client/src"
    type: "directory"
    description: "Client source code"
    primary_language: "${config.languages[0] || 'javascript'}"

interfaces:
  - type: "HTTP"
    description: "API communication with backend"
    endpoint: "/api"
`;
  
  await fs.writeFile(path.join(targetPath, 'client.lmay'), clientContent);
  
  if (verbose) {
    console.log(`  ${chalk.green('✓')} Generated: client.lmay`);
  }

  // Generate server.lmay
  const serverContent = `lmay_version: "1.0"

module:
  type: "backend"
  role: "Server-side application and API services"
  parent: "root.lmay"

hierarchy:
  depth: 1
  parent: "../root.lmay"

project:
  name: "${config.name}-server"
  description: "Backend server application"
  technology_stack: ["${config.languages.join('", "')}"]

structure:
  src:
    path: "server/src"
    type: "directory"
    description: "Server source code"
    primary_language: "${config.languages[0] || 'javascript'}"

interfaces:
  - type: "REST"
    description: "Main API endpoints"
    endpoint: "http://localhost:3000/api"
`;
  
  await fs.writeFile(path.join(targetPath, 'server.lmay'), serverContent);
  
  if (verbose) {
    console.log(`  ${chalk.green('✓')} Generated: server.lmay`);
  }
}

async function generateMicroservicesTemplate(targetPath, config, verbose) {
  const services = ['user-service', 'product-service', 'order-service'];
  
  for (const service of services) {
    const serviceContent = `lmay_version: "1.0"

module:
  type: "microservice"
  role: "${service.replace('-', ' ')} implementation"
  parent: "root.lmay"

hierarchy:
  depth: 1
  parent: "../root.lmay"

project:
  name: "${config.name}-${service}"
  description: "${service.replace('-', ' ')} microservice"
  technology_stack: ["${config.languages.join('", "')}"]

structure:
  src:
    path: "services/${service}/src"
    type: "directory"
    description: "${service} source code"
    primary_language: "${config.languages[0] || 'javascript'}"

interfaces:
  - type: "REST"
    description: "${service} API endpoints"
    endpoint: "http://localhost:300X/api"
  - type: "gRPC"
    description: "Inter-service communication"
`;
    
    await fs.writeFile(path.join(targetPath, `${service}.lmay`), serviceContent);
    
    if (verbose) {
      console.log(`  ${chalk.green('✓')} Generated: ${service}.lmay`);
    }
  }

  // Generate API gateway
  const gatewayContent = `lmay_version: "1.0"

module:
  type: "api_gateway"
  role: "Central entry point and request routing"
  parent: "root.lmay"

hierarchy:
  depth: 1
  parent: "../root.lmay"

project:
  name: "${config.name}-gateway"
  description: "API Gateway for microservices"
  technology_stack: ["${config.languages.join('", "')}"]

structure:
  src:
    path: "api-gateway/src"
    type: "directory"
    description: "API Gateway source code"
    primary_language: "${config.languages[0] || 'javascript'}"

interfaces:
  - type: "REST"
    description: "Public API gateway endpoint"
    endpoint: "http://localhost:8080/api"
`;
  
  await fs.writeFile(path.join(targetPath, 'api-gateway.lmay'), gatewayContent);
  
  if (verbose) {
    console.log(`  ${chalk.green('✓')} Generated: api-gateway.lmay`);
  }
}

async function generateDistributedTemplate(targetPath, config, verbose) {
  // This would generate the complex distributed system files
  // For now, create simplified versions
  const modules = ['core-services', 'edge-compute', 'data-pipeline', 'control-plane'];
  
  for (const module of modules) {
    const moduleContent = `lmay_version: "1.0"

module:
  type: "${module.replace('-', '_')}"
  role: "${module.replace('-', ' ')} components"
  parent: "root.lmay"

hierarchy:
  depth: 1
  parent: "../root.lmay"

project:
  name: "${config.name}-${module}"
  description: "${module.replace('-', ' ')} module"
  technology_stack: ["${config.languages.join('", "')}"]

structure:
  ${module}:
    path: "${module}"
    type: "directory"
    description: "${module.replace('-', ' ')} implementation"
    primary_language: "${config.languages[0] || 'javascript'}"

interfaces:
  - type: "gRPC"
    description: "Inter-service communication"
  - type: "HTTP"
    description: "Management interfaces"
`;
    
    await fs.writeFile(path.join(targetPath, `${module}.lmay`), moduleContent);
    
    if (verbose) {
      console.log(`  ${chalk.green('✓')} Generated: ${module}.lmay`);
    }
  }
}

async function createConfigFile(targetPath, config) {
  const configContent = {
    lmay: {
      version: "1.0",
      autoGenerate: true,
      validateOnSave: true
    },
    analysis: {
      excludePatterns: [
        "node_modules/**",
        ".git/**",
        "*.log",
        "dist/**",
        "build/**"
      ],
      includeHidden: false,
      maxDepth: 10,
      languageDetection: true
    },
    output: {
      rootFile: "root.lmay",
      indent: 2,
      format: "yaml"
    },
    structure: {
      createModuleFiles: true,
      groupByLanguage: false,
      includeTests: true
    },
    validation: {
      strict: false,
      checkReferences: true,
      checkHierarchy: true
    }
  };
  
  await fs.writeFile(
    path.join(targetPath, 'lmay.config.json'),
    JSON.stringify(configContent, null, 2)
  );
}

async function setupGitignore(targetPath) {
  const gitignorePath = path.join(targetPath, '.gitignore');
  const lmayIgnoreRules = `
# LMAY generated files (uncomment if you want to ignore them)
# *.lmay
# lmay.config.json

# LMAY cache and temporary files
.lmay-cache/
.lmay-temp/
`;
  
  let existingContent = '';
  if (await fs.pathExists(gitignorePath)) {
    existingContent = await fs.readFile(gitignorePath, 'utf8');
  }
  
  if (!existingContent.includes('LMAY')) {
    await fs.writeFile(gitignorePath, existingContent + lmayIgnoreRules);
  }
}

async function copyExampleFiles(targetPath, template) {
  const docsPath = path.join(targetPath, 'docs');
  await fs.ensureDir(docsPath);
  
  // Create a simple example file
  const exampleContent = `# LMAY Project Examples

This directory contains examples and documentation for your LMAY project.

## Template: ${TEMPLATES[template].name}

${TEMPLATES[template].description}

## Getting Started

1. Review the generated \`root.lmay\` file
2. Customize the project structure and descriptions
3. Run \`lmay generate\` to update documentation
4. Use \`lmay validate\` to check compliance

## Resources

- [LMAY Specification](https://github.com/francois5/lmay)
- [LMAY Examples](https://github.com/francois5/lmay/tree/main/examples)
- [Best Practices Guide](https://github.com/francois5/lmay/docs)
`;
  
  await fs.writeFile(path.join(docsPath, 'README.md'), exampleContent);
}

async function createReadme(targetPath, config, template) {
  const readmeContent = `# ${config.name}

${config.description}

## LMAY Documentation

This project uses [LMAY (LMAY Markup for AI in YAML)](https://github.com/francois5/lmay) for AI-friendly documentation.

### Template: ${TEMPLATES[template].name}

${TEMPLATES[template].description}

## Quick Start

\`\`\`bash
# Generate LMAY documentation
lmay generate

# Validate LMAY files
lmay validate

# Check project status
lmay status
\`\`\`

## Project Structure

The LMAY documentation files provide a semantic map of the project structure:

- \`root.lmay\` - Main project documentation
${TEMPLATES[template].files.slice(1).map(file => `- \`${file}\` - ${file.replace('.lmay', '').replace('-', ' ')} documentation`).join('\n')}

## Development

[Add your development instructions here]

## Contributing

[Add your contributing guidelines here]

## License

[Add your license information here]
`;
  
  await fs.writeFile(path.join(targetPath, 'README.md'), readmeContent);
}