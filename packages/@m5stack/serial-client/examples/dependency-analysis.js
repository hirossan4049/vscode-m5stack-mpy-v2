/**
 * Python dependency analysis example
 */

const { PythonAnalyzer } = require('@m5stack/serial-client');

async function dependencyAnalysisExample() {
  console.log('Python Dependency Analysis Example\n');

  const analyzer = new PythonAnalyzer();

  // Example 1: Simple import analysis
  console.log('=== Example 1: Simple Import Analysis ===');
  
  const simpleCode = `
import time
import json
from machine import Pin
from config import settings
import utils.helper as helper

print("Hello World")
`;

  const imports = analyzer.parseImports(simpleCode);
  console.log('Imports found:');
  imports.forEach(imp => {
    console.log(`  Line ${imp.line}: ${imp.type} - ${imp.module}${imp.items ? ` (${imp.items.join(', ')})` : ''}`);
    console.log(`    Built-in: ${analyzer.isBuiltinModule(imp.module)}`);
    console.log(`    Relative: ${imp.isRelative}`);
  });

  // Example 2: Complex project analysis
  console.log('\n=== Example 2: Complex Project Analysis ===');
  
  const complexCode = `
# Main application file
import config
import utils.logger
import utils.network
from sensors import temperature, humidity
from displays.lcd import LCDDisplay
from .local_config import LOCAL_SETTINGS

class Application:
    def __init__(self):
        self.logger = utils.logger.Logger()
        self.display = LCDDisplay()
        self.temp_sensor = temperature.TemperatureSensor()
        
    def run(self):
        self.logger.info("Application starting")
        temp = self.temp_sensor.read()
        self.display.show(f"Temperature: {temp}°C")
`;

  const complexImports = analyzer.parseImports(complexCode);
  console.log('Complex imports found:');
  complexImports.forEach(imp => {
    const paths = analyzer.resolveModulePaths(imp.module, imp.isRelative);
    console.log(`  ${imp.module}:`);
    console.log(`    Type: ${imp.type}`);
    console.log(`    Built-in: ${analyzer.isBuiltinModule(imp.module)}`);
    console.log(`    Possible paths: ${paths.join(', ')}`);
  });

  // Example 3: Dependency graph simulation
  console.log('\n=== Example 3: Dependency Graph Simulation ===');
  
  // Simulate a file reader for dependency analysis
  const mockFiles = {
    'main.py': `
import config
import utils.helper
from sensors import temperature

config.setup()
temp = temperature.read_sensor()
utils.helper.log(f"Temperature: {temp}")
`,
    'config.py': `
import json

def setup():
    print("Configuration loaded")
    
SETTINGS = {"debug": True}
`,
    'utils/helper.py': `
import time

def log(message):
    timestamp = time.time()
    print(f"[{timestamp}] {message}")
`,
    'sensors.py': `
import machine

def read_sensor():
    # Mock sensor reading
    return 25.5
`
  };

  const fileReader = async (filename) => {
    if (mockFiles[filename]) {
      return mockFiles[filename];
    }
    throw new Error(`File not found: ${filename}`);
  };

  try {
    const dependencyGraph = await analyzer.buildDependencyGraph('main.py', fileReader);
    
    console.log('Dependency graph:');
    for (const [file, info] of Object.entries(dependencyGraph)) {
      console.log(`  ${file}:`);
      console.log(`    Dependencies: ${info.dependencies.join(', ') || 'none'}`);
      console.log(`    Dependents: ${info.dependents.join(', ') || 'none'}`);
      console.log(`    Exists: ${info.exists}`);
    }

    // Get execution order
    const executionOrder = analyzer.getExecutionOrder(dependencyGraph, 'main.py');
    console.log(`\nExecution order: ${executionOrder.join(' -> ')}`);

  } catch (error) {
    console.log('Dependency analysis error:', error.message);
  }

  // Example 4: Project analysis
  console.log('\n=== Example 4: Project Analysis ===');
  
  const fileChecker = async (filename) => {
    return mockFiles.hasOwnProperty(filename);
  };

  try {
    const analysis = await analyzer.analyzeProject('main.py', mockFiles['main.py'], fileChecker);
    
    console.log('Project Analysis Results:');
    console.log(`  Entry point: ${analysis.entryPoint}`);
    console.log(`  Total files: ${analysis.totalFiles}`);
    console.log(`  Missing files: ${analysis.missingFiles.join(', ') || 'none'}`);
    console.log(`  Circular dependencies: ${analysis.circularDependencies.length > 0 ? 
      analysis.circularDependencies.map(cycle => cycle.join(' -> ')).join('; ') : 'none'}`);
    
    console.log('\nDependency details:');
    for (const [file, info] of Object.entries(analysis.dependencies)) {
      console.log(`  ${file}: ${info.exists ? '✅' : '❌'} (deps: ${info.dependencies.length})`);
    }

  } catch (error) {
    console.log('Project analysis error:', error.message);
  }

  // Example 5: Code metadata extraction
  console.log('\n=== Example 5: Code Metadata Extraction ===');
  
  const codeWithMetadata = `
"""
M5Stack Temperature Monitor
A simple temperature monitoring application for M5Stack devices.
"""

import time
from machine import Pin

class TemperatureMonitor:
    def __init__(self, pin_number=26):
        self.sensor_pin = Pin(pin_number)
        
    def read_temperature(self):
        # Read temperature from sensor
        return 25.0
        
    def display_temperature(self, temp):
        print(f"Temperature: {temp}°C")

def main():
    monitor = TemperatureMonitor()
    
    while True:
        temp = monitor.read_temperature()
        monitor.display_temperature(temp)
        time.sleep(1)

if __name__ == "__main__":
    main()
`;

  const metadata = analyzer.extractMetadata(codeWithMetadata);
  console.log('Code metadata:');
  console.log(`  Docstring: ${metadata.docstring ? metadata.docstring.substring(0, 50) + '...' : 'none'}`);
  console.log(`  Functions: ${metadata.functions.join(', ')}`);
  console.log(`  Classes: ${metadata.classes.join(', ')}`);
}

// Run the example
if (require.main === module) {
  dependencyAnalysisExample().catch(console.error);
}

module.exports = { dependencyAnalysisExample };