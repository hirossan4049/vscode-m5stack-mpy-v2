# Packages

This directory contains git submodules for external packages used by the VS Code extension.

## mpy-sdk

The `mpy-sdk` directory is a git submodule that contains the standalone MicroPython SDK library.

- **Repository**: https://github.com/hirossan4049/mpy-sdk
- **Purpose**: Universal M5Stack serial communication library
- **Usage**: Provides core functionality for M5Stack MicroPython development

### Working with the Submodule

#### Initial Setup
```bash
# Clone with submodules
git clone --recursive <this-repo>

# Or if already cloned, initialize submodules
git submodule update --init --recursive
```

#### Updating the Submodule
```bash
# Update to latest version
cd packages/mpy-sdk
git pull origin main
cd ../..
git add packages/mpy-sdk
git commit -m "Update mpy-sdk to latest version"
```

#### Development
```bash
# Work on the submodule
cd packages/mpy-sdk
# Make changes, commit, push to mpy-sdk repo

# Update main repo to use new version
cd ../..
git add packages/mpy-sdk
git commit -m "Update mpy-sdk submodule"
```

### Integration

The VS Code extension uses the mpy-sdk through an adapter pattern:
- `src/adapters/SerialClientAdapter.ts` - Compatibility layer
- Import path: `../../packages/mpy-sdk/src`

This allows the extension to use the modern SDK while maintaining backward compatibility with existing code.