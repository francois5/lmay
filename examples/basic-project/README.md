# Basic Project Example

This example demonstrates LMAY usage for a simple JavaScript project with Express.js.

## 🏗️ Project Structure

```
basic-project/
├── root.lmay          # Main LMAY documentation
├── app.js             # Server entry point
├── cli.js             # Command line interface
├── package.json       # npm dependencies
├── src/
│   ├── api.js         # REST API routes
│   ├── database.js    # Data management
│   └── utils.js       # Utility functions
├── static/
│   ├── styles.css     # CSS styles
│   └── app.js         # Frontend JavaScript
├── templates/
│   └── index.html     # Main HTML template
├── tests/
│   └── api.test.js    # Unit tests
└── config/
    └── (configuration files)
```

## 🚀 Usage

### 1. Examine LMAY Documentation
```bash
cat root.lmay
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Start Server
```bash
npm start
# or in development mode
npm run dev
```

### 4. Use CLI
```bash
npm run cli init    # Initialize database
npm run cli report  # Generate report
```

### 5. Run Tests
```bash
npm test
```

## 🔧 LMAY Generation and Validation

### Generate automatically
```bash
# From the examples/basic-project folder
node ../../tools/generator/src/cli.js --input . --output .
```

### Validate LMAY file
```bash
node ../../tools/validator/src/cli.js root.lmay --verbose
```

### Validate with SARIF report
```bash
node ../../tools/validator/src/cli.js root.lmay --format sarif --output validation-report.sarif
```

## 📚 Learning Points

### 1. Basic LMAY Structure
- **lmay_version**: Specification version
- **project**: Project metadata
- **architecture**: Pattern and entry points
- **structure**: Folder organization
- **dependencies**: External dependencies

### 2. Best Practices
- Clear and concise descriptions
- Primary languages per folder
- Well-defined entry points
- Documented interfaces

### 3. Use Cases
- Automatic documentation for AI
- New developer onboarding
- Architectural auditing
- Documentation maintenance

## 🎯 Next Steps

1. Explore other more complex examples
2. Adapt this structure to your projects
3. Test automatic generation on your codebases
4. Integrate LMAY validation into your CI/CD

---

*This example illustrates fundamental LMAY concepts in a simple and practical context.*