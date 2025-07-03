/**
 * @hirossan4049/mpy-sdk Type Definitions
 * 
 * Comprehensive type definitions for M5Stack serial communication
 */

export interface PortInfo {
  path: string;
  manufacturer?: string;
  serialNumber?: string;
  vendorId?: string;
  productId?: string;
  pnpId?: string;
  locationId?: string;
}

export interface ClientOptions {
  timeout?: number;           // Default: 5000ms
  logLevel?: LogLevel;        // Default: 'info'
  autoReconnect?: boolean;    // Default: false
  maxRetries?: number;        // Default: 3
  baudRate?: number;          // Default: 115200
}

export interface ConnectionOptions {
  baudRate?: number;
  timeout?: number;
  autoReconnect?: boolean;
}

export interface DirectoryEntry {
  name: string;
  type: 'file' | 'directory';
  size?: number;
  lastModified?: Date;
  path: string;
}

export interface WriteOptions {
  overwrite?: boolean;        // Default: true
  createDirectories?: boolean; // Default: false
  encoding?: 'utf8' | 'binary'; // Default: 'utf8'
  onProgress?: (bytesWritten: number, totalBytes: number) => void;
}

export interface ExecutionResult {
  output: string;
  error?: string;
  exitCode: number;
  executionTime: number;
  timestamp: Date;
}

export interface DeviceInfo {
  platform: string;
  version: string;
  chipId: string;
  flashSize: number;
  ramSize: number;
  macAddress?: string;
}

export interface Command {
  code: CommandCode;
  data: Buffer | string;
  timeout?: number;
}

export interface CommandResponse {
  status: ResponseStatus;
  data: Buffer;
  timestamp: Date;
  duration: number;
}

export enum CommandCode {
  IS_ONLINE = 0x00,
  GET_INFO = 0x01,
  EXEC = 0x02,
  LIST_DIR = 0x03,
  DOWNLOAD = 0x04,
  GET_FILE = 0x05,
  DOWNLOAD_FILE = 0x06,
  REMOVE_FILE = 0x07,
  SET_WIFI = 0x08,
}

export enum ResponseStatus {
  SUCCESS = 0x00,
  ERROR = 0x01,
  TIMEOUT = 0x02,
  BUSY = 0x03,
  NOT_FOUND = 0x04,
  PERMISSION_DENIED = 0x05,
}

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface ConnectionEventMap {
  'connect': () => void;
  'disconnect': () => void;
  'data': (data: Buffer) => void;
  'error': (error: Error) => void;
  'busy': (busy: boolean) => void;
  'timeout': () => void;
}

export interface ProtocolFrame {
  header: Buffer;
  length: number;
  command: CommandCode;
  data: Buffer;
  crc: number;
  footer: Buffer;
}

export interface FileTransferProgress {
  filename: string;
  bytesTransferred: number;
  totalBytes: number;
  percentage: number;
  chunkIndex: number;
  totalChunks: number;
}

export interface BulkTransferOptions {
  chunkSize?: number;         // Default: 256 bytes
  onProgress?: (progress: FileTransferProgress) => void;
  onChunkComplete?: (chunkIndex: number, totalChunks: number) => void;
  retryAttempts?: number;     // Default: 3
}

// Import Analysis Types
export interface ImportStatement {
  type: 'import' | 'from_import';
  module: string;
  items?: string[];
  isRelative: boolean;
  line: number;
  raw: string;
}

export interface DependencyInfo {
  filename: string;
  dependencies: string[];
  dependents: string[];
  exists: boolean;
  lastModified?: Date;
  size?: number;
}

export interface DependencyGraph {
  [filename: string]: DependencyInfo;
}

export interface ProjectAnalysis {
  entryPoint: string;
  dependencies: DependencyGraph;
  missingFiles: string[];
  circularDependencies: string[][];
  totalFiles: number;
}

// Error Types
export class M5StackError extends Error {
  constructor(
    message: string,
    public code: string,
    public details?: any
  ) {
    super(message);
    this.name = 'M5StackError';
  }
}

export class CommunicationError extends M5StackError {
  constructor(message: string, details?: any) {
    super(message, 'COMMUNICATION_ERROR', details);
    this.name = 'CommunicationError';
  }
}

export class TimeoutError extends M5StackError {
  constructor(message: string, details?: any) {
    super(message, 'TIMEOUT_ERROR', details);
    this.name = 'TimeoutError';
  }
}

export class DeviceBusyError extends M5StackError {
  constructor(message: string, details?: any) {
    super(message, 'DEVICE_BUSY_ERROR', details);
    this.name = 'DeviceBusyError';
  }
}

export class FileNotFoundError extends M5StackError {
  constructor(filename: string, details?: any) {
    super(`File not found: ${filename}`, 'FILE_NOT_FOUND_ERROR', details);
    this.name = 'FileNotFoundError';
  }
}

// Platform-specific interfaces
export interface ISerialConnection {
  connect(port: string, options?: ConnectionOptions): Promise<void>;
  disconnect(): Promise<void>;
  write(data: Buffer): Promise<void>;
  read(): Promise<Buffer>;
  isOpen(): boolean;
  on<K extends keyof ConnectionEventMap>(event: K, listener: ConnectionEventMap[K]): void;
  off<K extends keyof ConnectionEventMap>(event: K, listener: ConnectionEventMap[K]): void;
}

export interface ILogger {
  debug(message: string, ...args: any[]): void;
  info(message: string, ...args: any[]): void;
  warn(message: string, ...args: any[]): void;
  error(message: string, ...args: any[]): void;
}

export interface IPlatformAdapter {
  listPorts(): Promise<PortInfo[]>;
  createConnection(port: string): ISerialConnection;
  isSupported(): boolean;
  getPlatformName(): string;
}

// Configuration
export interface SerialClientConfig {
  defaultTimeout: number;
  defaultBaudRate: number;
  maxChunkSize: number;
  protocolVersion: string;
  crcPolynomial: number;
  frameDelimiters: {
    header: number[];
    footer: number[];
  };
}

export const DEFAULT_CONFIG: SerialClientConfig = {
  defaultTimeout: 5000,
  defaultBaudRate: 115200,
  maxChunkSize: 256,
  protocolVersion: '1.0',
  crcPolynomial: 0x8005,
  frameDelimiters: {
    header: [0xaa, 0xab, 0xaa],
    footer: [0xab, 0xcc, 0xab],
  },
};