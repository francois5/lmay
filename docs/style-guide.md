# LMAY Style Guide

This guide outlines the coding standards and best practices for contributing to the LMAY project. Following these guidelines ensures consistency and maintainability.

## YAML Formatting
- Use 2 spaces for indentation.
- Avoid using tabs.
- Use lowercase for keys unless a specific convention requires otherwise.
- Keep lines under 80 characters where possible.

## Naming Conventions
- Use `snake_case` for file names and keys in YAML files.
- Use descriptive names for modules, components, and submodules.
- Avoid abbreviations unless they are widely understood.

## Documentation Standards
- Write clear and concise descriptions (max 100 characters).
- Use active voice and present tense.
- Avoid jargon unless necessary; define terms when used.

## Structuring LMAY Files
- Follow the hierarchy defined in the specification (e.g., `root.lmay`, submodule files).
- Use relative paths for references to other files.
- Ensure that each file is self-contained but links to parent or child files as needed.

## Best Practices
- Keep LMAY files concise; avoid unnecessary details.
- Use consistent terminology across files.
- Update documentation alongside code changes.
- Validate LMAY files using the provided tools before submitting.

## Examples
Refer to the [examples](../examples/) directory for practical implementations of these guidelines.

---

*This style guide is a living document and may be updated as the project evolves.*