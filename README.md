# Rust Hook Analyzer for VSCode

A powerful Visual Studio Code extension designed to enhance Rust plugin development by providing intelligent hook analysis and management.

## Features

- **Intelligent Hook Detection**: Automatically detects and validates Rust plugin hooks in your code
- **Deprecation Warnings**: Highlights deprecated hooks and suggests modern alternatives
- **Parameter Validation**: Verifies hook parameters against expected signatures
- **Syntax Highlighting**: Visual indicators for valid and deprecated hooks
- **Workspace Support**: Configurable on a per-workspace basis

## Installation

1. Open Visual Studio Code
2. Go to Extensions (Ctrl+Shift+X)
3. Search for "Rust Hook Analyzer"
4. Click Install

## Usage

The extension automatically activates for C# files in your Rust plugin projects. It provides:

### Hook Validation
- Valid hooks are highlighted with a subtle decoration
- Hover over hooks to see their full signatures
- Warnings appear for incorrect parameter usage

### Deprecation Checking
- Deprecated hooks are marked with error decorations
- Quick fixes suggest modern alternatives
- Detailed messages explain why hooks are deprecated

### Configuration Files
The extension uses several JSON files in your `.vscode` directory:

- `rust-hooks.json`: Defines valid hook signatures
- `deprecated-hooks.json`: Maps deprecated hooks to their replacements
- `hook-styles.json`: Customizes hook highlighting

## Configuration

You can customize the extension through:

1. Workspace Settings:
   - Create a `.vscode` directory in your project
   - Add custom hook definitions to `rust-hooks.json`
   - Define deprecated hooks in `deprecated-hooks.json`

2. Visual Studio Code Settings:
   ```json
   {
     "rustHookAnalyzer.enableHighlighting": true,
     "rustHookAnalyzer.showDeprecationWarnings": true
   }
   ```

## Requirements

- Visual Studio Code 1.60.0 or higher
- C# extension for VS Code (recommended)

## Known Issues

- Currently focused on C# Rust plugin files
- Performance impact may occur with very large projects
- Manual updates required for hook definitions

## Contributing

1. Fork the repository
2. Create a feature branch
3. Submit a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details

## Release Notes

### 1.0.0
- Initial release
- Basic hook detection and validation
- Deprecation warnings
- Parameter checking

---

**Enjoy coding your Rust plugins with confidence!** 
