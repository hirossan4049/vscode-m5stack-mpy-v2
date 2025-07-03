# M5Stack シリアル通信ドキュメント

## 概要

このドキュメントでは、vscode-m5stack-mpy拡張機能におけるM5Stackデバイスとのシリアル通信の詳細な挙動について説明します。

## アーキテクチャ概要

```
VS Code Extension
       ↓
  SerialManager (シングルトン)
       ↓
SerialConnection (デバイス毎)
       ↓
   serialport (N-API)
       ↓
  M5Stack Device
```

## 主要コンポーネント

### 1. SerialConnection クラス

**ファイル**: `src/serial/SerialConnection.ts`

M5Stackデバイスとの低レベルシリアル通信を管理するクラス。

#### 主要プロパティ

```typescript
private com: string;                    // COMポート名 (例: "COM3", "/dev/ttyUSB0")
public port: SerialPort;               // serialportインスタンス
private isBusy: boolean;               // 通信中フラグ
public resolve: (value: Buffer) => void;  // Promise解決関数
public reject: (value: any) => void;      // Promise拒否関数
private received: Buffer;              // 受信バッファ
```

#### シリアルポート設定

```typescript
const defaultOpts = {
  baudRate: 115200  // M5Stack標準ボーレート
};
```

#### 主要メソッド

##### `static getCOMs(): Promise<PortInfo[]>`
利用可能なシリアルポートを列挙します。

```typescript
// 使用例
const ports = await SerialConnection.getCOMs();
// 返り値: [{ path: "/dev/ttyUSB0", manufacturer: "...", ... }]
```

##### `sendCommand(code: number, data: string): Promise<Buffer>`
M5Stackにコマンドを送信し、レスポンスを受信します。

```typescript
// 内部処理フロー:
// 1. data文字列をBufferに変換
// 2. Crc.createDataBuffer()でコマンドバッファ作成
// 3. sendCommandWithBuffer()を呼び出し
```

##### `sendCommandWithBuffer(buffer: Buffer): Promise<Buffer>`
バイナリデータを直接送信する低レベルメソッド。

```typescript
// 処理フロー:
// 1. 受信バッファをリセット
// 2. CRCチェックサムを付加 (Crc.coverCrc)
// 3. write()でデータ送信
// 4. Promise経由で非同期応答
```

##### `write(data: Buffer): void`
シリアルポートへの実際の書き込み処理。

```typescript
// 重要な動作:
// 1. isBusy = true に設定
// 2. port.write() でデータ送信
// 3. port.drain() で送信完了を待機
// 4. エラー時は reject() を呼び出し
```

##### `onData(chunk: Buffer): void`
シリアルポートからのデータ受信ハンドラ。

```typescript
// 受信プロトコル:
// 1. チャンクを受信バッファに連結
// 2. Crc.checkReceiveCompleted() で完了チェック
// 3. レスポンスコード確認 (received[4] === 0x00)
// 4. データ部分抽出 (received.slice(5, -5))
// 5. resolve() でデータ返却
```

### 2. SerialManager クラス

**ファイル**: `src/serial/SerialManager.ts`

複数のM5Stackデバイスとの接続を管理するシングルトンクラス。

#### 接続管理

```typescript
private m5: Connections = {};  // COMポート名をキーとした接続辞書

connect(com: string, openedCb: (err: unknown) => void) {
  this.m5[com] = new SerialConnection(com, openedCb);
}
```

#### 高レベルAPI

##### `exec(com: string, code: string): Promise<Buffer>`
Pythonコードをデバイス上で実行します。

```typescript
// コマンドコード: COMMAND_CODES.exec (0x02)
// 用途: ファイル実行、REPL操作
return this.m5[com].sendCommand(COMMAND_CODES.exec, code);
```

##### `listDir(com: string, dirname: string): Promise<Buffer>`
ディレクトリ内容を取得します。

```typescript
// コマンドコード: COMMAND_CODES.listDir (0x03)
// 戻り値: カンマ区切りのファイル/フォルダ名
return this.m5[com].sendCommand(COMMAND_CODES.listDir, dirname);
```

##### `readFile(com: string, filename: string): Promise<Buffer>`
デバイス上のファイル内容を読み取ります。

```typescript
// コマンドコード: COMMAND_CODES.getFile (0x05)
return this.m5[com].sendCommand(COMMAND_CODES.getFile, filename);
```

##### `download(com: string, filename: string, content: string | Buffer, flag: number, isBinary?: boolean): Promise<Buffer>`
ファイルをデバイスにアップロードします。

```typescript
// フラグ:
// 0x00: 追記モード (append)
// 0x01: 上書きモード (overwrite)

// バイナリプロトコル:
// [COMMAND_CODE][filename][0x00][flag][data]
```

##### `bulkDownload()` - 大容量ファイル対応
256バイトを超えるファイルを複数のチャンクに分割してアップロードします。

```typescript
const MAX_CHUNK_LENGTH = 256; // 最大チャンクサイズ

// 分割アルゴリズム:
// 1. ファイルサイズが256バイト以下: 通常のdownload()
// 2. 超過時: 256バイト単位で分割
// 3. 最初のチャンク: overwrite (0x01)
// 4. 残りのチャンク: append (0x00)
```

### 3. CRC通信プロトコル

**ファイル**: `src/serial/Crc.ts`

M5Stackとの通信で使用される独自プロトコル。

#### データフレーム構造

```
[HEADER: 3bytes] [PAYLOAD] [CRC: 2bytes] [FOOTER: 3bytes]
    AA AB AA      Data       CRC16      AB CC AB
```

#### ヘッダー・フッター

```typescript
export const HEAD_DATA = [0xaa, 0xab, 0xaa];  // フレーム開始
export const FOOT_DATA = [0xab, 0xcc, 0xab];  // フレーム終了
```

#### CRC16計算

```typescript
// 4ビットルックアップテーブル方式
const CRC_TABLE = [
  0x0000, 0xcc01, 0xd801, 0x1400, 0xf001, 0x3c00, 0x2800, 0xe401,
  0xa001, 0x6c00, 0x7800, 0xb401, 0x5000, 0x9c01, 0x8801, 0x4400,
];

// 初期値: 0xFFFF
// 多項式: 業界標準CRC16
```

#### レスポンス検証

```typescript
// 完了チェック:
// 1. ヘッダー確認: buffer.slice(0, 3) === HEAD_DATA
// 2. フッター確認: buffer.slice(-3) === FOOT_DATA
// 3. ステータス確認: buffer[4] === 0x00 (成功)
// 4. データ抽出: buffer.slice(5, -5)
```

## コマンドコード仕様

**ファイル**: `src/serial/types.ts`

```typescript
export const COMMAND_CODES = {
  isOnline: 0x00,      // デバイス生存確認
  getInfo: 0x01,       // デバイス情報取得
  exec: 0x02,          // コード実行
  listDir: 0x03,       // ディレクトリ一覧
  download: 0x04,      // [未使用]
  getFile: 0x05,       // ファイル読み取り
  downloadFile: 0x06,  // ファイル書き込み
  removeFile: 0x07,    // ファイル削除
  setWifi: 0x08,       // WiFi設定
};
```

## 通信フロー詳細

### 1. 接続確立

```typescript
// 1. SerialManager.connect()
// 2. new SerialConnection(com, callback)
// 3. new SerialPort({ path: com, baudRate: 115200 })
// 4. イベントハンドラ登録:
//    - 'error': onError
//    - 'open': onOpen  
//    - 'data': onData
```

### 2. コマンド送信

```typescript
// 例: listDir("/flash")
// 1. SerialManager.listDir(com, "/flash")
// 2. SerialConnection.sendCommand(0x03, "/flash")
// 3. Crc.createDataBuffer(0x03, "/flash")
//    → [0x03, 0x2f, 0x66, 0x6c, 0x61, 0x73, 0x68]
// 4. Crc.coverCrc() でCRC付加
// 5. SerialPort.write()
```

### 3. レスポンス受信

```typescript
// M5Stackからの応答:
// [AA AB AA] [len] [status] [data...] [crc] [AB CC AB]
//
// 例: ディレクトリ一覧レスポンス
// AA AB AA 10 00 "boot.py,main.py" [crc] AB CC AB
//
// パース処理:
// 1. onData()でチャンク受信
// 2. Buffer連結
// 3. checkReceiveCompleted()で完了判定
// 4. status確認 (buffer[4] === 0x00)
// 5. データ部分抽出 (buffer.slice(5, -5))
```

### 4. エラーハンドリング

```typescript
// 通信エラーパターン:
// 1. シリアルポートエラー → onError()
// 2. CRC不正 → reject("Communication error")
// 3. ステータスエラー → reject("Communication error")
// 4. タイムアウト → [現在未実装]
// 5. 書き込みエラー → reject("write error")
// 6. ドレインエラー → reject("drain error")
```

## 重要な制限事項と注意点

### 1. 同期制御

```typescript
// SerialConnectionは1度に1つのコマンドのみ処理可能
private isBusy: boolean = false;

// 呼び出し前に必ずチェックが必要
if (SerialManager.isBusy(com)) {
  // 処理を待機またはエラー
}
```

### 2. ファイルサイズ制限

```typescript
// 単一チャンクの最大サイズ
const MAX_CHUNK_LENGTH = 256; // bytes

// 大容量ファイルは自動的に分割される
// 但し、非常に大きなファイル（数MB）は時間がかかる
```

### 3. 文字エンコーディング

```typescript
// JavaScript文字列 → UTF-8バイト列に変換
Buffer.from(data); // UTF-8エンコーディング

// M5Stack側ではUTF-8として解釈される
// 日本語ファイル名、コンテンツに対応
```

### 4. 接続安定性

```typescript
// 接続失敗時の自動再試行は未実装
// ユーザーが手動で再接続する必要がある

// デバイスリセット時はconnectionが切断される
// 再度SerialManager.connect()が必要
```

## デバッグ方法

### 1. コンソールログ

```typescript
// 送信データのログ出力
console.log('sending bytes', buffer);

// 接続状況の確認
console.log(`opened connection on ${this.com}`);
```

### 2. バイナリデータ確認

```javascript
// ブラウザ開発者ツールで確認可能
// 送信: Uint8Array形式で表示
// 受信: Buffer.toString('hex')でダンプ可能
```

### 3. 通信プロトコル解析

```typescript
// フレーム構造の確認
const header = received.slice(0, 3);     // [AA, AB, AA]
const status = received[4];              // 0x00=成功, その他=エラー
const data = received.slice(5, -5);      // 実際のデータ
const footer = received.slice(-3);       // [AB, CC, AB]
```

## パフォーマンス考慮事項

### 1. チャンク化による高速化

```typescript
// 大容量ファイルの場合、256バイト単位で分割送信
// ネットワーク効率とメモリ使用量のバランス
```

### 2. 非同期処理

```typescript
// すべてのシリアル通信はPromiseベース
// UIブロッキングを避けるための設計
```

### 3. メモリ管理

```typescript
// 受信バッファは通信毎にリセット
this.received = Buffer.from([]);

// 大容量データは即座に処理し、メモリ保持を最小化
```

## .pyファイル書き込みフロー詳細

### 1. ファイル保存時の自動書き込み (Ctrl+S)

```typescript
// src/ui/PortList.ts:35-45
vscode.workspace.onWillSaveTextDocument(async (e) => {
  if (e.document.isDirty && e.document.uri.scheme === 'm5stackfs') {
    const result = await M5FileSystemProvider.saveFile(e.document.uri, e.document.getText());
    if (!result) {
      vscode.window.showErrorMessage(`Saved ${e.document.uri} failed.`);
    }
  }
});
```

**フロー**:
1. **トリガー**: ユーザーがCtrl+S押下
2. **条件チェック**: `e.document.isDirty` && `uri.scheme === 'm5stackfs'`
3. **URI解析**: `m5stackfs:/{COM_PORT}{DEVICE_PATH}` → ポートとファイルパス抽出
4. **書き込み実行**: `M5FileSystemProvider.saveFile()`
5. **結果通知**: 成功/失敗をユーザーに表示

### 2. ファイルアップロード機能

```typescript
// src/ui/PortList.ts:216-265 (upload method)
async upload(ev: any) {
  // 1. ファイル選択ダイアログ
  let file = await vscode.window.showOpenDialog({});
  
  // 2. ファイル名長さ制限チェック (最大28文字)
  if (filename.length > 28) {
    vscode.window.showErrorMessage(`File name is too long (max 28 characters).`);
  }
  
  // 3. ローカルファイル読み込み
  const content = fs.readFileSync(file[0].path);
  
  // 4. プログレス付き分割アップロード
  await SerialManager.bulkDownload(port, filepath, content, false, progressCallback);
}
```

**フロー**:
1. **ファイル選択**: `vscode.window.showOpenDialog()`
2. **バリデーション**: ファイル名28文字制限
3. **ファイル読み込み**: `fs.readFileSync()`でローカルファイル読み取り
4. **分割アップロード**: `bulkDownload()`で256バイト単位に分割
5. **プログレス表示**: VS Code通知領域でプログレス表示

### 3. 低レベル書き込み処理 (M5FileSystemProvider)

```typescript
// src/providers/M5FileSystemProvider.ts:60-92
async saveFile(uri: vscode.Uri, text: string): Promise<number> {
  // 1. メモリキャッシュ更新
  this.files[uri.path] = Buffer.from(text);
  
  // 2. URI解析 (ポート・ファイルパス抽出)
  const { port, filepath } = getSerialPortAndFileFromUri(uri, this.platform);
  
  // 3. チャンク数計算
  const numChunks = Math.ceil(text.length / MAX_CHUNK_LENGTH); // 256バイト
  
  // 4. プログレス付き分割転送
  let r = await SerialManager.bulkDownload(port, filepath, text, false, progressCallback);
  
  return r.toString().indexOf('done') >= 0 ? 1 : 0;
}
```

### 4. 分割転送の詳細実装 (SerialManager.bulkDownload)

```typescript
// src/serial/SerialManager.ts:56-97
async bulkDownload(com: string, filename: string, content: string | Buffer, 
                   isBinary: boolean, progressCb: (chunkIndex: number) => void): Promise<Buffer> {
  
  let dataChunks = [];
  
  // 1. 256バイト超過時の分割処理
  if (content.length > MAX_CHUNK_LENGTH) {
    let part = Math.ceil(content.length / MAX_CHUNK_LENGTH);
    for (let i = 0; i < part; i++) {
      dataChunks[i] = content.slice(i * MAX_CHUNK_LENGTH, MAX_CHUNK_LENGTH * (i + 1));
    }
  }
  
  // 2. 分割なしの場合
  if (!dataChunks.length) {
    return this.download(com, filename, content, 0x01); // overwrite
  } 
  
  // 3. 分割送信ループ
  for (let i = 0; i < dataChunks.length; i++) {
    if (i === 0) {
      // 最初のチャンク: 上書きモード
      const result = await this.download(com, filename, dataChunks[i], 0x01, isBinary);
      progressCb(i + 1);
      if (result.toString().indexOf('done') < 0) {
        return Promise.reject(Buffer.from(`An error occurred while saving ${filename}: ${result.toString()}`));
      }
      continue;
    }
    
    // 2番目以降: 追記モード
    const result = await this.download(com, filename, dataChunks[i], 0x00, isBinary);
    if (result.toString().indexOf('done') < 0) {
      return Promise.reject(Buffer.from(`An error occurred while saving ${filename}: ${result.toString()}`));
    }
    progressCb(i + 1);
  }
  
  return Promise.resolve(Buffer.from('done'));
}
```

### 5. 単一チャンク転送 (SerialManager.download)

```typescript
// src/serial/SerialManager.ts:38-54
download(com: string, filename: string, content: string | Buffer, 
         flag: number, isBinary?: boolean): Promise<Buffer> {
  
  // 1. データ形式統一
  const data = isBinary ? (content as Buffer) : Buffer.from(content);
  
  // 2. コマンドバッファ構築
  const buffer = Buffer.concat([
    Buffer.from([COMMAND_CODES.downloadFile]), // 0x06
    Buffer.from(filename),                     // ファイル名
    Buffer.from([0x00]),                      // NULL終端
    Buffer.from([flag]),                      // 0x01=上書き, 0x00=追記
    data,                                     // ファイル内容
  ]);
  
  // 3. 低レベル送信
  return this.m5[com].sendCommandWithBuffer(buffer);
}
```

### 6. 実際の通信フレーム構造

```
.pyファイル書き込み時の通信フレーム:

送信フレーム:
[AA AB AA] [データ長] [0x06] [ファイル名] [0x00] [フラグ] [Pythonコード] [CRC16] [AB CC AB]

例: main.pyに"print('hello')"を書き込む場合
AA AB AA 18 06 6D 61 69 6E 2E 70 79 00 01 70 72 69 6E 74 28 27 68 65 6C 6C 6F 27 29 [CRC] AB CC AB
         ↑  ↑  ←-- main.py --→  ↑  ↑  ←---- print('hello') ----→
      データ長 コマンド           終端 上書き

受信フレーム（成功時）:
[AA AB AA] [04] [00] [done] [CRC16] [AB CC AB]
                ↑    ↑
            ステータス レスポンス
```

### 7. エラーハンドリングと再送制御

```typescript
// エラーパターンと対処:

1. **CRC エラー**
   - 症状: "Communication error, sorry."
   - 対処: 自動再送（現在未実装）

2. **ファイル名長すぎエラー**
   - 症状: ファイル名28文字超過
   - 対処: upload()で事前チェック

3. **デバイスビジーエラー**
   - 症状: 他の操作実行中
   - 対処: isBusy()チェックで回避

4. **分割転送失敗**
   - 症状: チャンク途中で"done"以外のレスポンス
   - 対処: bulkDownload()でPromise.reject()
```

### 8. パフォーマンス最適化

```typescript
// 最適化ポイント:

1. **チャンクサイズ**: 256バイト
   - メモリ効率とレスポンス性のバランス
   - M5Stackのバッファサイズに最適化

2. **プログレス更新**: チャンク単位
   - UI応答性を維持
   - ユーザーエクスペリエンス向上

3. **メモリキャッシュ**: M5FileSystemProvider.files
   - 同一ファイルの再読み込み回避
   - レスポンス速度向上

4. **非同期処理**: Promise/async-await
   - UIブロッキング回避
   - 複数ファイル同時処理（制限あり）
```

### 9. デバッグ方法

```typescript
// デバッグ用ログ出力箇所:

1. **送信データ確認**:
   SerialConnection.sendCommandWithBuffer(): console.log('sending bytes', buffer);

2. **ファイル内容確認**:
   PortList.run(): console.log('executing following code', text);

3. **エラー詳細**:
   catch ブロック: console.log('Error while saving', e.toString());

4. **プロトコル解析**:
   // buffer.toString('hex')でバイナリダンプ可能
   // received.slice(5, -5)でデータ部分抽出
```

この詳細なフロー解析により、.pyファイルがどのようにM5Stackデバイスに書き込まれるかの全体像を把握できます。

## 複数ファイルにまたがる場合の動作と制限事項

### 現在の実装での制限

現在のvscode-m5stack-mpy拡張機能は**単一ファイル実行モデル**を採用しており、複数ファイルにまたがるPythonプロジェクトには**重大な制限**があります。

#### 1. Run コマンドの動作

```typescript
// src/ui/PortList.ts:267-281
async run() {
  if (vscode.window.activeTextEditor) {
    const document = vscode.window.activeTextEditor.document;
    const text = trimComments(document.getText());  // 現在のファイルのみ
    const r = await SerialManager.exec(port, text);
  }
}
```

**動作**: 現在アクティブなファイルの**テキスト内容のみ**をM5Stackに送信します。

**制限事項**:
- `import`文の解析なし
- 依存関係の自動検出なし  
- 必要なモジュールの自動アップロードなし
- 相対インポートの未対応

#### 2. 実際の問題例

```python
# main.py (実行したいファイル)
import config
import utils.helper
from sensors import temperature

config.setup()
temp = temperature.read_sensor()
utils.helper.log(f"Temperature: {temp}")
```

**現在の動作**:
1. `main.py`のテキストのみがM5Stackに送信される
2. M5Stack上で`import config`が実行される
3. `config.py`がデバイス上に存在しない場合 → **ImportError**
4. 実行失敗

#### 3. 手動での対処方法

```
必要な手順:
1. config.py を手動でアップロード
2. utils/helper.py を手動でアップロード  
3. sensors.py を手動でアップロード
4. main.py を実行
```

**問題点**:
- 煩雑な手動作業
- 依存関係の把握が困難
- ファイル更新時の同期忘れ
- 開発効率の低下

### 技術的分析

#### 1. インポート文解析の不在

```typescript
// 現在: コメント除去のみ
export const trimComments = (codeAsText: string): string => {
  const reg = /#[^\n\r]+?(?:\*\)|[\n\r])/gm;
  return codeAsText.replace(reg, '\n').trim();
};

// 必要: インポート文解析 (未実装)
function parseImports(code: string): ImportStatement[] {
  // import文の解析ロジックが必要
}
```

#### 2. 依存関係解決の不在

```typescript
// 現在: 単一ファイル送信
SerialManager.exec(port, singleFileContent);

// 必要: 依存関係解決 (未実装)  
async function executeWithDependencies(port: string, mainFile: string) {
  const dependencies = await resolveDependencies(mainFile);
  for (const dep of dependencies) {
    await uploadIfMissing(port, dep);
  }
  await SerialManager.exec(port, mainFile);
}
```

#### 3. ファイル存在確認の不在

```typescript
// 必要だが未実装の機能
async function checkFileExists(port: string, filename: string): Promise<boolean> {
  try {
    await SerialManager.readFile(port, filename);
    return true;
  } catch {
    return false;
  }
}
```

### 将来の拡張案

#### 1. インポート文解析機能

```typescript
interface ImportStatement {
  type: 'import' | 'from_import';
  module: string;
  items?: string[];
  isRelative: boolean;
  line: number;
}

function parseImports(code: string): ImportStatement[] {
  const imports: ImportStatement[] = [];
  const lines = code.split('\n');
  
  lines.forEach((line, index) => {
    // import module_name
    const importMatch = line.match(/^import\s+([a-zA-Z_][a-zA-Z0-9_.]*)/);
    if (importMatch) {
      imports.push({
        type: 'import',
        module: importMatch[1],
        isRelative: false,
        line: index + 1
      });
    }
    
    // from module import item
    const fromMatch = line.match(/^from\s+(\.*)([a-zA-Z_][a-zA-Z0-9_.]*)\s+import\s+(.+)/);
    if (fromMatch) {
      imports.push({
        type: 'from_import',
        module: fromMatch[2],
        items: fromMatch[3].split(',').map(s => s.trim()),
        isRelative: fromMatch[1].length > 0,
        line: index + 1
      });
    }
  });
  
  return imports;
}
```

#### 2. 依存関係グラフ構築

```typescript
interface DependencyGraph {
  [filename: string]: {
    dependencies: string[];
    dependents: string[];
    exists: boolean;
  };
}

async function buildDependencyGraph(port: string, entryFile: string): Promise<DependencyGraph> {
  const graph: DependencyGraph = {};
  const visited = new Set<string>();
  
  async function analyzeDependencies(filename: string) {
    if (visited.has(filename)) return;
    visited.add(filename);
    
    const content = await SerialManager.readFile(port, filename);
    const imports = parseImports(content.toString());
    
    graph[filename] = {
      dependencies: imports.map(imp => `${imp.module}.py`),
      dependents: [],
      exists: true
    };
    
    // 再帰的に依存関係を解析
    for (const imp of imports) {
      const depFile = `${imp.module}.py`;
      await analyzeDependencies(depFile);
      graph[depFile].dependents.push(filename);
    }
  }
  
  await analyzeDependencies(entryFile);
  return graph;
}
```

#### 3. スマートな実行機能

```typescript
async function smartRun(port: string, activeFile: string): Promise<void> {
  // 1. 依存関係解析
  const graph = await buildDependencyGraph(port, activeFile);
  
  // 2. 不足ファイルの検出
  const missingFiles = Object.keys(graph).filter(file => !graph[file].exists);
  
  // 3. ユーザーに確認
  if (missingFiles.length > 0) {
    const response = await vscode.window.showWarningMessage(
      `Missing dependencies: ${missingFiles.join(', ')}. Upload them?`,
      'Upload & Run', 'Run Anyway', 'Cancel'
    );
    
    if (response === 'Upload & Run') {
      await uploadMissingFiles(port, missingFiles);
    } else if (response === 'Cancel') {
      return;
    }
  }
  
  // 4. 実行
  const content = await readFileContent(activeFile);
  await SerialManager.exec(port, content);
}
```

#### 4. 自動アップロード機能

```typescript
async function uploadMissingFiles(port: string, files: string[]): Promise<void> {
  await vscode.window.withProgress({
    location: vscode.ProgressLocation.Notification,
    title: 'Uploading dependencies...',
  }, async (progress) => {
    
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      progress.report({ 
        message: `Uploading ${file}`,
        increment: (i / files.length) * 100 
      });
      
      const localPath = path.join(vscode.workspace.rootPath!, file);
      const content = fs.readFileSync(localPath);
      await SerialManager.bulkDownload(port, file, content, false, () => {});
    }
  });
}
```

### 現実的な対処法

#### 1. プロジェクト構造の工夫

```
M5Stack Project/
├── main.py          # エントリーポイント（依存関係最小化）
├── config.py        # 設定ファイル
├── utils/
│   └── helper.py    # ユーティリティ
└── sensors/
    └── temperature.py
```

#### 2. 依存関係の明示的管理

```python
# dependencies.txt (手動管理)
config.py
utils/helper.py  
sensors/temperature.py
```

#### 3. ビルドスクリプトの活用

```bash
#!/bin/bash
# upload_project.sh
FILES="config.py utils/helper.py sensors/temperature.py main.py"
for file in $FILES; do
  # VS Codeの拡張機能APIを使用してアップロード
  echo "Uploading $file"
done
```

### 結論

現在の拡張機能は**単一ファイル実行のみ**に対応しており、複数ファイルプロジェクトでは以下の制限があります：

**制限事項**:
- 自動依存関係解決なし
- インポートされたモジュールの自動アップロードなし  
- 手動でのファイル管理が必要
- 開発効率の低下

**回避策**:
- 手動での依存ファイルアップロード
- プロジェクト構造の工夫
- 外部ビルドスクリプトの活用

将来的には、インポート文解析、依存関係グラフ、自動アップロード機能の実装により、本格的な複数ファイルプロジェクト対応が可能になります。

このドキュメントは、M5Stack MicroPython開発環境における詳細なシリアル通信仕様を包括的に説明しています。実装時やデバッグ時の参考資料として活用してください。