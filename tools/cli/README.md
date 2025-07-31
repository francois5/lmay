# LMAY CLI - Unified Command Line Interface

The LMAY CLI provides a comprehensive command-line interface for managing LMAY (LMAY Markup for AI in YAML) projects. It combines all LMAY tools into a single, easy-to-use interface.

## Installation

### Global Installation (Recommended)

```bash
npm install -g lmay-cli
```

### Local Installation

```bash
npm install lmay-cli
npx lmay --help
```

### Development Installation

```bash
cd tools/cli
npm install
npm link
```

## Quick Start

```bash
# Initialize a new LMAY project
lmay init --interactive

# Generate LMAY documentation
lmay generate

# Validate LMAY files
lmay validate

# Check project status
lmay status --coverage
```

## Commands

### `lmay init`

Initialize a new LMAY project with templates and configuration.

```bash
# Interactive initialization
lmay init --interactive

# Initialize with specific template
lmay init --template microservices

# Minimal setup
lmay init --minimal
```

**Options:**
- `-t, --template <type>` - Project template (basic|web|microservices|distributed)
- `--interactive` - Interactive setup mode
- `--minimal` - Create minimal LMAY structure
- `--examples` - Include example files

### `lmay generate`

Generate LMAY documentation from project analysis.

```bash
# Generate for current directory
lmay generate

# Generate with custom output
lmay generate ./src --output ./docs

# Distributed system generation
lmay generate --distributed --scan-remote

# Dry run to preview
lmay generate --dry-run
```

**Options:**
- `-o, --output <dir>` - Output directory
- `-c, --config <file>` - Custom configuration file
- `--dry-run` - Preview without creating files
- `--distributed` - Enable distributed system features
- `--scan-remote` - Include remote server scanning
- `--overwrite` - Overwrite existing files

### `lmay validate`

Validate LMAY files according to specification.

```bash
# Validate current project
lmay validate

# Validate specific file
lmay validate root.lmay

# Strict validation with fixes
lmay validate --strict --fix

# Generate SARIF report
lmay validate --format sarif --output report.sarif
```

**Options:**
- `-p, --project <path>` - Validate entire project
- `-s, --strict` - Enable strict validation
- `--no-references` - Skip reference validation
- `--no-hierarchy` - Skip hierarchy validation
- `-f, --format <format>` - Output format (text|json|sarif)
- `-o, --output <file>` - Save report to file
- `--fix` - Attempt automatic fixes

### `lmay status`

Show LMAY project status and health.

```bash
# Basic status check
lmay status

# Detailed coverage analysis
lmay status --coverage

# Check for outdated files
lmay status --outdated

# Full health report
lmay status --files --dependencies --coverage
```

**Options:**
- `--files` - List all LMAY files
- `--coverage` - Show documentation coverage
- `--outdated` - Check for outdated files
- `--dependencies` - Show dependency analysis

### `lmay batch`

Process multiple projects or files in batch mode.

```bash
# Batch generate for multiple projects
lmay batch generate ./project1 ./project2 ./project3

# Batch validate with parallel processing
lmay batch validate *.lmay --parallel 8

# Continue on errors with report
lmay batch generate ./projects/* --continue-on-error --output batch-report.json
```

**Options:**
- `-c, --config <file>` - Batch configuration file
- `--parallel <num>` - Number of parallel processes
- `--continue-on-error` - Continue on errors
- `-o, --output <dir>` - Output directory for results

### `lmay config`

Manage LMAY configuration settings.

```bash
# Interactive configuration
lmay config

# List current settings
lmay config --list

# Set specific value
lmay config --set analysis.maxDepth=15

# Get specific value
lmay config --get output.format

# Reset to defaults
lmay config --reset
```

**Options:**
- `--list` - List current configuration
- `--set <key=value>` - Set configuration value
- `--get <key>` - Get configuration value
- `--reset` - Reset to defaults
- `--global` - Use global configuration

### `lmay doctor`

Diagnose LMAY setup and common issues.

```bash
# Run diagnostics
lmay doctor

# Auto-fix issues
lmay doctor --fix

# Verbose diagnostics
lmay doctor --verbose
```

**Options:**
- `--fix` - Attempt to fix detected issues
- `--verbose` - Show detailed diagnostic information

## Global Options

Available for all commands:

- `-v, --verbose` - Enable verbose output
- `--no-color` - Disable colored output
- `--help` - Show help information

## Configuration

LMAY CLI looks for configuration in the following order:

1. Command-line options
2. Project configuration (`./lmay.config.json`)
3. User global configuration (`~/.lmayrc`)
4. Environment variables (`LMAY_*`)
5. Default values

### Configuration File Example

```json
{
  "lmay": {
    "version": "1.0",
    "autoGenerate": true,
    "validateOnSave": true
  },
  "analysis": {
    "excludePatterns": [
      "node_modules/**",
      ".git/**",
      "*.log",
      "dist/**"
    ],
    "maxDepth": 10,
    "languageDetection": true
  },
  "output": {
    "rootFile": "root.lmay",
    "format": "yaml",
    "indent": 2
  }
}
```

## Templates

### Basic Template
Simple project with basic LMAY structure.

### Web Application Template
Frontend/backend web application structure.

### Microservices Template
Distributed microservices architecture.

### Distributed System Template
Complex distributed system with multiple components.

## Examples

### Initialize and Set Up

```bash
# Create new project with interactive setup
mkdir my-project && cd my-project
lmay init --interactive

# Choose microservices template
# Configure project settings
# Generate initial documentation
```

### Development Workflow

```bash
# Daily development workflow
lmay status                    # Check project health
lmay generate                  # Update documentation
lmay validate --fix            # Validate and fix issues
git add *.lmay && git commit   # Commit changes
```

### CI/CD Integration

```bash
# In your CI/CD pipeline
lmay validate --strict --format sarif --output lmay-report.sarif
lmay status --coverage --outdated

# Fail build if validation fails
lmay doctor --verbose
```

### Batch Processing

```bash
# Process multiple microservices
lmay batch generate ./services/* --parallel 4

# Validate all services
lmay batch validate ./services/*/root.lmay --format json --output validation-results.json
```

## Environment Variables

- `LMAY_VERBOSE=true` - Enable verbose output
- `LMAY_CONFIG=/path/to/config.json` - Custom config file
- `LMAY_NO_COLOR=true` - Disable colored output

## Related Tools

### LMAY Updater
For automatic maintenance during refactoring, use the LMAY Updater tool:

```bash
# Install separately
npm install -g lmay-updater

# Watch for changes and auto-update
lmay-updater watch --auto-commit

# Setup Git hooks for seamless integration
lmay-updater setup-hooks --all

# Analyze refactoring patterns
lmay-updater analyze --patterns --recommendations
```

The LMAY Updater provides:
- Real-time change monitoring
- Intelligent refactoring detection  
- Automatic Git integration
- Pattern analysis and recommendations
- Backup and rollback capabilities

See the [LMAY Updater documentation](../updater/README.md) for detailed usage.

## Integration

### VS Code Integration

The CLI can be integrated with VS Code through tasks and extensions:

```json
// .vscode/tasks.json
{
  "version": "2.0.0",
  "tasks": [
    {
      "label": "LMAY: Generate",
      "type": "shell",
      "command": "lmay generate",
      "group": "build"
    },
    {
      "label": "LMAY: Validate",
      "type": "shell",
      "command": "lmay validate --verbose",
      "group": "test"
    }
  ]
}
```

### Git Hooks

Pre-commit hook example:

```bash
#!/bin/sh
# .git/hooks/pre-commit
lmay validate --strict
if [ $? -ne 0 ]; then
  echo "LMAY validation failed. Please fix errors before committing."
  exit 1
fi
```

## Troubleshooting

### Common Issues

1. **Command not found**: Ensure LMAY CLI is installed globally or use `npx lmay`
2. **Permission errors**: Check file permissions and run with appropriate privileges
3. **Configuration errors**: Use `lmay config --reset` to restore defaults
4. **Validation failures**: Run `lmay doctor` to diagnose issues

### Getting Help

- Run `lmay --help` for general help
- Run `lmay <command> --help` for command-specific help
- Use `--verbose` flag for detailed error information
- Run `lmay doctor` for system diagnostics

## Contributing

Contributions are welcome! Please see the main [CONTRIBUTING.md](../../CONTRIBUTING.md) for guidelines.

## License

This project is licensed under the [Mozilla Public License 2.0](../../LICENSE.md).

---

*For more information, visit the [LMAY project repository](https://github.com/francois5/lmay).*