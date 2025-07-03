/**
 * Adapter for integrating @m5stack/serial-client with VS Code extension
 * 
 * Provides backward compatibility with existing SerialManager interface
 * while using the new unified library underneath.
 */

import { M5StackClient, Connection } from '@m5stack/serial-client';
import { PortInfo } from '@serialport/bindings-interface';

/**
 * Legacy-compatible Serial Manager using the new library
 */
class SerialClientAdapter {
  private client: M5StackClient;
  private connections: Map<string, Connection> = new Map();

  constructor() {
    this.client = new M5StackClient({
      timeout: 10000,
      logLevel: 'info',
      baudRate: 115200
    });

    // Forward client events for debugging
    this.client.on('connect', (port) => {
      console.log(`[SerialClientAdapter] Connected to ${port}`);
    });

    this.client.on('disconnect', (port) => {
      console.log(`[SerialClientAdapter] Disconnected from ${port}`);
      this.connections.delete(port);
    });

    this.client.on('error', (port, error) => {
      console.error(`[SerialClientAdapter] Error on ${port}:`, error);
    });
  }

  /**
   * Connect to device (legacy interface)
   */
  connect(com: string, openedCb: (err: unknown) => void): void {
    this.client.connect(com)
      .then((connection) => {
        this.connections.set(com, connection);
        openedCb(null);
      })
      .catch((error) => {
        openedCb(error);
      });
  }

  /**
   * Execute Python code (legacy interface)
   */
  async exec(com: string, code: string): Promise<Buffer> {
    const connection = this.connections.get(com);
    if (!connection) {
      throw new Error(`No connection found for ${com}`);
    }

    const result = await connection.executeCode(code);
    
    // Return 'done' for success, error message for failure
    if (result.exitCode === 0) {
      return Buffer.from('done');
    } else {
      return Buffer.from(result.error || 'execution failed');
    }
  }

  /**
   * List directory contents (legacy interface)
   */
  async listDir(com: string, dirname: string): Promise<Buffer> {
    const connection = this.connections.get(com);
    if (!connection) {
      throw new Error(`No connection found for ${com}`);
    }

    const entries = await connection.listDirectory(dirname);
    const fileNames = entries.map(entry => entry.name).join(',');
    return Buffer.from(fileNames);
  }

  /**
   * Check if device is busy (legacy interface)
   */
  isBusy(com: string): boolean {
    const connection = this.connections.get(com);
    return connection?.isBusy ?? false;
  }

  /**
   * Read file from device (legacy interface)
   */
  async readFile(com: string, filename: string): Promise<Buffer> {
    const connection = this.connections.get(com);
    if (!connection) {
      throw new Error(`No connection found for ${com}`);
    }

    return await connection.readFile(filename);
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
    const connection = this.connections.get(com);
    if (!connection) {
      throw new Error(`No connection found for ${com}`);
    }

    try {
      const data = typeof content === 'string' ? content : content.toString('utf8');
      
      await connection.writeFile(filename, data, {
        overwrite: flag === 0x01, // 0x01 = overwrite, 0x00 = append
        encoding: isBinary ? 'binary' : 'utf8'
      });
      
      return Buffer.from('done');
    } catch (error) {
      return Buffer.from(`error: ${error}`);
    }
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
    const connection = this.connections.get(com);
    if (!connection) {
      throw new Error(`No connection found for ${com}`);
    }

    try {
      const data = typeof content === 'string' ? content : content.toString('utf8');
      
      await connection.writeFile(filename, data, {
        overwrite: true,
        encoding: isBinary ? 'binary' : 'utf8',
        onProgress: (bytesWritten, totalBytes) => {
          // Convert to chunk-based progress for compatibility
          const chunkSize = 256; // MAX_CHUNK_LENGTH from legacy code
          const currentChunk = Math.ceil(bytesWritten / chunkSize);
          progressCb(currentChunk);
        }
      });
      
      return Buffer.from('done');
    } catch (error) {
      return Buffer.from(`error: ${error}`);
    }
  }

  /**
   * Remove file (legacy interface)
   */
  async removeFile(com: string, filename: string): Promise<Buffer> {
    const connection = this.connections.get(com);
    if (!connection) {
      throw new Error(`No connection found for ${com}`);
    }

    try {
      await connection.deleteFile(filename);
      return Buffer.from('done');
    } catch (error) {
      return Buffer.from(`error: ${error}`);
    }
  }

  /**
   * Disconnect from device (legacy interface)
   */
  disconnect(com: string): void {
    this.client.disconnect(com).catch((error) => {
      console.error(`Failed to disconnect from ${com}:`, error);
    });
  }

  /**
   * Get available ports (static method for compatibility)
   */
  static async getCOMs(): Promise<PortInfo[]> {
    const client = new M5StackClient();
    try {
      const ports = await client.listPorts();
      // Convert to legacy PortInfo format
      return ports.map(port => ({
        path: port.path,
        manufacturer: port.manufacturer,
        serialNumber: port.serialNumber,
        pnpId: port.pnpId,
        locationId: port.locationId,
        vendorId: port.vendorId,
        productId: port.productId
      }));
    } catch (error) {
      console.error('Failed to list ports:', error);
      return [];
    }
  }

  /**
   * Enhanced features using the new library
   */

  /**
   * Get device information
   */
  async getDeviceInfo(com: string): Promise<object> {
    const connection = this.connections.get(com);
    if (!connection) {
      throw new Error(`No connection found for ${com}`);
    }

    return await connection.getDeviceInfo();
  }

  /**
   * Check if device is online
   */
  async isDeviceOnline(com: string): Promise<boolean> {
    const connection = this.connections.get(com);
    if (!connection) {
      return false;
    }

    try {
      return await connection.isOnline();
    } catch (error) {
      return false;
    }
  }

  /**
   * Set WiFi configuration
   */
  async setWifiConfig(com: string, ssid: string, password: string): Promise<Buffer> {
    const connection = this.connections.get(com);
    if (!connection) {
      throw new Error(`No connection found for ${com}`);
    }

    try {
      await connection.setWifiConfig(ssid, password);
      return Buffer.from('done');
    } catch (error) {
      return Buffer.from(`error: ${error}`);
    }
  }

  /**
   * Execute file with dependency analysis
   */
  async executeFileWithDependencies(com: string, filename: string): Promise<Buffer> {
    const connection = this.connections.get(com);
    if (!connection) {
      throw new Error(`No connection found for ${com}`);
    }

    try {
      const result = await connection.executeProject(filename, {
        uploadMissing: false // Don't auto-upload for now
      });
      
      if (result.exitCode === 0) {
        return Buffer.from('done');
      } else {
        return Buffer.from(result.error || 'execution failed');
      }
    } catch (error) {
      return Buffer.from(`error: ${error}`);
    }
  }

  /**
   * Get connection status
   */
  getConnectionStatus(): object {
    return {
      client: this.client.getStatus(),
      connections: Array.from(this.connections.entries()).map(([port, conn]) => ({
        port,
        connected: conn.isConnected,
        busy: conn.isBusy
      }))
    };
  }

  /**
   * Health check all connections
   */
  async healthCheck(): Promise<{ [port: string]: boolean }> {
    return await this.client.healthCheck();
  }
}

// Export singleton instance for backward compatibility
export default new SerialClientAdapter();

// Also export the class for testing
export { SerialClientAdapter };