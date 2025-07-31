# LMAY Examples

This section contains practical examples of LMAY usage for different types of projects and architectures.

## 📁 Examples Structure

### [basic-project/](./basic-project/)
**Basic project** - Simple example of a small project with a few folders and files.
- Ideal for understanding basic LMAY concepts
- Shows minimal `root.lmay` structure
- Perfect for getting started

### [web-application/](./web-application/)
**Web application** - Example of a classic web application with MVC architecture.
- Frontend/backend structure
- Dependency management
- Multiple entry points

### [microservices/](./microservices/)
**Microservices architecture** - Example of a distributed system with multiple services.
- Multiple independent services
- Inter-service communication
- Infrastructure documentation

### [distributed-system/](./distributed-system/)
**Distributed system** - Example with multiple servers and remote resources.
- Multi-server configuration
- Distributed resources
- Monitoring and observability

## 🚀 How to Use the Examples

### 1. Examine the Structure
Each example contains:
- `root.lmay` - Main documentation file
- `*.lmay` - Module files (if applicable)
- `README.md` - Example-specific explanation
- Simulated project files for context

### 2. Generate Automatically
Test the generator on the examples:
```bash
cd examples/basic-project
node ../../tools/generator/src/cli.js --input . --output .
```

### 3. Validate
Check compliance with the validator:
```bash
cd examples/basic-project
node ../../tools/validator/src/cli.js root.lmay --verbose
```

### 4. Adapt to Your Project
Use these examples as templates to document your own projects.

## 📚 Recommended Progression

1. **Beginner** → `basic-project/` - Understand the fundamentals
2. **Intermediate** → `web-application/` - Explore classic architectures
3. **Advanced** → `microservices/` - Master complex systems
4. **Expert** → `distributed-system/` - Document complete infrastructures

## 💡 Tips

- Always start by examining the `root.lmay` of each example
- Use `--verbose` with the validator to understand the details
- Adapt the examples to your specific needs
- Don't hesitate to combine concepts from multiple examples

---

*These examples are designed to illustrate LMAY best practices and facilitate adoption in your real projects.*