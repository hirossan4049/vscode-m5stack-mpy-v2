/**
 * Basic usage example for @m5stack/serial-client
 */

const { M5StackClient } = require('@m5stack/serial-client');

async function basicExample() {
  // Create client with options
  const client = new M5StackClient({
    timeout: 10000,
    logLevel: 'info',
    baudRate: 115200
  });

  try {
    // List available ports
    console.log('Listing available ports...');
    const ports = await client.listPorts();
    console.log('Available ports:', ports.map(p => p.path));

    if (ports.length === 0) {
      console.log('No serial ports found');
      return;
    }

    // Use first available port (adjust as needed)
    const portPath = ports[0].path;
    console.log(`Connecting to ${portPath}...`);

    // Connect to device
    const connection = await client.connect(portPath);
    console.log('Connected successfully!');

    // Check if device is online
    const isOnline = await connection.isOnline();
    console.log('Device online:', isOnline);

    // Get device information
    try {
      const deviceInfo = await connection.getDeviceInfo();
      console.log('Device info:', deviceInfo);
    } catch (error) {
      console.log('Could not get device info:', error.message);
    }

    // Execute simple Python code
    console.log('Executing Python code...');
    const result = await connection.executeCode('print("Hello from M5Stack!")');
    console.log('Execution result:', {
      output: result.output,
      exitCode: result.exitCode,
      executionTime: result.executionTime
    });

    // List files in /flash directory
    console.log('Listing files in /flash...');
    const files = await connection.listDirectory('/flash');
    console.log('Files found:', files.map(f => `${f.name} (${f.type})`));

    // Create a simple Python file
    console.log('Creating test file...');
    const pythonCode = `
# Test file created by @m5stack/serial-client
import time
print("Test file executed!")
print("Current time:", time.time())
`;

    await connection.writeFile('/flash/test_client.py', pythonCode);
    console.log('File created successfully');

    // Read the file back
    console.log('Reading file back...');
    const fileContent = await connection.readFile('/flash/test_client.py');
    console.log('File content length:', fileContent.length, 'bytes');

    // Execute the file
    console.log('Executing the created file...');
    const fileResult = await connection.executeFile('/flash/test_client.py');
    console.log('File execution result:', {
      output: fileResult.output,
      exitCode: fileResult.exitCode
    });

    // Clean up - delete the test file
    console.log('Cleaning up...');
    await connection.deleteFile('/flash/test_client.py');
    console.log('Test file deleted');

    // Disconnect
    await client.disconnect(portPath);
    console.log('Disconnected successfully');

  } catch (error) {
    console.error('Error:', error.message);
    
    // Attempt cleanup
    try {
      await client.disconnectAll();
    } catch (cleanupError) {
      console.error('Cleanup error:', cleanupError.message);
    }
  }
}

// Run the example
if (require.main === module) {
  basicExample().catch(console.error);
}

module.exports = { basicExample };