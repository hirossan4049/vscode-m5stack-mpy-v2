# @hirossan4049/mpy-sdk

MicroPython SDK for M5Stack devices - Universal serial communication library for Node.js, Browser, and React Native environments.

## Features

- 🔗 **Universal**: Works across Node.js, Browser (Web Serial API), and React Native
- 🛡️ **Type Safe**: Full TypeScript support with comprehensive type definitions
- 📁 **File Management**: Upload, download, and manage files on M5Stack devices
- 🐍 **Python Execution**: Execute Python code and scripts remotely
- 📊 **Progress Tracking**: Real-time progress updates for file transfers
- 🔄 **Auto Retry**: Built-in retry logic for reliable communication
- 🧩 **Dependency Analysis**: Analyze Python imports and dependencies
- 📱 **Multi-Platform**: Support for various development environments

## Installation

```bash
npm install @hirossan4049/mpy-sdk
```

For Node.js environments, you'll also need the serialport dependency:

```bash
npm install serialport
```

## Quick Start

### Basic Usage

```typescript
import { M5StackClient } from '@hirossan4049/mpy-sdk';

const client = new M5StackClient({
  timeout: 10000,
  logLevel: 'info'
});

// List available ports
const ports = await client.listPorts();
console.log('Available ports:', ports);

// Connect to device
const connection = await client.connect('/dev/ttyUSB0');

// Execute Python code
const result = await connection.executeCode('print("Hello, M5Stack!")');
console.log('Output:', result.output);

// List files
const files = await connection.listDirectory('/flash');
console.log('Files:', files);

// Upload a file
await connection.writeFile('/flash/main.py', 'print("Hello World")');

// Disconnect
await client.disconnect('/dev/ttyUSB0');
```

### File Transfer with Progress

```typescript
const fileContent = Buffer.from('# My Python script\nprint("Hello!")');

await connection.writeFile('/flash/script.py', fileContent, {
  onProgress: (bytesWritten, totalBytes) => {
    const percentage = (bytesWritten / totalBytes) * 100;
    console.log(`Upload progress: ${percentage.toFixed(1)}%`);
  }
});
```

### Python Dependency Analysis

```typescript
import { PythonAnalyzer } from '@hirossan4049/mpy-sdk';

const analyzer = new PythonAnalyzer();
const code = `
import config
from utils import helper

config.setup()
helper.log("Starting application")
`;

const imports = analyzer.parseImports(code);
console.log('Imports found:', imports);
```

### Event Handling

```typescript
connection.on('connect', () => {
  console.log('Device connected');
});

connection.on('disconnect', () => {
  console.log('Device disconnected');
});

connection.on('error', (error) => {
  console.error('Connection error:', error);
});

connection.on('busy', (busy) => {
  console.log('Device busy:', busy);
});
```

## API Reference

### M5StackClient

Main client class for managing connections.

```typescript
class M5StackClient {
  constructor(options?: ClientOptions);
  
  async listPorts(): Promise<PortInfo[]>;
  async connect(port: string): Promise<Connection>;
  async disconnect(port: string): Promise<void>;
  getConnection(port: string): Connection | null;
  setLogLevel(level: LogLevel): void;
  setTimeout(timeout: number): void;
}
```

### Connection

Device connection and management.

```typescript
class Connection {
  // File Operations
  async listDirectory(path: string): Promise<DirectoryEntry[]>;
  async readFile(path: string): Promise<Buffer>;
  async writeFile(path: string, content: Buffer | string, options?: WriteOptions): Promise<void>;
  async deleteFile(path: string): Promise<void>;
  
  // Code Execution
  async executeCode(code: string): Promise<ExecutionResult>;
  async executeFile(path: string): Promise<ExecutionResult>;
  
  // Device Info
  async getDeviceInfo(): Promise<DeviceInfo>;
  async isOnline(): Promise<boolean>;
  
  // WiFi Configuration
  async setWifiConfig(ssid: string, password: string): Promise<void>;
}
```

### Types

#### ClientOptions

```typescript
interface ClientOptions {
  timeout?: number;           // Default: 5000ms
  logLevel?: LogLevel;        // Default: 'info'
  autoReconnect?: boolean;    // Default: false
  maxRetries?: number;        // Default: 3
  baudRate?: number;          // Default: 115200
}
```

#### WriteOptions

```typescript
interface WriteOptions {
  overwrite?: boolean;        // Default: true
  createDirectories?: boolean; // Default: false
  encoding?: 'utf8' | 'binary'; // Default: 'utf8'
  onProgress?: (bytesWritten: number, totalBytes: number) => void;
}
```

#### ExecutionResult

```typescript
interface ExecutionResult {
  output: string;
  error?: string;
  exitCode: number;
  executionTime: number;
  timestamp: Date;
}
```

## Platform Support

### Node.js

```typescript
import { M5StackClient } from '@hirossan4049/mpy-sdk';
// Uses 'serialport' package automatically
```

### Browser (Web Serial API)

```typescript
import { M5StackClient } from '@hirossan4049/mpy-sdk/browser';
// Uses Web Serial API
```

### React Native

```typescript
import { M5StackClient } from '@hirossan4049/mpy-sdk/react-native';
// Uses react-native-serial
```

## Advanced Usage

### Custom Protocol Handler

```typescript
import { ProtocolHandler } from '@hirossan4049/mpy-sdk';

const protocol = new ProtocolHandler();
const frame = protocol.createFrame(commandBuffer);
```

### File Transfer Management

```typescript
import { FileTransferManager } from '@hirossan4049/mpy-sdk';

const transferManager = new FileTransferManager(connection);
await transferManager.uploadFile(filename, content, true, {
  chunkSize: 256,
  onProgress: (progress) => console.log(progress),
  retryAttempts: 3
});
```

### Python Code Analysis

```typescript
import { PythonAnalyzer } from '@hirossan4049/mpy-sdk';

const analyzer = new PythonAnalyzer();
const analysis = await analyzer.analyzeProject('main.py', codeContent);

console.log('Dependencies:', analysis.dependencies);
console.log('Missing files:', analysis.missingFiles);
console.log('Circular dependencies:', analysis.circularDependencies);
```

## Error Handling

The library provides specific error types for different scenarios:

```typescript
import { 
  CommunicationError, 
  TimeoutError, 
  DeviceBusyError, 
  FileNotFoundError 
} from '@hirossan4049/mpy-sdk';

try {
  await connection.executeCode('print("hello")');
} catch (error) {
  if (error instanceof TimeoutError) {
    console.log('Operation timed out');
  } else if (error instanceof DeviceBusyError) {
    console.log('Device is busy, try again later');
  } else if (error instanceof CommunicationError) {
    console.log('Communication failed:', error.message);
  }
}
```

## Configuration

### Default Configuration

```typescript
const DEFAULT_CONFIG = {
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
```

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/new-feature`
3. Make your changes and add tests
4. Run tests: `npm test`
5. Submit a pull request

## License

MIT License. See [LICENSE](LICENSE) for details.

## Related Projects

- [vscode-m5stack-mpy](https://github.com/curdeveryday/vscode-m5stack-mpy) - VS Code extension using this library
- [M5Stack](https://m5stack.com/) - Official M5Stack hardware and software

## Support

- 📖 [Documentation](https://github.com/m5stack/serial-client/docs)
- 🐛 [Issue Tracker](https://github.com/m5stack/serial-client/issues)
- 💬 [Discussions](https://github.com/m5stack/serial-client/discussions)