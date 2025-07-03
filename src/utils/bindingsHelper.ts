import * as fs from 'fs';
import * as path from 'path';

/**
 * Runtime helper to ensure serialport bindings are available for the current VS Code environment.
 * This is a more dynamic solution that runs when the extension is activated.
 */
export class BindingsHelper {
  private static readonly BINDING_LOCATIONS = [
    'build/Release/bindings.node',
    'build/Debug/bindings.node',
    'compiled/{version}/{platform}/{arch}/bindings.node',
  ];

  /**
   * Ensures that serialport bindings are available for the current environment.
   * This method should be called during extension activation.
   */
  static async ensureBindings(): Promise<void> {
    const nodeVersion = process.versions.node;
    const platform = process.platform;
    const arch = process.arch;

    console.log(`[BindingsHelper] Checking bindings for Node.js ${nodeVersion} on ${platform}-${arch}`);

    // Path to the pre-built native binding for current platform
    const bindingFileName = this.getBindingFileName(platform, arch);
    if (!bindingFileName) {
      throw new Error(`Unsupported platform/architecture: ${platform}-${arch}`);
    }

    const extensionPath = path.join(__dirname, '..', '..');
    const sourcePath = path.join(extensionPath, 'lib', 'native', bindingFileName);

    if (!fs.existsSync(sourcePath)) {
      throw new Error(`Native binding not found: ${sourcePath}`);
    }

    // Try to find where node-bindings is looking for the module
    const bindingsModulePath = path.join(extensionPath, 'node_modules', '@serialport', 'bindings');
    
    // Primary location: compiled/{version}/{platform}/{arch}/bindings.node
    const primaryPath = path.join(bindingsModulePath, 'compiled', nodeVersion, platform, arch);
    const primaryFile = path.join(primaryPath, 'bindings.node');

    // Ensure directory exists and copy the binding
    if (!fs.existsSync(primaryPath)) {
      fs.mkdirSync(primaryPath, { recursive: true });
    }

    try {
      fs.copyFileSync(sourcePath, primaryFile);
      console.log(`[BindingsHelper] ✓ Copied binding to primary location`);
    } catch (error) {
      console.error(`[BindingsHelper] Failed to copy binding:`, error);
      
      // Fallback: try build/Release location
      const fallbackPath = path.join(bindingsModulePath, 'build', 'Release');
      const fallbackFile = path.join(fallbackPath, 'bindings.node');
      
      if (!fs.existsSync(fallbackPath)) {
        fs.mkdirSync(fallbackPath, { recursive: true });
      }
      
      fs.copyFileSync(sourcePath, fallbackFile);
      console.log(`[BindingsHelper] ✓ Copied binding to fallback location`);
    }
  }

  /**
   * Gets the appropriate binding filename for the current platform and architecture.
   */
  private static getBindingFileName(platform: string, arch: string): string | null {
    const mappings: Record<string, string> = {
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

    return mappings[`${platform}-${arch}`] || null;
  }

  /**
   * Checks if bindings are already available without copying.
   */
  static async checkBindings(): Promise<boolean> {
    try {
      // Try to require the serialport bindings
      require('@serialport/bindings');
      return true;
    } catch (error) {
      return false;
    }
  }
}