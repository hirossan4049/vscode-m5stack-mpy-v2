/**
 * Node.js Serial Connection Implementation
 * 
 * Uses the 'serialport' package for Node.js environments
 */

import { SerialPort } from 'serialport';
import { BaseSerialConnection } from './SerialConnection';
import { ConnectionOptions, CommunicationError } from '../types';

export class NodeSerialConnection extends BaseSerialConnection {
  private serialPort?: SerialPort;

  constructor(port: string, options: ConnectionOptions = {}) {
    super(port, options);
  }

  async connect(): Promise<void> {
    if (this.isConnected) {
      return;
    }

    return new Promise((resolve, reject) => {
      try {
        this.serialPort = new SerialPort({
          path: this.port,
          baudRate: this.options.baudRate,
          autoOpen: false
        });

        this.serialPort.on('open', () => {
          this.onConnected();
          resolve();
        });

        this.serialPort.on('error', (error) => {
          this.onError(error);
          reject(new CommunicationError(`Failed to connect: ${error.message}`));
        });

        this.serialPort.on('close', () => {
          this.onDisconnected();
        });

        this.serialPort.on('data', (data: Buffer) => {
          this.onDataReceived(data);
        });

        this.serialPort.open();

      } catch (error) {
        reject(new CommunicationError(`Failed to initialize serial port: ${error}`));
      }
    });
  }

  async disconnect(): Promise<void> {
    if (!this.serialPort || !this.isConnected) {
      return;
    }

    return new Promise((resolve, reject) => {
      this.serialPort!.close((error) => {
        if (error) {
          reject(new CommunicationError(`Failed to disconnect: ${error.message}`));
        } else {
          this.serialPort = undefined;
          resolve();
        }
      });
    });
  }

  async writeRaw(data: Buffer): Promise<void> {
    if (!this.serialPort || !this.isConnected) {
      throw new CommunicationError('Not connected');
    }

    return new Promise((resolve, reject) => {
      this.serialPort!.write(data, (error) => {
        if (error) {
          reject(new CommunicationError(`Write failed: ${error.message}`));
          return;
        }

        this.serialPort!.drain((drainError) => {
          if (drainError) {
            reject(new CommunicationError(`Drain failed: ${drainError.message}`));
          } else {
            resolve();
          }
        });
      });
    });
  }

  isOpen(): boolean {
    return this.serialPort?.isOpen ?? false;
  }

  /**
   * Get available serial ports
   */
  static async listPorts() {
    try {
      return await SerialPort.list();
    } catch (error) {
      throw new CommunicationError(`Failed to list ports: ${error}`);
    }
  }
}