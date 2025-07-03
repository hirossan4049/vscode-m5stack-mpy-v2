/**
 * Core Serial Connection Handler
 * 
 * Platform-agnostic serial connection management with M5Stack protocol support
 */

import { EventEmitter } from 'events';
import { 
  ISerialConnection, 
  ConnectionOptions, 
  CommandCode, 
  Command, 
  CommandResponse,
  ResponseStatus,
  ConnectionEventMap,
  CommunicationError,
  TimeoutError,
  DeviceBusyError,
  DEFAULT_CONFIG 
} from '../types';
import { ProtocolHandler } from './ProtocolHandler';

export abstract class BaseSerialConnection extends EventEmitter implements ISerialConnection {
  protected port: string;
  protected options: Required<ConnectionOptions>;
  protected protocolHandler: ProtocolHandler;
  protected isConnected: boolean = false;
  protected isBusy: boolean = false;
  protected receivedBuffer: Buffer = Buffer.alloc(0);
  
  // Promise resolution handlers for current command
  protected currentResolve?: (value: CommandResponse) => void;
  protected currentReject?: (error: Error) => void;
  protected commandTimeout?: NodeJS.Timeout;

  constructor(port: string, options: ConnectionOptions = {}) {
    super();
    this.port = port;
    this.options = {
      baudRate: options.baudRate || DEFAULT_CONFIG.defaultBaudRate,
      timeout: options.timeout || DEFAULT_CONFIG.defaultTimeout,
      autoReconnect: options.autoReconnect || false,
    };
    this.protocolHandler = new ProtocolHandler();
  }

  // Abstract methods to be implemented by platform-specific classes
  abstract connect(): Promise<void>;
  abstract disconnect(): Promise<void>;
  abstract writeRaw(data: Buffer): Promise<void>;
  abstract isOpen(): boolean;

  /**
   * Send command to M5Stack device
   */
  async sendCommand(command: Command): Promise<CommandResponse> {
    if (!this.isConnected) {
      throw new CommunicationError('Not connected to device');
    }

    if (this.isBusy) {
      throw new DeviceBusyError('Device is busy with another operation');
    }

    return new Promise((resolve, reject) => {
      this.isBusy = true;
      this.currentResolve = resolve;
      this.currentReject = reject;
      this.receivedBuffer = Buffer.alloc(0);

      // Set timeout
      const timeout = command.timeout || this.options.timeout;
      this.commandTimeout = setTimeout(() => {
        this.handleCommandTimeout();
      }, timeout);

      // Send command
      this.sendCommandInternal(command).catch(reject);
    });
  }

  /**
   * Send command with automatic retry
   */
  async sendCommandWithRetry(command: Command, maxRetries: number = 3): Promise<CommandResponse> {
    let lastError: Error;
    
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await this.sendCommand(command);
      } catch (error) {
        lastError = error as Error;
        
        // Don't retry certain errors
        if (error instanceof DeviceBusyError || error instanceof TimeoutError) {
          break;
        }
        
        if (attempt < maxRetries) {
          // Wait before retry
          await new Promise(resolve => setTimeout(resolve, 100 * (attempt + 1)));
        }
      }
    }
    
    throw lastError!;
  }

  /**
   * Internal command sending logic
   */
  private async sendCommandInternal(command: Command): Promise<void> {
    try {
      const commandBuffer = this.protocolHandler.createCommandBuffer(command.code, command.data);
      const frame = this.protocolHandler.createFrame(commandBuffer);
      
      console.log(`Sending command 0x${command.code.toString(16)}:`, frame.toString('hex'));
      
      await this.writeRaw(frame);
      this.emit('busy', true);
      
    } catch (error) {
      this.handleCommandError(new CommunicationError(`Failed to send command: ${error}`));
    }
  }

  /**
   * Handle received data
   */
  protected onDataReceived(chunk: Buffer): void {
    this.receivedBuffer = Buffer.concat([this.receivedBuffer, chunk]);
    
    // Emit raw data event
    this.emit('data', chunk);

    // Check if we have a complete frame
    if (this.protocolHandler.isFrameComplete(this.receivedBuffer)) {
      this.processReceivedFrame();
    }
  }

  /**
   * Process complete received frame
   */
  private processReceivedFrame(): void {
    try {
      const responseData = this.protocolHandler.extractResponseData(this.receivedBuffer);
      
      const response: CommandResponse = {
        status: ResponseStatus.SUCCESS,
        data: responseData,
        timestamp: new Date(),
        duration: this.commandTimeout ? Date.now() - (Date.now() - this.options.timeout) : 0
      };

      this.handleCommandSuccess(response);
      
    } catch (error) {
      this.handleCommandError(new CommunicationError(`Failed to process response: ${error}`));
    }
  }

  /**
   * Handle successful command completion
   */
  private handleCommandSuccess(response: CommandResponse): void {
    this.clearCommandState();
    
    if (this.currentResolve) {
      this.currentResolve(response);
    }
  }

  /**
   * Handle command error
   */
  private handleCommandError(error: Error): void {
    this.clearCommandState();
    
    if (this.currentReject) {
      this.currentReject(error);
    }
    
    this.emit('error', error);
  }

  /**
   * Handle command timeout
   */
  private handleCommandTimeout(): void {
    const error = new TimeoutError(`Command timeout after ${this.options.timeout}ms`);
    this.handleCommandError(error);
  }

  /**
   * Clear command state
   */
  private clearCommandState(): void {
    this.isBusy = false;
    this.receivedBuffer = Buffer.alloc(0);
    
    if (this.commandTimeout) {
      clearTimeout(this.commandTimeout);
      this.commandTimeout = undefined;
    }
    
    this.currentResolve = undefined;
    this.currentReject = undefined;
    
    this.emit('busy', false);
  }

  /**
   * Handle connection events
   */
  protected onConnected(): void {
    this.isConnected = true;
    console.log(`Connected to ${this.port}`);
    this.emit('connect');
  }

  protected onDisconnected(): void {
    this.isConnected = false;
    this.clearCommandState();
    console.log(`Disconnected from ${this.port}`);
    this.emit('disconnect');
  }

  protected onError(error: Error): void {
    console.error(`Serial connection error on ${this.port}:`, error);
    this.emit('error', error);
    
    if (this.isBusy) {
      this.handleCommandError(error);
    }
  }

  /**
   * Get connection status
   */
  get connected(): boolean {
    return this.isConnected;
  }

  get busy(): boolean {
    return this.isBusy;
  }

  get portName(): string {
    return this.port;
  }

  /**
   * Type-safe event emission
   */
  emit<K extends keyof ConnectionEventMap>(event: K, ...args: Parameters<ConnectionEventMap[K]>): boolean {
    return super.emit(event, ...args);
  }

  /**
   * Type-safe event listener
   */
  on<K extends keyof ConnectionEventMap>(event: K, listener: ConnectionEventMap[K]): this {
    return super.on(event, listener);
  }

  off<K extends keyof ConnectionEventMap>(event: K, listener: ConnectionEventMap[K]): this {
    return super.off(event, listener);
  }

  /**
   * Diagnostic information
   */
  getStatus(): object {
    return {
      port: this.port,
      connected: this.isConnected,
      busy: this.isBusy,
      options: this.options,
      receivedBufferSize: this.receivedBuffer.length
    };
  }
}