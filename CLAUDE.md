# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

This is a VS Code extension for M5Stack MicroPython development. It provides serial communication, file system management, and intelligent code completion for M5Stack devices.

## Common Development Commands

### Build and Development

**Package Manager: pnpm** (Required - do not use npm or yarn)

This project uses pnpm for faster and more efficient dependency management.

```bash
# Install dependencies
pnpm install

# Compile the extension
pnpm compile

# Watch mode for development
pnpm watch

# Build for production
pnpm package

# Run linting
pnpm lint

# Run unit tests
pnpm test

# Run integration tests (requires compilation first)
pnpm preintegration-tests  # Compiles and lints
pnpm integration-tests     # Runs VS Code integration tests

# Clean and rebuild
git clean -fdX
rm -rf node_modules pnpm-lock.yaml
pnpm install
```

### Creating a VSIX Package
```bash
# Install vsce globally if not already installed
npm install -g vsce

# Create the package (uses pnpm package internally)
vsce package

# Install the extension locally
code --install-extension vscode-m5stack-mpy-1.1.10.vsix
```

### Running Tests
```bash
# Run all unit tests
pnpm test

# Run a specific test file
pnpm test src/serial/SerialConnection.test.ts

# Run tests matching a pattern
pnpm test --testNamePattern="pattern"

# Debug tests (useful for troubleshooting)
pnpm test --verbose
```

## Architecture Overview

### Core Components

1. **Serial Communication Layer** (`src/serial/`)
   - `SerialConnection.ts`: Handles low-level serial port communication with M5Stack devices
   - `SerialManager.ts`: Provides high-level operations like file upload/download and command execution
   - `Crc.ts`: Implements CRC16-based frame validation for reliable data transfer
   - Uses custom protocol with frame structure: [HEADER:3] [PAYLOAD] [CRC16:2] [FOOTER:3]

2. **File System Provider** (`src/providers/M5FileSystemProvider.ts`)
   - Implements VS Code's FileSystemProvider interface
   - Enables direct file manipulation on M5Stack devices through VS Code's file explorer
   - Handles file read/write/delete operations via serial protocol

3. **Code Intelligence** (`src/providers/completion/`)
   - `M5CompletionProvider.ts`: Main completion provider that aggregates all M5Stack API completions
   - Module-specific completions for: lcd, buttons, speaker, imu, rgb, timer, machine, screen
   - Hover provider for API documentation

4. **UI Components** (`src/ui/`)
   - `TreeDataProvider.ts`: Manages the M5Stack device tree view in VS Code's explorer
   - `PortList.ts`: Handles serial port discovery and selection
   - `StatusBar.ts`: Shows connection status and device information

### Extension Activation Flow

1. Extension activates on VS Code startup (activationEvents: "*")
2. Registers all commands, providers, and UI components in `extension.ts`
3. User selects serial port through command palette or UI
4. SerialConnection establishes communication with M5Stack device
5. File system provider syncs device files with VS Code's explorer

### Key Design Patterns

- **Provider Pattern**: All VS Code integrations (file system, completion, hover) use provider interfaces
- **Command Pattern**: User actions are registered as VS Code commands with unique identifiers
- **Singleton Pattern**: SerialManager ensures single connection per device
- **Observer Pattern**: File tree updates reactively based on device state changes

### Native Dependencies

**✅ Migrated to N-API (Node-API)**

As of version 1.1.10+, this extension uses serialport 13.0.0, which includes N-API support. This eliminates the previous compatibility issues with different Node.js versions:

- **No more manual binding management**: The old `serialPortBindingsLoader.js` system has been removed
- **Universal compatibility**: N-API provides ABI stability across Node.js versions
- **Prebuild support**: Uses official prebuilt binaries from `@serialport/bindings-cpp`
- **Better Electron support**: Significantly improved compatibility with VS Code's Electron runtime

The extension now works seamlessly across different VS Code versions without requiring version-specific native bindings.

### Testing Strategy

- Unit tests use Jest with TypeScript support
- Integration tests use VS Code's test runner
- Mock serial connections for testing without hardware
- Test files are co-located with source files as `*.test.ts`

### Communication Protocol

The extension implements a custom binary protocol for M5Stack communication:

- **Frame Format**: Fixed 8-byte structure with CRC16 validation
- **Command Codes**: 9 operation types (0x00-0x08) for different device operations
- **Chunk Transfer**: Large files transferred in 256-byte chunks
- **Error Handling**: CRC validation ensures data integrity during transfer

### Package Structure

This is a monorepo containing:
- **Main Extension**: VS Code extension in root directory
- **SDK Package**: Separate `mpy-sdk` package under `packages/` (being extracted to `@hirossan4049/mpy-sdk`)
- **Multi-platform Support**: SDK works in Node.js, Browser, and React Native environments

## Important Implementation Details

### Serial Connection
- **Baud Rate**: 115200 (hardcoded, do not change)
- **Connection URI Format**: `m5stackfs:/{COM_PORT}{DEVICE_PATH}`
- **Example**: `m5stackfs://COM3/flash/main.py`

### File Operations Limitations
- **Single-file execution only**: The extension cannot resolve imports or dependencies
- **Manual dependency management**: Users must manually upload all required modules
- **256-byte chunk size**: Large files are automatically chunked during transfer
- **Overwrite behavior**: First chunk overwrites, subsequent chunks append

### Command Registration
All VS Code commands are registered in `extension.ts` with the prefix `m5stack.` or `extension.`
Key commands:
- `m5stack.addTreeItem`: Add new M5Stack device
- `m5stack.refreshTreeData`: Refresh device file tree
- `m5stack.itemRun`: Execute current file on device
- `extension.reset.device`: Reset M5Stack device

### Error Handling
- CRC16 validation on all serial frames
- Automatic retry mechanism for failed transfers
- Connection state management in SerialManager (singleton)

### Testing Approach
- **Unit Tests**: Mock serial connections using `__mocks__/serialport`
- **Integration Tests**: Use VS Code's test runner with actual extension context
- **Test Location**: Co-located with source files as `*.test.ts`