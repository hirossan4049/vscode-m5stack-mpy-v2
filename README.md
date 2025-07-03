# vscode-m5stack-mpy

A Visual Studio Code extension for M5Stack MicroPython development.

## Features

- **File Management**: Read and write files directly on M5Stack devices via serial connection
- **Syntax Highlighting**: Full Python syntax support with M5Stack-specific highlighting
- **Code Completion**: Intelligent auto-completion for M5Stack APIs (LCD, buttons, sensors, etc.)
- **Snippets**: Pre-built code snippets for common M5Stack operations
- **Device Integration**: Direct code execution on M5Stack hardware
- **File Tree View**: Browse and manage files on your M5Stack device through VS Code's explorer
- **Cross-Platform**: Works on Windows, macOS, and Linux with N-API compatibility

## Quick Start

- Install vscode-m5stack-mpy.
- Set M5Stack(UIFlow) in USB Mode.

![screenshot](./resources/quick-start-7.JPG)

- Click "Add M5Stack device" and select the correct serial port of M5Stack.

![screenshot](https://github.com/curdeveryday/vscode-m5stack-mpy/raw/master/resources/quick-start-1.png)

![screenshot](https://github.com/curdeveryday/vscode-m5stack-mpy/raw/master/resources/quick-start-2.png)

- Open M5Stack file tree. If Device resets, please click the refresh button to reopen the file tree.

![screenshot](https://github.com/curdeveryday/vscode-m5stack-mpy/raw/master/resources/quick-start-3.png)

- Editor a file.

![screenshot](https://github.com/curdeveryday/vscode-m5stack-mpy/raw/master/resources/quick-start-4.png)

- Run in M5Stack.

![screenshot](https://github.com/curdeveryday/vscode-m5stack-mpy/raw/master/resources/quick-start-5.png)

- Save file. You can press `ctrl + s` or click `File->Save` to save file.

![screenshot](https://github.com/curdeveryday/vscode-m5stack-mpy/raw/master/resources/quick-start-6.png)

## Requirements

- **VS Code**: Version 1.48.0 or later
- **M5Stack Device**: Any M5Stack device with MicroPython firmware
- **USB Connection**: USB cable to connect M5Stack to your computer
- **Permissions**: Serial port access permissions on your system

## Troubleshooting

### Common Issues

1. **Serial Port Not Found**
   - Ensure M5Stack is connected via USB
   - Check that the device is in USB mode (not Wi-Fi mode)
   - Verify USB drivers are installed for your M5Stack device

2. **Permission Denied (Linux/macOS)**
   ```bash
   sudo usermod -a -G dialout $USER
   # Then logout and login again
   ```

3. **Connection Issues**
   - Try a different USB cable
   - Reset the M5Stack device
   - Refresh the device tree in VS Code

## Recent Improvements

### Version 1.1.10+
- ✅ **N-API Migration**: Upgraded to serialport 13.0.0 with N-API support for better Node.js compatibility
- ✅ **Performance**: Migrated from yarn to pnpm for faster builds and installations
- ✅ **Stability**: Eliminated Node.js version-specific binding issues
- ✅ **Modern Architecture**: Simplified codebase with removal of legacy binding management

### Future Enhancements
- Enhanced auto-completion for M5Stack units and modules
- Improved hover documentation and tooltips
- Device firmware update integration
- Multi-device connection support

## Development

### Prerequisites

This project uses [pnpm](https://pnpm.io/) for package management. Install pnpm globally:

```bash
npm install -g pnpm
```

### Building the Extension

To verify changes of this plugin you build the plugin with:

```bash
git clean -fdX
rm -rf node_modules pnpm-lock.yaml
pnpm install
```

### Development Workflow

Start VS Code with this directory as workspace:

```bash
code ./
```

Then press F5 to launch the Extension Development Host and verify that it works.

### Available Commands

```bash
# Build the extension
pnpm compile

# Run linting
pnpm lint

# Build for production
pnpm package

# Run tests
pnpm test

# Watch for changes
pnpm watch
```

See more on https://code.visualstudio.com/api

## Install extension from compiled source

Install the vs code extension packaging tool...
```
npm install -g vsce
```

Create and install the package...
```
vsce package
code --install-extension vscode-m5stack-mpy-1.1.10.vsix 
```
