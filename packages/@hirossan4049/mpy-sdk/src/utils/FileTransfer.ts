/**
 * File Transfer Utilities
 * 
 * Handles bulk file transfers with chunking, progress reporting, and error recovery
 */

import {
  CommandCode,
  Command,
  BulkTransferOptions,
  FileTransferProgress,
  DEFAULT_CONFIG,
  CommunicationError
} from '../types';
import { BaseSerialConnection } from '../core/SerialConnection';

export class FileTransferManager {
  private connection: BaseSerialConnection;

  constructor(connection: BaseSerialConnection) {
    this.connection = connection;
  }

  /**
   * Upload file with chunking support
   */
  async uploadFile(
    filename: string,
    content: Buffer,
    overwrite: boolean = true,
    options: BulkTransferOptions = {}
  ): Promise<void> {
    const chunkSize = options.chunkSize || DEFAULT_CONFIG.maxChunkSize;
    const retryAttempts = options.retryAttempts || 3;

    // Single chunk upload
    if (content.length <= chunkSize) {
      await this.uploadSingleChunk(filename, content, overwrite ? 0x01 : 0x00);
      
      if (options.onProgress) {
        const progress: FileTransferProgress = {
          filename,
          bytesTransferred: content.length,
          totalBytes: content.length,
          percentage: 100,
          chunkIndex: 1,
          totalChunks: 1
        };
        options.onProgress(progress);
      }
      
      return;
    }

    // Multi-chunk upload
    const totalChunks = Math.ceil(content.length / chunkSize);
    let uploadedBytes = 0;

    for (let i = 0; i < totalChunks; i++) {
      const start = i * chunkSize;
      const end = Math.min(start + chunkSize, content.length);
      const chunk = content.slice(start, end);
      const isFirstChunk = i === 0;
      const flag = isFirstChunk ? 0x01 : 0x00; // overwrite on first, append on subsequent

      let success = false;
      let lastError: Error;

      // Retry logic for each chunk
      for (let attempt = 0; attempt <= retryAttempts; attempt++) {
        try {
          await this.uploadSingleChunk(filename, chunk, flag);
          success = true;
          break;
        } catch (error) {
          lastError = error as Error;
          
          if (attempt < retryAttempts) {
            // Wait before retry with exponential backoff
            await this.delay(100 * Math.pow(2, attempt));
          }
        }
      }

      if (!success) {
        throw new CommunicationError(
          `Failed to upload chunk ${i + 1}/${totalChunks} for ${filename}: ${lastError!.message}`
        );
      }

      uploadedBytes += chunk.length;

      // Report progress
      if (options.onProgress) {
        const progress: FileTransferProgress = {
          filename,
          bytesTransferred: uploadedBytes,
          totalBytes: content.length,
          percentage: (uploadedBytes / content.length) * 100,
          chunkIndex: i + 1,
          totalChunks
        };
        options.onProgress(progress);
      }

      // Report chunk completion
      if (options.onChunkComplete) {
        options.onChunkComplete(i + 1, totalChunks);
      }
    }
  }

  /**
   * Upload single chunk
   */
  private async uploadSingleChunk(filename: string, content: Buffer, flag: number): Promise<void> {
    // Create command buffer: [COMMAND][filename][NULL][flag][data]
    const commandBuffer = Buffer.concat([
      Buffer.from([CommandCode.DOWNLOAD_FILE]),
      Buffer.from(filename, 'utf8'),
      Buffer.from([0x00]), // NULL terminator
      Buffer.from([flag]),
      content
    ]);

    const command: Command = {
      code: CommandCode.DOWNLOAD_FILE,
      data: commandBuffer.slice(1), // Remove the command code as it's added by the protocol handler
      timeout: 10000 // Extended timeout for file operations
    };

    const response = await this.connection.sendCommandWithRetry(command, 2);
    
    if (!response.data.toString().includes('done')) {
      throw new CommunicationError(`Upload failed: ${response.data.toString()}`);
    }
  }

  /**
   * Download file with chunking support (if device supports it)
   */
  async downloadFile(filename: string): Promise<Buffer> {
    const command: Command = {
      code: CommandCode.GET_FILE,
      data: filename
    };

    const response = await this.connection.sendCommand(command);
    return response.data;
  }

  /**
   * Upload multiple files sequentially
   */
  async uploadMultipleFiles(
    files: Array<{ filename: string; content: Buffer }>,
    options: BulkTransferOptions = {}
  ): Promise<void> {
    const totalFiles = files.length;
    
    for (let i = 0; i < totalFiles; i++) {
      const file = files[i];
      
      // Create per-file progress callback
      const fileOptions: BulkTransferOptions = {
        ...options,
        onProgress: options.onProgress ? (progress) => {
          // Adjust progress to account for multiple files
          const overallProgress: FileTransferProgress = {
            ...progress,
            filename: file.filename,
            chunkIndex: i + 1,
            totalChunks: totalFiles,
            percentage: ((i + progress.percentage / 100) / totalFiles) * 100
          };
          options.onProgress!(overallProgress);
        } : undefined
      };

      await this.uploadFile(file.filename, file.content, true, fileOptions);
    }
  }

  /**
   * Verify file integrity after upload
   */
  async verifyUpload(filename: string, expectedContent: Buffer): Promise<boolean> {
    try {
      const downloadedContent = await this.downloadFile(filename);
      return downloadedContent.equals(expectedContent);
    } catch (error) {
      return false;
    }
  }

  /**
   * Get upload statistics
   */
  calculateTransferStats(content: Buffer, chunkSize: number = DEFAULT_CONFIG.maxChunkSize): {
    totalBytes: number;
    totalChunks: number;
    estimatedTime: number; // rough estimate in seconds
  } {
    const totalBytes = content.length;
    const totalChunks = Math.ceil(totalBytes / chunkSize);
    const estimatedTime = totalChunks * 0.5; // Rough estimate: 500ms per chunk

    return {
      totalBytes,
      totalChunks,
      estimatedTime
    };
  }

  /**
   * Utility: delay function
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Validate filename for M5Stack constraints
   */
  static validateFilename(filename: string): { valid: boolean; error?: string } {
    if (filename.length > 28) {
      return { valid: false, error: 'Filename too long (max 28 characters)' };
    }

    if (!/^[a-zA-Z0-9._/-]+$/.test(filename)) {
      return { valid: false, error: 'Filename contains invalid characters' };
    }

    if (filename.startsWith('/') && filename.length === 1) {
      return { valid: false, error: 'Cannot write to root directory' };
    }

    return { valid: true };
  }

  /**
   * Optimize chunk size based on content
   */
  static optimizeChunkSize(contentSize: number): number {
    // Use smaller chunks for small files to reduce overhead
    if (contentSize < 512) {
      return Math.min(contentSize, 128);
    }
    
    // Use standard chunk size for larger files
    return DEFAULT_CONFIG.maxChunkSize;
  }
}