# LMAY Markup for AI in YAML

**LMAY** (LMAY Markup for AI in YAML) is a universal declarative standard designed to enable AI systems to quickly and accurately understand the structure and intent of complex codebases. Through simple, human-readable YAML files, LMAY creates a semantic map of your project, making it instantly accessible to AI programming assistants. This reduces computational costs, improves AI accuracy, and fosters better collaboration between developers and AI.

## Why LMAY?

- **Efficiency**: Reduces up to 90% of the tokens required for AI to understand your project, thereby lowering costs and speeding up responses.
- **Universality**: Compatible with all programming languages and frameworks, adaptable to any project.
- **Collaboration**: Establishes a common language between developers and AI, boosting productivity.

## Getting Started

1. **Read the whitepaper**: For an in-depth look at LMAY's architecture, specifications, and use cases, check out the [full whitepaper](./whitepaper.md).
2. **Explore the examples**: See LMAY in action with practical examples in the [examples](./examples/) folder.
3. **Use the tools**: Automate the creation, validation, and maintenance of LMAY files with our comprehensive toolchain:
   - **Generator**: Automatically create LMAY documentation from code analysis
   - **Validator**: Ensure LMAY files meet specification requirements  
   - **Updater**: Automatically maintain LMAY documentation during refactoring
   - **CLI**: Unified command-line interface for all LMAY operations

## Tools Overview

### LMAY Generator
Automatically generates LMAY documentation through intelligent code analysis.

```bash
# Install and use
npm install -g lmay-generator
lmay-generator generate ./src --output ./docs
```

**Features:**
- Multi-language support (JavaScript, Python, Java, Go, Rust, etc.)
- Distributed system scanning
- Dependency analysis and mapping
- Architecture pattern detection

### LMAY Validator  
Ensures LMAY files comply with specifications and maintain consistency.

```bash
# Install and use
npm install -g lmay-validator
lmay-validator validate --strict --fix
```

**Features:**
- YAML syntax validation
- Semantic validation against LMAY v1.0 spec
- Reference integrity checking
- Automatic fixing of common issues

### LMAY Updater ⭐ *New*
Automatically maintains LMAY documentation during code refactoring.

```bash
# Install and use
npm install -g lmay-updater
lmay-updater watch --auto-commit
lmay-updater setup-hooks --all
```

**Features:**
- Real-time change monitoring
- Intelligent refactoring detection
- Automatic Git integration
- Pattern analysis and recommendations
- Backup and rollback capabilities

### LMAY CLI
Unified command-line interface combining all LMAY tools.

```bash
# Install and use
npm install -g lmay-cli
lmay init --interactive
lmay generate && lmay validate
```

**Features:**
- Project initialization and templates
- Integrated workflow commands
- Configuration management
- Batch processing capabilities

For detailed documentation, see the [tools](./tools/) directory.

## How to Contribute

We welcome contributions! Please see our [CONTRIBUTING.md](./CONTRIBUTING.md) to learn how to submit improvements, report issues, or participate in development.

## License

LMAY is licensed under the [Mozilla Public License 2.0](./LICENSE.md), allowing free use and modification while ensuring that improvements benefit the community.

---

*For more information or to contribute, visit [https://github.com/francois5/lmay](https://github.com/francois5/lmay).*

*Copyright (c) 2025 François Van Eesbeeck*