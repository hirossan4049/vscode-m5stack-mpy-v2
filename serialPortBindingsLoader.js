// @ts-nocheck
const path = require('path');
const fs = require('fs');

/* 
 * This script handles the serialport native bindings compatibility issue in VS Code extensions.
 * 
 * Problem: VS Code extensions run in Electron with specific Node.js versions, and native
 * modules like serialport must be compiled for the exact Node.js version that VS Code uses.
 * 
 * Solution: Copy pre-built bindings to the locations where node-bindings will look for them.
 * We support multiple Node.js versions to maintain compatibility with different VS Code versions.
 */

const copyBindings = () => {
  // Get current Node.js version
  const currentNodeVersion = process.versions.node;
  console.log(`Current Node.js version: ${currentNodeVersion}`);

  // Node.js versions used by various VS Code releases
  // We keep historical versions for compatibility with older VS Code installations
  const nodeJSVersions = [
    // VS Code 1.48-1.52 (2020)
    '12.14.1', '12.18.3', '12.4.0', '12.8.1',
    // VS Code 1.53-1.65 (2021-2022)
    '14.16.0',
    // VS Code 1.66-1.70 (2022)
    '16.13.0', '16.13.2', '16.14.2', '16.17.1',
    // VS Code 1.71-1.85 (2022-2023)
    '18.17.1', '18.15.0',
    // VS Code 1.86+ (2024+)
    '20.9.0', '20.10.0', '20.11.0', '20.11.1', '20.12.0', 
    '20.13.0', '20.14.0', '20.15.0', '20.16.0', '20.17.0', '20.18.0'
  ];

  // Add current version if not in the list
  if (!nodeJSVersions.includes(currentNodeVersion)) {
    console.log(`Adding current Node.js version ${currentNodeVersion} to the list`);
    nodeJSVersions.push(currentNodeVersion);
  }

  // Get current platform and architecture
  const currentPlatform = process.platform;
  const currentArch = process.arch;
  console.log(`Current platform: ${currentPlatform}, arch: ${currentArch}`);

  // Map of platform-arch combinations with their corresponding binding files
  const platformArchMap = {
    'darwin-x64': 'serialport-bindings-darwin-x64.node',
    'darwin-arm': 'serialport-bindings-darwin-arm.node',
    'darwin-arm64': 'serialport-bindings-darwin-arm64.node',
    'linux-x64': 'serialport-bindings-linux-x64.node',
    'linux-arm': 'serialport-bindings-linux-arm.node',
    'linux-arm64': 'serialport-bindings-linux-arm64.node',
    'win32-ia32': 'serialport-bindings-win32-x32.node',
    'win32-x64': 'serialport-bindings-win32-x64.node',
    'win32-arm': 'serialport-bindings-win32-arm.node',
    'win32-arm64': 'serialport-bindings-win32-arm64.node',
  };

  const platformBindingsFolder = path.join(__dirname, './lib/native/');

  try {
    // Remove any locally built bindings to avoid conflicts
    const buildPath = path.join(__dirname, 'node_modules/@serialport/bindings/build/Release/bindings.node');
    if (fs.existsSync(buildPath)) {
      fs.unlinkSync(buildPath);
      console.log('Removed existing build/Release/bindings.node');
    }
  } catch (e) {
    // Ignore errors if file doesn't exist
  }

  // Copy bindings for the current platform/arch to all supported Node.js versions
  const currentPlatformArch = `${currentPlatform}-${currentArch}`;
  const bindingFileName = platformArchMap[currentPlatformArch];
  
  if (!bindingFileName) {
    console.error(`Unsupported platform/architecture: ${currentPlatformArch}`);
    return;
  }

  const sourcePath = path.join(platformBindingsFolder, bindingFileName);
  
  if (!fs.existsSync(sourcePath)) {
    console.error(`Binding file not found: ${sourcePath}`);
    console.error(`Please ensure you have the pre-built bindings for your platform.`);
    return;
  }

  // Copy binding to all Node.js version directories
  let copiedCount = 0;
  nodeJSVersions.forEach((nodeVersion) => {
    try {
      const destinationFolder = path.join(
        __dirname,
        'node_modules/@serialport/bindings/compiled',
        nodeVersion,
        currentPlatform,
        currentArch
      );

      // Create destination directory if it doesn't exist
      if (!fs.existsSync(destinationFolder)) {
        fs.mkdirSync(destinationFolder, { recursive: true });
      }

      const destinationFile = path.join(destinationFolder, 'bindings.node');
      fs.copyFileSync(sourcePath, destinationFile);
      
      // Only log for the current version and a few others to reduce noise
      if (nodeVersion === currentNodeVersion || copiedCount < 3) {
        console.log(`✓ Copied binding for Node.js ${nodeVersion}`);
      }
      copiedCount++;
    } catch (e) {
      console.error(`Failed to copy binding for Node.js ${nodeVersion}:`, e.message);
    }
  });

  console.log(`\n✓ Successfully copied bindings to ${copiedCount} Node.js version directories`);
  console.log(`✓ Current platform (${currentPlatformArch}) bindings are ready`);
  
  // Also copy to the build directory as a fallback
  try {
    const buildDir = path.join(__dirname, 'node_modules/@serialport/bindings/build/Release');
    if (!fs.existsSync(buildDir)) {
      fs.mkdirSync(buildDir, { recursive: true });
    }
    fs.copyFileSync(sourcePath, path.join(buildDir, 'bindings.node'));
    console.log('✓ Also copied to build/Release as fallback');
  } catch (e) {
    // This is optional, so we can ignore errors
  }
};

// Run the copy process
copyBindings();