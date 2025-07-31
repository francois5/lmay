# LMAY Updater - Automatic Refactoring Tools

The LMAY Updater provides intelligent, automatic updates to LMAY documentation when code refactoring occurs. It monitors file changes, detects refactoring patterns, and automatically synchronizes LMAY files to keep documentation current and accurate.

## Features

- **Real-time Change Detection**: Monitor file changes with configurable debouncing
- **Intelligent Impact Analysis**: Calculate LMAY update requirements based on code changes
- **Git Integration**: Seamless integration with Git workflows and hooks
- **Multi-language Support**: JavaScript, TypeScript, Python, Java, Go, Rust, and more
- **Batch Processing**: Handle multiple projects simultaneously
- **Backup & Rollback**: Safe updates with automatic backup and rollback capabilities
- **Pattern Analysis**: Analyze refactoring patterns and generate recommendations

## Installation

### Global Installation (Recommended)

```bash
npm install -g lmay-updater
```

### Local Installation

```bash
npm install lmay-updater
npx lmay-updater --help
```

### Development Installation

```bash
cd tools/updater
npm install
npm link
```

## Quick Start

```bash
# Watch for changes and auto-update
lmay-updater watch

# Synchronize documentation with current state
lmay-updater sync --backup

# Setup Git hooks for automatic updates
lmay-updater setup-hooks --all

# Detect refactoring changes
lmay-updater detect --threshold 5
```

## Commands

### `lmay-updater watch`

Monitor project for changes and automatically update LMAY files.

```bash
# Watch current directory
lmay-updater watch

# Watch specific directory with custom settings
lmay-updater watch ./src --debounce 5000 --auto-commit

# Dry run to see what would be updated
lmay-updater watch --dry-run --verbose
```

**Options:**
- `-d, --debounce <ms>` - Debounce time for file changes (default: 2000ms)
- `--include <patterns>` - File patterns to include (comma-separated)
- `--exclude <patterns>` - File patterns to exclude (comma-separated)
- `--auto-commit` - Automatically commit LMAY updates
- `--dry-run` - Show what would be updated without making changes
- `-v, --verbose` - Verbose output

**Example:**
```bash
lmay-updater watch ./src \
  --include "**/*.js,**/*.ts" \
  --exclude "node_modules/**,dist/**" \
  --debounce 3000 \
  --auto-commit \
  --verbose
```

### `lmay-updater sync`

Synchronize LMAY documentation with current project structure.

```bash
# Basic synchronization
lmay-updater sync

# Force sync with backup and validation
lmay-updater sync --force --backup --validate

# Generate report
lmay-updater sync --output sync-report.json --format json
```

**Options:**
- `--force` - Force update even if no changes detected
- `--backup` - Create backup before updating
- `--validate` - Validate updates after completion
- `-f, --format <format>` - Output format for report (text|json)
- `-o, --output <file>` - Save report to file
- `-v, --verbose` - Verbose output

### `lmay-updater detect`

Detect refactoring changes that require LMAY updates.

```bash
# Detect changes since last commit
lmay-updater detect

# Detect changes since specific commit
lmay-updater detect --since abc1234

# Compare with main branch
lmay-updater detect --branch main --threshold 3

# Generate detailed report
lmay-updater detect --format json --output changes.json --verbose
```

**Options:**
- `--since <commit>` - Analyze changes since specific commit
- `--branch <branch>` - Compare with specific branch (default: main)
- `--threshold <num>` - Minimum impact score to trigger update (default: 5)
- `-f, --format <format>` - Output format (text|json|diff)
- `-o, --output <file>` - Save detection report to file
- `-v, --verbose` - Verbose output

### `lmay-updater apply`

Apply detected refactoring changes to LMAY files.

```bash
# Apply detected changes interactively
lmay-updater apply --interactive

# Auto-apply safe changes only
lmay-updater apply --auto-approve --backup

# Apply changes from file
lmay-updater apply --input changes.json --verbose
```

**Options:**
- `-i, --input <file>` - Input file with detected changes
- `--interactive` - Interactive mode for reviewing changes
- `--auto-approve` - Auto-approve all safe updates
- `--backup` - Create backup before applying changes
- `-v, --verbose` - Verbose output

### `lmay-updater setup-hooks`

Setup Git hooks for automatic LMAY updates.

```bash
# Setup all recommended hooks
lmay-updater setup-hooks --all

# Setup specific hooks
lmay-updater setup-hooks --pre-commit --post-commit

# Remove existing hooks
lmay-updater setup-hooks --remove --verbose
```

**Options:**
- `--pre-commit` - Setup pre-commit hook
- `--post-commit` - Setup post-commit hook
- `--pre-push` - Setup pre-push hook
- `--all` - Setup all recommended hooks
- `--remove` - Remove existing LMAY hooks
- `-v, --verbose` - Verbose output

**Generated Hooks:**

*Pre-commit hook:*
```bash
# Check for refactoring changes and update LMAY
if command -v lmay-updater >/dev/null 2>&1; then
  echo "🔍 Checking for LMAY updates..."
  lmay-updater detect --threshold 3 >/dev/null
  if [ $? -eq 0 ]; then
    lmay-updater sync --auto-approve
    if [ $? -eq 0 ]; then
      git add "*.lmay"
      echo "✅ LMAY documentation updated"
    fi
  fi
fi
```

### `lmay-updater rollback`

Rollback automatic LMAY updates.

```bash
# List available rollback points
lmay-updater rollback --list

# Rollback to previous commit
lmay-updater rollback --to HEAD~1

# Rollback specific number of steps
lmay-updater rollback --steps 2 --verbose
```

**Options:**
- `--to <commit>` - Rollback to specific commit
- `--steps <num>` - Number of update steps to rollback (default: 1)
- `--list` - List available rollback points
- `-v, --verbose` - Verbose output

### `lmay-updater batch`

Apply updates to multiple projects in batch mode.

```bash
# Batch sync multiple projects
lmay-updater batch sync ./project1 ./project2 ./project3

# Parallel processing with error handling
lmay-updater batch detect ./projects/* \
  --parallel 8 \
  --continue-on-error \
  --output batch-report.json

# Batch apply with custom settings
lmay-updater batch apply ./services/* \
  --parallel 4 \
  --format json \
  --verbose
```

**Options:**
- `--parallel <num>` - Number of parallel operations (default: 4)
- `--continue-on-error` - Continue processing on errors
- `-f, --format <format>` - Output format for batch report (text|json)
- `-o, --output <file>` - Save batch report
- `-v, --verbose` - Verbose output

### `lmay-updater config`

Configure automatic update behavior.

```bash
# List current configuration
lmay-updater config --list

# Set configuration values
lmay-updater config --set updateStrategy=aggressive
lmay-updater config --set autoCommit=true
lmay-updater config --set debounceTime=3000

# Reset to defaults
lmay-updater config --reset

# Global configuration
lmay-updater config --set backupOnUpdate=true --global
```

**Options:**
- `--list` - List current configuration
- `--set <key=value>` - Set configuration value
- `--reset` - Reset to default configuration
- `--global` - Use global configuration
- `-v, --verbose` - Verbose output

**Configuration Options:**
- `updateStrategy` - Update strategy (conservative|aggressive|interactive)
- `autoCommit` - Automatically commit changes (true|false)
- `debounceTime` - Debounce time in milliseconds
- `backupOnUpdate` - Create backups before updates (true|false)
- `validateAfterUpdate` - Validate after updates (true|false)

### `lmay-updater analyze`

Analyze refactoring patterns in the project.

```bash
# Analyze last 30 days
lmay-updater analyze

# Analyze specific time period
lmay-updater analyze --history 60 --patterns --recommendations

# Generate detailed HTML report
lmay-updater analyze \
  --patterns \
  --recommendations \
  --format html \
  --output refactoring-analysis.html
```

**Options:**
- `--history <days>` - Number of days of history to analyze (default: 30)
- `--patterns` - Show common refactoring patterns
- `--recommendations` - Generate update strategy recommendations
- `-f, --format <format>` - Output format (text|json|html)
- `-o, --output <file>` - Save analysis report
- `-v, --verbose` - Verbose output

## Configuration

### Configuration File

LMAY Updater looks for configuration in `~/.lmay-updater.json`:

```json
{
  "updateStrategy": "conservative",
  "autoCommit": false,
  "debounceTime": 2000,
  "backupOnUpdate": true,
  "validateAfterUpdate": true,
  "excludePatterns": [
    "node_modules/**",
    ".git/**",
    "dist/**",
    "build/**"
  ],
  "includePatterns": [
    "**/*.js",
    "**/*.ts",
    "**/*.py",
    "**/*.java",
    "**/*.go",
    "**/*.rs"
  ],
  "hooks": {
    "preCommit": true,
    "postCommit": false,
    "prePush": false
  }
}
```

### Environment Variables

- `LMAY_UPDATER_VERBOSE=true` - Enable verbose output
- `LMAY_UPDATER_CONFIG=/path/to/config.json` - Custom config file
- `LMAY_UPDATER_NO_COLOR=true` - Disable colored output

## Update Strategies

### Conservative (Default)
- Only applies updates with high confidence
- Requires manual approval for risky changes
- Creates backups automatically
- Validates all changes

### Aggressive
- Applies most detected changes automatically
- Suitable for CI/CD environments
- Still creates backups for safety
- May require manual review occasionally

### Interactive
- Prompts for approval on every change
- Shows detailed diff before applying
- Best for learning and understanding impacts
- Allows fine-grained control

## Integration Examples

### CI/CD Pipeline

```yaml
# .github/workflows/lmay-sync.yml
name: LMAY Documentation Sync

on:
  push:
    branches: [ main, develop ]

jobs:
  sync-lmay:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      
      - name: Install LMAY Updater
        run: npm install -g lmay-updater
      
      - name: Detect Changes
        run: lmay-updater detect --threshold 3 --format json --output changes.json
      
      - name: Apply Updates
        run: lmay-updater apply --input changes.json --auto-approve --backup
      
      - name: Commit Changes
        run: |
          git config --local user.email "action@github.com"
          git config --local user.name "GitHub Action"
          git add *.lmay
          git diff --staged --quiet || git commit -m "Auto-update LMAY documentation"
          git push
```

### Pre-commit Hook

```bash
#!/bin/sh
# .git/hooks/pre-commit

echo "🔍 Checking for LMAY updates..."

# Detect changes that require LMAY updates
lmay-updater detect --threshold 3 --format json --output /tmp/lmay-changes.json

if [ $? -eq 0 ] && [ -s /tmp/lmay-changes.json ]; then
  echo "📝 Updating LMAY documentation..."
  
  # Apply updates automatically
  lmay-updater apply --input /tmp/lmay-changes.json --auto-approve --backup
  
  if [ $? -eq 0 ]; then
    # Add updated LMAY files to commit
    git add "*.lmay"
    echo "✅ LMAY documentation updated and staged"
  else
    echo "❌ LMAY update failed - please run 'lmay-updater detect' manually"
    exit 1
  fi
fi

# Clean up
rm -f /tmp/lmay-changes.json
```

### Development Workflow

```bash
# Daily development workflow with LMAY Updater

# 1. Start watching for changes (in background terminal)
lmay-updater watch --auto-commit --verbose &

# 2. Make code changes as usual
# ... develop, refactor, commit ...

# 3. Check LMAY health periodically
lmay-updater detect --verbose

# 4. Analyze refactoring patterns weekly
lmay-updater analyze --patterns --recommendations --output weekly-analysis.html

# 5. Review and optimize update strategy
lmay-updater config --list
```

## Multi-Language Support

The updater automatically detects and handles:

### JavaScript/TypeScript
- ES6 imports/exports
- CommonJS require/module.exports
- Function and class declarations
- JSDoc annotations

### Python
- Import statements (import, from...import)
- Function and class definitions
- Docstrings and type hints

### Java
- Package imports
- Class and method declarations
- Annotations

### Go
- Package imports
- Function and struct declarations
- Interface definitions

### Rust
- Module declarations (mod, use)
- Function and struct definitions
- Trait implementations

## Troubleshooting

### Common Issues

1. **No changes detected**: Check file patterns and threshold settings
2. **Permission errors**: Ensure write access to LMAY files and .git directory
3. **Git hook failures**: Verify git repository status and permissions
4. **Large file processing**: Increase debounce time for large projects

### Debugging

```bash
# Enable verbose logging
lmay-updater watch --verbose

# Check configuration
lmay-updater config --list

# Test detection without applying changes
lmay-updater detect --dry-run --verbose

# Analyze specific commit
lmay-updater detect --since HEAD~1 --verbose
```

### Performance Tuning

```bash
# Optimize for large projects
lmay-updater config --set debounceTime=5000
lmay-updater config --set updateStrategy=conservative

# Exclude unnecessary files
lmay-updater watch --exclude "node_modules/**,dist/**,build/**,*.log"

# Use batch processing for multiple projects
lmay-updater batch sync ./projects/* --parallel 8
```

## Best Practices

1. **Start Conservative**: Begin with conservative strategy and increase automation gradually
2. **Use Backups**: Always enable backup creation for safety
3. **Monitor Patterns**: Regularly analyze refactoring patterns to optimize settings
4. **Test Hooks**: Test Git hooks in development before deploying to production
5. **Review Updates**: Periodically review automatic updates for accuracy
6. **Exclude Noise**: Configure file patterns to exclude build artifacts and dependencies

## Contributing

Contributions are welcome! Please see the main [CONTRIBUTING.md](../../CONTRIBUTING.md) for guidelines.

## License

This project is licensed under the [Mozilla Public License 2.0](../../LICENSE.md).

---

*For more information, visit the [LMAY project repository](https://github.com/francois5/lmay).*