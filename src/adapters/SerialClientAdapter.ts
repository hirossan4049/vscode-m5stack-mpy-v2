/**
 * Adapter for integrating @hirossan4049/mpy-sdk with VS Code extension
 * 
 * Provides backward compatibility with existing SerialManager interface
 * while using the new unified library underneath.
 */

// TODO: Enable when SDK is ready
// import { M5StackClient, Connection } from '../../packages/mpy-sdk/src';
import { PortInfo } from '@serialport/bindings-interface';

/**
 * Legacy-compatible Serial Manager using the new library
 */
class SerialClientAdapter {
  // TODO: Enable when SDK is ready
  // private client: M5StackClient;
  // private connections: Map<string, Connection> = new Map();

  constructor() {
    // TODO: Enable when SDK is ready
    console.log('[SerialClientAdapter] Placeholder - SDK integration pending');
  }

  /**
   * Connect to device (legacy interface)
   */
  connect(com: string, openedCb: (err: unknown) => void): void {
    // TODO: Implement with SDK when ready
    console.log(`[SerialClientAdapter] Connect to ${com} - placeholder`);
    openedCb(new Error('SDK integration pending'));
  }

  /**
   * Execute Python code (legacy interface)
   */
  async exec(com: string, code: string): Promise<Buffer> {
    // TODO: Implement with SDK when ready
    console.log(`[SerialClientAdapter] Execute code on ${com} - placeholder`);
    throw new Error('SDK integration pending');
  }

  /**
   * List directory contents (legacy interface)
   */
  async listDir(com: string, dirname: string): Promise<Buffer> {
    // TODO: Implement with SDK when ready
    console.log(`[SerialClientAdapter] List directory ${dirname} on ${com} - placeholder`);
    throw new Error('SDK integration pending');
  }

  /**
   * Check if device is busy (legacy interface)
   */
  isBusy(com: string): boolean {
    // TODO: Implement with SDK when ready
    return false;
  }

  /**
   * Read file from device (legacy interface)
   */
  async readFile(com: string, filename: string): Promise<Buffer> {
    // TODO: Implement with SDK when ready
    console.log(`[SerialClientAdapter] Read file ${filename} from ${com} - placeholder`);
    throw new Error('SDK integration pending');
  }

  /**
   * Upload file using legacy download interface
   */
  async download(
    com: string,
    filename: string,
    content: string | Buffer,
    flag: number,
    isBinary?: boolean
  ): Promise<Buffer> {
    // TODO: Implement with SDK when ready
    console.log(`[SerialClientAdapter] Download ${filename} to ${com} - placeholder`);
    throw new Error('SDK integration pending');
  }

  /**
   * Bulk download with progress (legacy interface)
   */
  async bulkDownload(
    com: string,
    filename: string,
    content: string | Buffer,
    isBinary: boolean,
    progressCb: (chunkIndex: number) => void
  ): Promise<Buffer> {
    // TODO: Implement with SDK when ready
    console.log(`[SerialClientAdapter] Bulk download ${filename} to ${com} - placeholder`);
    throw new Error('SDK integration pending');
  }

  /**
   * Remove file (legacy interface)
   */
  async removeFile(com: string, filename: string): Promise<Buffer> {
    // TODO: Implement with SDK when ready
    console.log(`[SerialClientAdapter] Remove file ${filename} from ${com} - placeholder`);
    throw new Error('SDK integration pending');
  }

  /**
   * Disconnect from device (legacy interface)
   */
  disconnect(com: string): void {
    // TODO: Implement with SDK when ready
    console.log(`[SerialClientAdapter] Disconnect from ${com} - placeholder`);
  }

  /**
   * Get available ports (static method for compatibility)
   */
  static async getCOMs(): Promise<PortInfo[]> {
    // TODO: Implement with SDK when ready
    console.log('[SerialClientAdapter] Get COMs - placeholder');
    return [];
  }
}

// Export singleton instance for backward compatibility
export default new SerialClientAdapter();

// Also export the class for testing
export { SerialClientAdapter };