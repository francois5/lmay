# LMAY Tools

This directory contains the complete LMAY toolchain for creating, validating, and maintaining LMAY documentation. Each tool serves a specific purpose in the LMAY ecosystem and can be used independently or together for a complete workflow.

## Tool Overview

| Tool | Purpose | Status | CLI Command |
|------|---------|--------|-------------|
| [**Generator**](./generator/) | Automatically create LMAY documentation from code analysis | ✅ Complete | `lmay-generator` |
| [**Validator**](./validator/) | Validate LMAY files against specification | ✅ Complete | `lmay-validator` |
| [**Updater**](./updater/) | Automatically maintain LMAY during refactoring | ✅ Complete | `lmay-updater` |
| [**CLI**](./cli/) | Unified command-line interface | ✅ Complete | `lmay` |
| [**Maintenance**](./maintenance/) | Legacy maintenance utilities | ✅ Complete | `lmay-maintenance` |

## Quick Installation

### Individual Tools
```bash
# Install specific tools as needed
npm install -g lmay-generator
npm install -g lmay-validator
npm install -g lmay-updater
npm install -g lmay-cli
```

### Complete Toolchain
```bash
# Install all tools at once
npm install -g lmay-generator lmay-validator lmay-updater lmay-cli
```

## Recommended Workflow

### 1. Project Initialization
```bash
# Start with the unified CLI
lmay init --interactive

# Or initialize manually
lmay-generator generate --dry-run
lmay-validator validate --fix
```

### 2. Development Workflow
```bash
# Set up automatic updates (recommended)
lmay-updater setup-hooks --all
lmay-updater watch --auto-commit &

# Manual workflow
lmay-generator generate
lmay-validator validate --strict
```

### 3. CI/CD Integration
```bash
# In your pipeline
lmay-validator validate --format sarif --output lmay-report.sarif
lmay-updater detect --threshold 3 --format json
lmay-updater apply --auto-approve --backup
```

## Tool Details

### LMAY Generator
**Purpose**: Automatically generates LMAY documentation from source code analysis.

**Key Features**:
- Multi-language parsing (JS, TS, Python, Java, Go, Rust, etc.)
- Distributed system scanning
- Architecture pattern detection
- Dependency mapping

**Common Commands**:
```bash
lmay-generator generate                    # Generate for current directory
lmay-generator generate --distributed     # Distributed system mode
lmay-generator generate --dry-run         # Preview without creating files
```

**[Full Documentation](./generator/README.md)**

### LMAY Validator
**Purpose**: Validates LMAY files for syntax, semantic correctness, and specification compliance.

**Key Features**:
- YAML syntax validation
- LMAY v1.0 specification validation
- Reference integrity checking
- Automatic error fixing

**Common Commands**:
```bash
lmay-validator validate                   # Validate current project
lmay-validator validate --strict --fix   # Strict validation with fixes
lmay-validator validate --format sarif   # Generate SARIF report
```

**[Full Documentation](./validator/README.md)**

### LMAY Updater ⭐
**Purpose**: Automatically maintains LMAY documentation when code changes occur during refactoring.

**Key Features**:
- Real-time file monitoring
- Intelligent refactoring detection
- Git hooks integration
- Pattern analysis and recommendations
- Backup and rollback capabilities

**Common Commands**:
```bash
lmay-updater watch --auto-commit         # Monitor and auto-update
lmay-updater setup-hooks --all           # Setup Git integration
lmay-updater detect --threshold 5        # Detect refactoring changes
lmay-updater analyze --patterns          # Analyze refactoring patterns
```

**[Full Documentation](./updater/README.md)**

### LMAY CLI
**Purpose**: Unified command-line interface that integrates all LMAY tools into a single workflow.

**Key Features**:
- Project initialization with templates
- Integrated generate/validate/status workflow
- Configuration management
- Batch processing

**Common Commands**:
```bash
lmay init --interactive                  # Initialize new project
lmay generate && lmay validate          # Generate and validate
lmay status --coverage                  # Check project health
lmay batch generate ./projects/*        # Batch processing
```

**[Full Documentation](./cli/README.md)**

### LMAY Maintenance
**Purpose**: Legacy maintenance utilities for LMAY projects.

**Key Features**:
- File cleanup and optimization
- Legacy format migration
- Performance analysis

**[Full Documentation](./maintenance/README.md)**

## Integration Scenarios

### Scenario 1: New Project Setup
```bash
# Step 1: Initialize project
mkdir my-project && cd my-project
lmay init --template microservices

# Step 2: Generate initial documentation
lmay generate --distributed

# Step 3: Set up automatic maintenance
lmay-updater setup-hooks --all
lmay-updater config --set autoCommit=true

# Step 4: Validate everything
lmay validate --strict --fix
```

### Scenario 2: Existing Project Integration
```bash
# Step 1: Analyze existing codebase
lmay-generator generate --dry-run --verbose

# Step 2: Generate LMAY files
lmay-generator generate --overwrite

# Step 3: Validate and fix issues
lmay-validator validate --fix

# Step 4: Set up automatic updates
lmay-updater setup-hooks --pre-commit
```

### Scenario 3: CI/CD Pipeline
```bash
#!/bin/bash
# ci-lmay-check.sh

set -e

echo "🔍 Validating LMAY documentation..."
lmay-validator validate --strict --format sarif --output lmay-report.sarif

echo "🔍 Checking for refactoring changes..."
lmay-updater detect --threshold 3 --format json --output changes.json

if [ -s changes.json ]; then
  echo "📝 Applying LMAY updates..."
  lmay-updater apply --input changes.json --auto-approve --backup
  
  echo "✅ Validating updates..."
  lmay-validator validate --strict
fi

echo "✅ LMAY checks completed successfully"
```

### Scenario 4: Development Team Workflow
```bash
# Team lead setup (once)
lmay init --template distributed
lmay-updater setup-hooks --all
lmay-updater config --set updateStrategy=conservative

# Developer daily workflow
lmay status                              # Check project health
lmay-updater watch --verbose &          # Background monitoring
# ... make code changes ...
git commit -m "refactor: extract service" # Hooks auto-update LMAY

# Weekly analysis
lmay-updater analyze --patterns --recommendations --output weekly-report.html
```

## Configuration and Best Practices

### Global Configuration
Create `~/.lmayrc` for global settings:
```json
{
  "defaultTemplate": "microservices",
  "autoGenerate": true,
  "validateOnSave": true,
  "updater": {
    "strategy": "conservative",
    "autoCommit": false,
    "debounceTime": 2000
  }
}
```

### Project Configuration
Create `lmay.config.json` in project root:
```json
{
  "lmay": {
    "version": "1.0",
    "rootFile": "root.lmay"
  },
  "generator": {
    "excludePatterns": ["node_modules/**", "dist/**"],
    "distributed": true
  },
  "validator": {
    "strict": true,
    "autoFix": true
  },
  "updater": {
    "watchPatterns": ["**/*.js", "**/*.ts"],
    "threshold": 5
  }
}
```

### Best Practices

1. **Start Simple**: Begin with basic CLI usage, then add automation
2. **Use Templates**: Leverage project templates for consistent structure
3. **Enable Automation**: Set up Git hooks and watch mode for seamless updates
4. **Regular Validation**: Include LMAY validation in CI/CD pipelines
5. **Monitor Patterns**: Use analysis tools to optimize refactoring strategies
6. **Backup Safety**: Always enable backups when using automatic updates

## Troubleshooting

### Common Issues

1. **Tool not found**: Ensure global installation or use `npx`
2. **Permission errors**: Check file permissions and Git repository access
3. **Configuration conflicts**: Use `lmay config --reset` to restore defaults
4. **Validation failures**: Run `lmay doctor` for diagnostic information

### Getting Help

- **General help**: `lmay --help`
- **Tool-specific help**: `lmay-<tool> --help`
- **Verbose output**: Add `--verbose` to any command
- **Diagnostics**: Use `lmay doctor` for system health check

### Debug Mode

Enable debug output for troubleshooting:
```bash
export LMAY_DEBUG=true
export LMAY_VERBOSE=true

# Run commands with detailed logging
lmay-updater watch --verbose
```

## Development and Contributing

### Building from Source
```bash
# Clone repository
git clone https://github.com/francois5/lmay.git
cd lmay/tools

# Install dependencies for all tools
cd generator && npm install && npm link && cd ..
cd validator && npm install && npm link && cd ..
cd updater && npm install && npm link && cd ..
cd cli && npm install && npm link && cd ..
```

### Running Tests
```bash
# Run tests for all tools
cd tools
npm run test:all

# Run tests for specific tool
cd generator && npm test
```

### Contributing
Contributions are welcome! Please see the main [CONTRIBUTING.md](../CONTRIBUTING.md) for guidelines.

## License

All LMAY tools are licensed under the [Mozilla Public License 2.0](../LICENSE.md).

---

*For more information, visit the [LMAY project repository](https://github.com/francois5/lmay).*