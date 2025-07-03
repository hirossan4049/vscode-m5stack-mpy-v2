# M5Stack Serial Library 分離設計ドキュメント

## 概要

現在のVS Code拡張機能からシリアル通信ライブラリを独立したパッケージとして分離し、様々なプラットフォームやアプリケーションで再利用可能なライブラリとして提供することを目的とした設計ドキュメント。

## 目標アーキテクチャ

```
@m5stack/serial-client (独立ライブラリ)
├── Core Communication Layer
├── Protocol Handler
├── Device Manager
└── Type Definitions

vscode-m5stack-mpy (VS Code拡張)
├── VS Code Integration
├── UI Components
├── File System Provider
└── @m5stack/serial-client (依存)

Other Applications
├── CLI Tool
├── Web Application
├── Electron App
└── @m5stack/serial-client (依存)
```

## ライブラリ仕様: @m5stack/serial-client

### パッケージ構造

```
@m5stack/serial-client/
├── src/
│   ├── core/
│   │   ├── SerialConnection.ts     # 低レベル通信
│   │   ├── ProtocolHandler.ts      # プロトコル処理
│   │   └── CrcUtils.ts            # CRC計算
│   ├── manager/
│   │   ├── DeviceManager.ts       # デバイス管理
│   │   └── CommandProcessor.ts    # コマンド処理
│   ├── types/
│   │   ├── index.ts               # 型定義
│   │   ├── Commands.ts            # コマンド定義
│   │   └── Responses.ts           # レスポンス定義
│   ├── utils/
│   │   ├── FileTransfer.ts        # ファイル転送
│   │   └── Validators.ts          # バリデーション
│   └── index.ts                   # エクスポート
├── dist/                          # ビルド出力
├── types/                         # TypeScript型定義
├── examples/                      # 使用例
├── tests/                         # テストスイート
├── package.json
├── tsconfig.json
└── README.md
```

### 公開API設計

#### 1. メインクラス: M5StackClient

```typescript
export class M5StackClient {
  constructor(options?: ClientOptions);
  
  // 接続管理
  async connect(port: string): Promise<Connection>;
  async disconnect(port: string): Promise<void>;
  async listPorts(): Promise<PortInfo[]>;
  getConnection(port: string): Connection | null;
  
  // 設定
  setLogLevel(level: LogLevel): void;
  setTimeout(timeout: number): void;
}

export interface ClientOptions {
  timeout?: number;           // デフォルト: 5000ms
  logLevel?: LogLevel;        // デフォルト: 'info'
  autoReconnect?: boolean;    // デフォルト: false
  maxRetries?: number;        // デフォルト: 3
}
```

#### 2. 接続クラス: Connection

```typescript
export class Connection extends EventEmitter {
  readonly port: string;
  readonly isConnected: boolean;
  readonly isBusy: boolean;
  
  // ファイルシステム操作
  async listDirectory(path: string): Promise<DirectoryEntry[]>;
  async readFile(path: string): Promise<Buffer>;
  async writeFile(path: string, content: Buffer | string, options?: WriteOptions): Promise<void>;
  async deleteFile(path: string): Promise<void>;
  
  // コード実行
  async executeCode(code: string): Promise<ExecutionResult>;
  async executeFile(path: string): Promise<ExecutionResult>;
  
  // デバイス情報
  async getDeviceInfo(): Promise<DeviceInfo>;
  async isOnline(): Promise<boolean>;
  
  // WiFi設定
  async setWifiConfig(ssid: string, password: string): Promise<void>;
  
  // 低レベルアクセス
  async sendCommand(command: Command): Promise<CommandResponse>;
  
  // イベント
  on(event: 'data', listener: (data: Buffer) => void): this;
  on(event: 'error', listener: (error: Error) => void): this;
  on(event: 'disconnect', listener: () => void): this;
  on(event: 'busy', listener: (busy: boolean) => void): this;
}
```

#### 3. 型定義

```typescript
export interface PortInfo {
  path: string;
  manufacturer?: string;
  serialNumber?: string;
  vendorId?: string;
  productId?: string;
}

export interface DirectoryEntry {
  name: string;
  type: 'file' | 'directory';
  size?: number;
  lastModified?: Date;
}

export interface WriteOptions {
  overwrite?: boolean;        // デフォルト: true
  createDirectories?: boolean; // デフォルト: false
  encoding?: 'utf8' | 'binary'; // デフォルト: 'utf8'
}

export interface ExecutionResult {
  output: string;
  error?: string;
  exitCode: number;
  executionTime: number;
}

export interface DeviceInfo {
  platform: string;
  version: string;
  chipId: string;
  flashSize: number;
  ramSize: number;
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
}

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';
```

### 使用例

#### 基本的な使用方法

```typescript
import { M5StackClient } from '@m5stack/serial-client';

const client = new M5StackClient({
  timeout: 10000,
  logLevel: 'info'
});

// ポート一覧取得
const ports = await client.listPorts();
console.log('Available ports:', ports);

// 接続
const connection = await client.connect('/dev/ttyUSB0');

// ファイル一覧取得
const files = await connection.listDirectory('/flash');
console.log('Files:', files);

// Pythonコード実行
const result = await connection.executeCode('print("Hello, M5Stack!")');
console.log('Output:', result.output);

// ファイルアップロード
await connection.writeFile('/flash/main.py', 'import time\nprint("Hello!")');

// 切断
await client.disconnect('/dev/ttyUSB0');
```

#### 高度な使用例

```typescript
// イベント監視
connection.on('data', (data) => {
  console.log('Raw data received:', data);
});

connection.on('error', (error) => {
  console.error('Connection error:', error);
});

// 大容量ファイル転送（プログレス付き）
const fileContent = fs.readFileSync('large_file.py');
await connection.writeFile('/flash/large_file.py', fileContent, {
  onProgress: (bytesWritten, totalBytes) => {
    console.log(`Progress: ${(bytesWritten / totalBytes * 100).toFixed(1)}%`);
  }
});

// バッチ操作
const operations = [
  () => connection.writeFile('/flash/config.json', JSON.stringify(config)),
  () => connection.writeFile('/flash/main.py', mainCode),
  () => connection.executeCode('import main'),
];

for (const operation of operations) {
  await operation();
}
```

### プラットフォーム対応

#### Node.js環境

```typescript
// package.json
{
  "name": "@m5stack/serial-client",
  "main": "dist/node/index.js",
  "types": "dist/types/index.d.ts",
  "dependencies": {
    "serialport": "^13.0.0"
  }
}
```

#### ブラウザ環境（Web Serial API）

```typescript
// package.json
{
  "browser": "dist/browser/index.js",
  "dependencies": {
    // serialportは含まない
  }
}

// WebSerial実装
export class WebSerialConnection implements ISerialConnection {
  async connect(port: SerialPort): Promise<void> {
    // Web Serial API使用
  }
}
```

#### React Native環境

```typescript
// package.json
{
  "react-native": "dist/react-native/index.js",
  "dependencies": {
    "react-native-serial": "^1.0.0"
  }
}
```

## VS Code拡張の移行設計

### 現在の実装からの移行

#### 1. 段階的移行アプローチ

```typescript
// Phase 1: ラッパー実装
import { M5StackClient } from '@m5stack/serial-client';

// 既存のSerialManagerを@m5stack/serial-clientでラップ
class SerialManagerAdapter {
  private client: M5StackClient;
  
  constructor() {
    this.client = new M5StackClient();
  }
  
  // 既存APIを維持しつつ、内部で新しいライブラリを使用
  async connect(com: string, openedCb: (err: unknown) => void) {
    try {
      await this.client.connect(com);
      openedCb(null);
    } catch (error) {
      openedCb(error);
    }
  }
  
  // 既存メソッドを順次移行
}
```

#### 2. VS Code固有機能の分離

```typescript
// src/vscode/
├── FileSystemProvider.ts     # vscode.FileSystemProvider実装
├── TreeDataProvider.ts       # vscode.TreeDataProvider実装
├── Commands.ts              # VS Codeコマンド実装
├── StatusBar.ts             # ステータスバー管理
└── Settings.ts              # 設定管理

// src/core/ → @m5stack/serial-clientに移行
├── SerialConnection.ts      # ライブラリに統合
├── SerialManager.ts         # ライブラリに統合
├── Crc.ts                  # ライブラリに統合
└── types.ts                # ライブラリに統合
```

#### 3. 依存関係の更新

```json
{
  "dependencies": {
    "@m5stack/serial-client": "^1.0.0"
  },
  "devDependencies": {
    "@types/vscode": "^1.48.0"
  }
}
```

### 互換性の維持

```typescript
// 既存のAPIを維持するためのアダプターパターン
export class LegacySerialManager {
  private client: M5StackClient;
  private connections: Map<string, Connection>;
  
  // 既存のメソッドシグネチャを維持
  exec(com: string, code: string): Promise<Buffer> {
    const connection = this.connections.get(com);
    return connection.executeCode(code).then(result => Buffer.from(result.output));
  }
  
  listDir(com: string, dirname: string): Promise<Buffer> {
    const connection = this.connections.get(com);
    return connection.listDirectory(dirname)
      .then(entries => Buffer.from(entries.map(e => e.name).join(',')));
  }
}
```

## 他プラットフォームでの活用例

### 1. CLI ツール

```typescript
// m5stack-cli
import { M5StackClient } from '@m5stack/serial-client';
import { Command } from 'commander';

const program = new Command();
const client = new M5StackClient();

program
  .command('upload <file> [device]')
  .description('Upload file to M5Stack device')
  .action(async (file, device) => {
    const ports = await client.listPorts();
    const targetPort = device || ports[0]?.path;
    
    const connection = await client.connect(targetPort);
    const content = fs.readFileSync(file);
    await connection.writeFile(`/flash/${path.basename(file)}`, content);
    
    console.log(`Uploaded ${file} to ${targetPort}`);
  });
```

### 2. Web アプリケーション

```typescript
// React Web App
import { M5StackClient } from '@m5stack/serial-client/browser';

function M5StackIDE() {
  const [client] = useState(() => new M5StackClient());
  const [connection, setConnection] = useState<Connection | null>(null);
  
  const handleConnect = async () => {
    // Web Serial APIを使用
    const port = await navigator.serial.requestPort();
    const conn = await client.connect(port);
    setConnection(conn);
  };
  
  const handleRunCode = async (code: string) => {
    if (connection) {
      const result = await connection.executeCode(code);
      console.log(result.output);
    }
  };
  
  return (
    <div>
      <button onClick={handleConnect}>Connect to M5Stack</button>
      <CodeEditor onRun={handleRunCode} />
    </div>
  );
}
```

### 3. Electron アプリケーション

```typescript
// Electron Main Process
import { M5StackClient } from '@m5stack/serial-client';
import { ipcMain } from 'electron';

const client = new M5StackClient();

ipcMain.handle('m5stack:connect', async (event, port) => {
  return await client.connect(port);
});

ipcMain.handle('m5stack:execute', async (event, port, code) => {
  const connection = client.getConnection(port);
  return await connection?.executeCode(code);
});
```

### 4. React Native アプリ

```typescript
// React Native App
import { M5StackClient } from '@m5stack/serial-client/react-native';

export function M5StackController() {
  const client = new M5StackClient();
  
  const connectToDevice = async () => {
    // Bluetooth or USB connection
    const connection = await client.connect('bluetooth:device-id');
    
    const result = await connection.executeCode('print("Hello from mobile!")');
    Alert.alert('Result', result.output);
  };
  
  return (
    <View>
      <Button title="Connect" onPress={connectToDevice} />
    </View>
  );
}
```

## 配布とメンテナンス

### パッケージ公開

```json
{
  "name": "@m5stack/serial-client",
  "version": "1.0.0",
  "description": "Universal M5Stack serial communication library",
  "main": "dist/node/index.js",
  "browser": "dist/browser/index.js",
  "react-native": "dist/react-native/index.js",
  "types": "dist/types/index.d.ts",
  "files": [
    "dist/",
    "types/",
    "README.md"
  ],
  "exports": {
    ".": {
      "node": "./dist/node/index.js",
      "browser": "./dist/browser/index.js",
      "react-native": "./dist/react-native/index.js",
      "types": "./dist/types/index.d.ts"
    }
  },
  "engines": {
    "node": ">=14.0.0"
  },
  "peerDependencies": {
    "serialport": "^13.0.0"
  },
  "peerDependenciesMeta": {
    "serialport": {
      "optional": true
    }
  }
}
```

### バージョニング戦略

- **Semantic Versioning (SemVer)** 採用
- **Major**: 破壊的変更
- **Minor**: 新機能追加
- **Patch**: バグフィックス

### 継続的統合

```yaml
# .github/workflows/ci.yml
name: CI
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        node-version: [14, 16, 18, 20]
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: ${{ matrix.node-version }}
      - run: npm ci
      - run: npm run build
      - run: npm test
      - run: npm run test:browser
      - run: npm run test:integration
```

## 移行ロードマップ

### Phase 1: ライブラリ基盤構築 (1-2ヶ月)
- [ ] Core通信レイヤーの抽出
- [ ] TypeScript型定義の整備
- [ ] 基本的なテストスイート作成
- [ ] Node.js環境での動作確認

### Phase 2: API安定化 (1ヶ月)
- [ ] 公開APIの最終設計
- [ ] ドキュメント整備
- [ ] 包括的なテスト追加
- [ ] パフォーマンス最適化

### Phase 3: マルチプラットフォーム対応 (1-2ヶ月)
- [ ] Web Serial API実装
- [ ] React Native対応
- [ ] ブラウザ環境でのテスト
- [ ] 各プラットフォーム向けサンプル作成

### Phase 4: VS Code拡張の移行 (2週間)
- [ ] VS Code拡張でのライブラリ統合
- [ ] 既存機能の動作確認
- [ ] レグレッションテスト
- [ ] リリース準備

### Phase 5: エコシステム拡張 (継続的)
- [ ] CLI ツール開発
- [ ] Webアプリケーション例
- [ ] コミュニティ貢献の受け入れ
- [ ] 追加機能の開発

この設計により、M5Stackシリアル通信ライブラリを独立したパッケージとして分離し、様々なプラットフォームで再利用可能な形で提供できます。