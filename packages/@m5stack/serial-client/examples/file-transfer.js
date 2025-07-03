/**
 * File transfer example with progress monitoring
 */

const { M5StackClient } = require('@m5stack/serial-client');
const fs = require('fs');
const path = require('path');

async function fileTransferExample() {
  const client = new M5StackClient({
    timeout: 15000, // Longer timeout for file operations
    logLevel: 'info'
  });

  try {
    // Connect to first available device
    const ports = await client.listPorts();
    if (ports.length === 0) {
      throw new Error('No serial ports found');
    }

    const connection = await client.connect(ports[0].path);
    console.log(`Connected to ${ports[0].path}`);

    // Create a larger test file for progress demonstration
    const largeFileContent = Buffer.from('# Large test file\n' + 
      'data = ' + JSON.stringify(Array(100).fill(0).map((_, i) => i)) + '\n' +
      'print("Data length:", len(data))\n' +
      'for i in range(10):\n' +
      '    print(f"Processing item {i}")\n' +
      '    # Simulate some work\n' +
      '    sum(data)\n' +
      'print("Processing complete!")\n'
    );

    console.log(`Uploading file (${largeFileContent.length} bytes)...`);

    // Upload with progress monitoring
    let lastProgress = 0;
    await connection.writeFile('/flash/large_test.py', largeFileContent, {
      onProgress: (bytesWritten, totalBytes) => {
        const progress = Math.floor((bytesWritten / totalBytes) * 100);
        if (progress !== lastProgress && progress % 10 === 0) {
          console.log(`Upload progress: ${progress}% (${bytesWritten}/${totalBytes} bytes)`);
          lastProgress = progress;
        }
      }
    });

    console.log('Upload completed!');

    // Verify upload by reading file size
    const uploadedContent = await connection.readFile('/flash/large_test.py');
    console.log(`Verification: uploaded ${uploadedContent.length} bytes, expected ${largeFileContent.length} bytes`);
    
    if (uploadedContent.length === largeFileContent.length) {
      console.log('✅ File transfer verified successfully!');
    } else {
      console.log('❌ File transfer verification failed!');
    }

    // Execute the uploaded file
    console.log('Executing uploaded file...');
    const result = await connection.executeFile('/flash/large_test.py');
    console.log('Execution output:');
    console.log(result.output);
    console.log(`Execution time: ${result.executionTime}ms`);

    // Upload multiple files
    console.log('\nUploading multiple files...');
    
    const files = [
      {
        name: 'config.py',
        content: Buffer.from(`
# Configuration file
DEBUG = True
VERSION = "1.0.0"
SETTINGS = {
    "wifi_ssid": "MyWiFi",
    "wifi_password": "password123",
    "update_interval": 30
}
`)
      },
      {
        name: 'utils.py',
        content: Buffer.from(`
# Utility functions
import time

def log(message):
    timestamp = time.time()
    print(f"[{timestamp}] {message}")

def format_data(data):
    return f"Data: {data}"
`)
      },
      {
        name: 'main.py',
        content: Buffer.from(`
# Main application
import config
import utils

utils.log("Application starting...")
print(f"Version: {config.VERSION}")
print(f"Debug mode: {config.DEBUG}")
utils.log("Application ready!")
`)
      }
    ];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      console.log(`Uploading ${file.name}...`);
      
      await connection.writeFile(`/flash/${file.name}`, file.content, {
        onProgress: (bytes, total) => {
          const pct = Math.floor((bytes / total) * 100);
          if (pct === 100) {
            console.log(`  ${file.name}: 100% complete`);
          }
        }
      });
    }

    console.log('All files uploaded successfully!');

    // Test the multi-file application
    console.log('\nTesting multi-file application...');
    const appResult = await connection.executeFile('/flash/main.py');
    console.log('Application output:');
    console.log(appResult.output);

    // List all files in /flash to show what we created
    console.log('\nFiles in /flash directory:');
    const allFiles = await connection.listDirectory('/flash');
    allFiles.forEach(file => {
      console.log(`  ${file.type === 'file' ? '📄' : '📁'} ${file.name}`);
    });

    // Clean up test files
    console.log('\nCleaning up test files...');
    const testFiles = ['large_test.py', 'config.py', 'utils.py', 'main.py'];
    
    for (const filename of testFiles) {
      try {
        await connection.deleteFile(`/flash/${filename}`);
        console.log(`  Deleted ${filename}`);
      } catch (error) {
        console.log(`  Could not delete ${filename}: ${error.message}`);
      }
    }

    await client.disconnect(ports[0].path);
    console.log('Disconnected successfully');

  } catch (error) {
    console.error('Error:', error.message);
    await client.disconnectAll();
  }
}

// Run the example
if (require.main === module) {
  fileTransferExample().catch(console.error);
}

module.exports = { fileTransferExample };