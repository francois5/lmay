# LMAY Maintenance Tools

Advanced maintenance tools for LMAY projects, designed to detect obsolete files, analyze documentation drift, optimize performance, and maintain project health automatically.

## Features

- **Obsolete Detection** - Identify LMAY files that no longer match project structure
- **Drift Analysis** - Compare documented vs actual project state
- **Cache Management** - Optimize analysis performance with intelligent caching
- **Health Monitoring** - Comprehensive project health assessments
- **Automated Cleanup** - Remove temporary files, backups, and duplicates
- **Watch Mode** - Continuous monitoring with auto-updates
- **Migration Tools** - Upgrade between LMAY versions
- **Batch Operations** - Process multiple projects efficiently

## Installation

### Standalone Installation

```bash
cd tools/maintenance
npm install
npm link
```

### As Part of LMAY CLI

The maintenance tools are integrated into the unified LMAY CLI. No separate installation needed.

## Commands

### `lmay-maintenance obsolete`

Detect obsolete LMAY files that no longer match the project structure.

```bash
# Basic obsolete detection
lmay-maintenance obsolete

# Custom threshold and auto-cleanup
lmay-maintenance obsolete --threshold 60 --auto-clean

# Strict mode with dry run
lmay-maintenance obsolete --strict --dry-run

# Generate report
lmay-maintenance obsolete --format json --output obsolete-report.json
```

**Options:**
- `-t, --threshold <days>` - Days since modification to consider obsolete (default: 30)
- `-s, --strict` - Use strict obsolescence detection rules
- `--auto-clean` - Automatically remove obsolete files
- `-f, --format <format>` - Output format (text|json|csv)
- `-o, --output <file>` - Save report to file
- `--dry-run` - Preview without removing files
- `-v, --verbose` - Detailed output

### `lmay-maintenance drift`

Analyze drift between LMAY documentation and actual project structure.

```bash
# Basic drift analysis
lmay-maintenance drift

# Deep analysis with auto-fix
lmay-maintenance drift --deep --fix

# Generate HTML report
lmay-maintenance drift --format html --output drift-report.html

# Ignore modification dates
lmay-maintenance drift --ignore-dates
```

**Options:**
- `-d, --deep` - Deep analysis including file content changes
- `--ignore-dates` - Ignore modification dates in analysis
- `-f, --format <format>` - Output format (text|json|html)
- `-o, --output <file>` - Save report to file
- `--fix` - Attempt automatic fixes
- `-v, --verbose` - Detailed output

### `lmay-maintenance cache`

Optimize and manage LMAY analysis cache for better performance.

```bash
# Show cache statistics
lmay-maintenance cache --stats

# Clear cache
lmay-maintenance cache --clear

# Rebuild cache
lmay-maintenance cache --rebuild

# Set size limit
lmay-maintenance cache --size-limit 200
```

**Options:**
- `--clear` - Clear all cached analysis results
- `--rebuild` - Rebuild cache from current project state
- `--stats` - Show cache statistics and health
- `--size-limit <mb>` - Set cache size limit in MB (default: 100)
- `-v, --verbose` - Detailed output

### `lmay-maintenance health`

Comprehensive health check for LMAY projects.

```bash
# Basic health check
lmay-maintenance health

# Full health report with score
lmay-maintenance health --score --recommendations

# Continuous monitoring
lmay-maintenance health --watch

# Generate comprehensive report
lmay-maintenance health --format html --output health-report.html
```

**Options:**
- `--score` - Calculate and display health score
- `--recommendations` - Generate improvement recommendations
- `-f, --format <format>` - Output format (text|json|html)
- `-o, --output <file>` - Save report to file
- `--watch` - Continuously monitor project health
- `-v, --verbose` - Detailed output

### `lmay-maintenance cleanup`

Clean up temporary files, backups, and optimize project structure.

```bash
# Clean temporary files
lmay-maintenance cleanup --temp

# Remove backups and duplicates
lmay-maintenance cleanup --backups --duplicates

# Full cleanup with optimization
lmay-maintenance cleanup --temp --backups --duplicates --optimize

# Dry run to preview
lmay-maintenance cleanup --temp --backups --dry-run
```

**Options:**
- `--temp` - Remove temporary LMAY files
- `--backups` - Remove backup files (.lmay.bak, etc.)
- `--duplicates` - Remove duplicate LMAY content
- `--optimize` - Optimize LMAY file structure and formatting
- `--dry-run` - Preview without actually cleaning
- `-v, --verbose` - Show detailed cleanup actions

### `lmay-maintenance watch`

Watch project for changes and maintain LMAY documentation automatically.

```bash
# Basic watch mode
lmay-maintenance watch

# Auto-update with notifications
lmay-maintenance watch --auto-update --notify

# Custom check interval
lmay-maintenance watch --interval 60 --auto-update
```

**Options:**
- `-i, --interval <seconds>` - Check interval in seconds (default: 30)
- `--auto-update` - Automatically update LMAY files when changes detected
- `--notify` - Show desktop notifications for changes
- `-v, --verbose` - Detailed output

### `lmay-maintenance migrate`

Migrate LMAY files between versions and formats.

```bash
# Basic migration
lmay-maintenance migrate --from 1.0 --to 1.1

# Migration with backup and validation
lmay-maintenance migrate --backup --validate

# Verbose migration
lmay-maintenance migrate --from 1.0 --to 1.1 --verbose
```

**Options:**
- `--from <version>` - Source LMAY version (default: 1.0)
- `--to <version>` - Target LMAY version (default: 1.0)
- `--backup` - Create backup before migration
- `--validate` - Validate after migration
- `-v, --verbose` - Detailed output

### `lmay-maintenance batch`

Run maintenance operations on multiple projects efficiently.

```bash
# Batch obsolete detection
lmay-maintenance batch obsolete ./project1 ./project2 ./project3

# Batch health checks with parallel processing
lmay-maintenance batch health ./projects/* --parallel 8

# Batch cleanup with error handling
lmay-maintenance batch cleanup ./services/* --continue-on-error
```

**Options:**
- `--parallel <num>` - Number of parallel operations (default: 4)
- `--continue-on-error` - Continue processing on errors
- `-f, --format <format>` - Output format for batch report
- `-o, --output <file>` - Save batch report
- `-v, --verbose` - Detailed output

## Integration with LMAY CLI

All maintenance tools are integrated into the unified LMAY CLI for seamless workflow:

```bash
# These commands are equivalent:
lmay-maintenance obsolete
lmay maintenance obsolete

# Health check integration
lmay status --health
lmay-maintenance health --score

# Cleanup integration
lmay doctor --fix
lmay-maintenance cleanup --temp --backups
```

## Configuration

Maintenance tools respect LMAY configuration files and can be customized:

```json
{
  "maintenance": {
    "obsoleteThreshold": 30,
    "cacheSize": 100,
    "watchInterval": 30,
    "autoCleanup": false,
    "healthCheckInterval": 3600,
    "excludePatterns": [
      "**/*.backup",
      "**/*.tmp"
    ]
  }
}
```

## Use Cases

### Daily Development

```bash
# Morning routine - check project health
lmay-maintenance health --score

# Before committing - cleanup and validate
lmay-maintenance cleanup --temp --optimize
lmay validate
```

### Weekly Maintenance

```bash
# Weekly project maintenance
lmay-maintenance obsolete --auto-clean
lmay-maintenance drift --fix
lmay-maintenance cache --stats
```

### CI/CD Integration

```bash
# In your CI pipeline
lmay-maintenance health --format json --output health.json
lmay-maintenance obsolete --strict --format json

# Fail build if health score is too low
HEALTH_SCORE=$(lmay-maintenance health --score --format json | jq '.score')
if [ $HEALTH_SCORE -lt 80 ]; then
  echo "Health score too low: $HEALTH_SCORE"
  exit 1
fi
```

### Large Project Management

```bash
# Batch operations on microservices
lmay-maintenance batch health ./services/* --parallel 10

# Bulk cleanup
lmay-maintenance batch cleanup ./projects/* --temp --backups

# Migration across multiple projects
lmay-maintenance batch migrate ./legacy-projects/* --from 0.9 --to 1.0
```

### Continuous Monitoring

```bash
# Set up continuous monitoring
lmay-maintenance watch --auto-update --notify &

# Health monitoring with alerts
lmay-maintenance health --watch --score &
```

## Advanced Features

### Cache Optimization

The maintenance tools use intelligent caching to improve performance:

- **File fingerprinting** - Only reanalyze changed files
- **Incremental updates** - Update cache incrementally
- **Size management** - Automatic cache size limits
- **Cache warming** - Pre-populate cache for faster analysis

### Health Scoring Algorithm

The health score is calculated based on multiple factors:

- **Coverage**: Percentage of project documented
- **Freshness**: How up-to-date documentation is
- **Consistency**: Alignment between docs and code
- **Completeness**: Required fields and metadata
- **Quality**: Structure and formatting adherence

### Drift Detection

Sophisticated drift detection includes:

- **Structural changes** - New/removed files and directories
- **Content changes** - Modified files and dependencies
- **Metadata drift** - Outdated descriptions and metadata
- **Reference integrity** - Broken links and references

## Troubleshooting

### Common Issues

1. **Cache issues**: Clear cache with `--clear` flag
2. **Permission errors**: Run with appropriate file permissions
3. **Large projects**: Use `--parallel` for better performance
4. **Memory issues**: Reduce cache size limit

### Performance Tips

- Use cache for repeated operations
- Run batch operations with appropriate parallelism
- Use `--dry-run` for large cleanup operations
- Monitor cache size and clear regularly

### Getting Help

- Use `--verbose` for detailed diagnostic information
- Check cache statistics if performance is slow
- Run health check to identify configuration issues
- Use dry-run mode to preview operations safely

## Contributing

See the main [CONTRIBUTING.md](../../CONTRIBUTING.md) for contribution guidelines.

## License

Licensed under the [Mozilla Public License 2.0](../../LICENSE.md).

---

*The maintenance tools help keep your LMAY documentation accurate, up-to-date, and optimized for AI understanding.*