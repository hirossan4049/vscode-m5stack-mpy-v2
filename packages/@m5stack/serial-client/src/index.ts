/**
 * @m5stack/serial-client
 * 
 * Universal M5Stack serial communication library
 */

// Core exports
export { BaseSerialConnection } from './core/SerialConnection';
export { NodeSerialConnection } from './core/NodeSerialConnection';
export { ProtocolHandler } from './core/ProtocolHandler';

// Manager exports
export { DeviceManager } from './manager/DeviceManager';

// Utility exports
export { FileTransferManager } from './utils/FileTransfer';
export { PythonAnalyzer } from './utils/PythonAnalyzer';

// Type exports
export * from './types';

// Main client class
import { EventEmitter } from 'events';
import {
  ClientOptions,
  PortInfo,
  LogLevel,
  ILogger,
  DEFAULT_CONFIG,
  CommunicationError
} from './types';
import { NodeSerialConnection } from './core/NodeSerialConnection';
import { DeviceManager } from './manager/DeviceManager';

/**
 * Simple console logger implementation
 */
class ConsoleLogger implements ILogger {
  constructor(private level: LogLevel) {}

  debug(message: string, ...args: any[]): void {
    if (this.shouldLog('debug')) {
      console.debug(`[DEBUG] ${message}`, ...args);
    }
  }

  info(message: string, ...args: any[]): void {
    if (this.shouldLog('info')) {
      console.info(`[INFO] ${message}`, ...args);
    }
  }

  warn(message: string, ...args: any[]): void {
    if (this.shouldLog('warn')) {
      console.warn(`[WARN] ${message}`, ...args);
    }
  }

  error(message: string, ...args: any[]): void {
    if (this.shouldLog('error')) {
      console.error(`[ERROR] ${message}`, ...args);
    }
  }

  private shouldLog(level: LogLevel): boolean {
    const levels = ['debug', 'info', 'warn', 'error'];
    return levels.indexOf(level) >= levels.indexOf(this.level);
  }
}

/**
 * Connection wrapper class
 */
export class Connection extends DeviceManager {
  readonly port: string;

  constructor(connection: NodeSerialConnection) {
    super(connection);
    this.port = connection.portName;
  }

  get isConnected(): boolean {
    return this.connection.connected;
  }

  get isBusy(): boolean {
    return this.connection.busy;
  }
}

/**
 * Main M5Stack client class
 */
export class M5StackClient extends EventEmitter {
  private options: Required<ClientOptions>;
  private logger: ILogger;
  private connections: Map<string, Connection> = new Map();

  constructor(options: ClientOptions = {}) {
    super();
    
    this.options = {
      timeout: options.timeout || DEFAULT_CONFIG.defaultTimeout,
      logLevel: options.logLevel || 'info',
      autoReconnect: options.autoReconnect || false,
      maxRetries: options.maxRetries || 3,
      baudRate: options.baudRate || DEFAULT_CONFIG.defaultBaudRate
    };

    this.logger = new ConsoleLogger(this.options.logLevel);
    this.logger.info('M5Stack client initialized', this.options);
  }

  /**
   * List available serial ports
   */
  async listPorts(): Promise<PortInfo[]> {
    try {
      this.logger.debug('Listing available ports');
      return await NodeSerialConnection.listPorts();
    } catch (error) {
      this.logger.error('Failed to list ports:', error);
      throw new CommunicationError(`Failed to list ports: ${error}`);
    }
  }

  /**
   * Connect to a device
   */
  async connect(port: string): Promise<Connection> {
    if (this.connections.has(port)) {
      const existing = this.connections.get(port)!;
      if (existing.isConnected) {
        this.logger.warn(`Already connected to ${port}`);
        return existing;
      }
      // Remove disconnected connection
      this.connections.delete(port);
    }

    this.logger.info(`Connecting to ${port}`);

    try {
      const serialConnection = new NodeSerialConnection(port, {
        baudRate: this.options.baudRate,
        timeout: this.options.timeout,
        autoReconnect: this.options.autoReconnect
      });

      const connection = new Connection(serialConnection);
      
      // Forward events
      connection.on('connect', () => {
        this.logger.info(`Connected to ${port}`);
        this.emit('connect', port);
      });

      connection.on('disconnect', () => {
        this.logger.info(`Disconnected from ${port}`);
        this.connections.delete(port);
        this.emit('disconnect', port);
      });

      connection.on('error', (error) => {
        this.logger.error(`Connection error on ${port}:`, error);
        this.emit('error', port, error);
      });

      await connection.connect();
      this.connections.set(port, connection);
      
      return connection;

    } catch (error) {
      this.logger.error(`Failed to connect to ${port}:`, error);
      throw new CommunicationError(`Failed to connect to ${port}: ${error}`);
    }
  }

  /**
   * Disconnect from a device
   */
  async disconnect(port: string): Promise<void> {
    const connection = this.connections.get(port);
    if (!connection) {
      this.logger.warn(`No connection found for ${port}`);
      return;
    }

    this.logger.info(`Disconnecting from ${port}`);
    
    try {
      await connection.disconnect();
      this.connections.delete(port);
    } catch (error) {
      this.logger.error(`Failed to disconnect from ${port}:`, error);
      throw new CommunicationError(`Failed to disconnect from ${port}: ${error}`);
    }
  }

  /**
   * Disconnect from all devices
   */
  async disconnectAll(): Promise<void> {
    const ports = Array.from(this.connections.keys());
    
    await Promise.allSettled(
      ports.map(port => this.disconnect(port))
    );
  }

  /**
   * Get connection for a port
   */
  getConnection(port: string): Connection | null {
    return this.connections.get(port) || null;
  }

  /**
   * Get all active connections
   */
  getConnections(): Connection[] {
    return Array.from(this.connections.values());
  }

  /**
   * Set log level
   */
  setLogLevel(level: LogLevel): void {
    this.options.logLevel = level;
    this.logger = new ConsoleLogger(level);
    this.logger.info(`Log level set to ${level}`);
  }

  /**
   * Set default timeout
   */
  setTimeout(timeout: number): void {
    this.options.timeout = timeout;
    this.logger.info(`Default timeout set to ${timeout}ms`);
  }

  /**
   * Get client status
   */
  getStatus(): object {
    return {
      options: this.options,
      activeConnections: this.connections.size,
      connections: Array.from(this.connections.entries()).map(([port, conn]) => ({
        port,
        connected: conn.isConnected,
        busy: conn.isBusy
      }))
    };
  }

  /**
   * Health check - ping all connected devices
   */
  async healthCheck(): Promise<{ [port: string]: boolean }> {
    const results: { [port: string]: boolean } = {};
    
    for (const [port, connection] of this.connections) {
      try {
        results[port] = await connection.isOnline();
      } catch (error) {
        this.logger.warn(`Health check failed for ${port}:`, error);
        results[port] = false;
      }
    }
    
    return results;
  }
}

// Default export
export default M5StackClient;