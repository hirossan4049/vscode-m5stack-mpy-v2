/**
 * Python Code Analysis Utilities
 * 
 * Analyzes Python code for imports, dependencies, and project structure
 */

import {
  ImportStatement,
  DependencyGraph,
  DependencyInfo,
  ProjectAnalysis
} from '../types';

export class PythonAnalyzer {
  
  /**
   * Parse Python import statements from code
   */
  parseImports(code: string): ImportStatement[] {
    const imports: ImportStatement[] = [];
    const lines = code.split('\n');
    
    lines.forEach((line, index) => {
      const trimmedLine = line.trim();
      
      // Skip comments and empty lines
      if (trimmedLine.startsWith('#') || trimmedLine === '') {
        return;
      }
      
      // Match: import module_name
      const importMatch = trimmedLine.match(/^import\s+([a-zA-Z_][a-zA-Z0-9_.]*(?:\s*,\s*[a-zA-Z_][a-zA-Z0-9_.]*)*)/);
      if (importMatch) {
        const modules = importMatch[1].split(',').map(m => m.trim());
        modules.forEach(module => {
          imports.push({
            type: 'import',
            module,
            isRelative: false,
            line: index + 1,
            raw: trimmedLine
          });
        });
        return;
      }
      
      // Match: from module import item1, item2
      const fromMatch = trimmedLine.match(/^from\s+(\.*)([a-zA-Z_][a-zA-Z0-9_.]*)\s+import\s+(.+)/);
      if (fromMatch) {
        const relativeDots = fromMatch[1];
        const module = fromMatch[2];
        const itemsStr = fromMatch[3];
        
        // Parse imported items (handle parentheses and line continuations)
        const items = this.parseImportItems(itemsStr);
        
        imports.push({
          type: 'from_import',
          module,
          items,
          isRelative: relativeDots.length > 0,
          line: index + 1,
          raw: trimmedLine
        });
        return;
      }
      
      // Match: from . import module (relative import)
      const relativeMatch = trimmedLine.match(/^from\s+(\.+)\s+import\s+(.+)/);
      if (relativeMatch) {
        const dots = relativeMatch[1];
        const itemsStr = relativeMatch[2];
        const items = this.parseImportItems(itemsStr);
        
        imports.push({
          type: 'from_import',
          module: '', // Relative import without explicit module
          items,
          isRelative: true,
          line: index + 1,
          raw: trimmedLine
        });
      }
    });
    
    return imports;
  }

  /**
   * Parse import items (handle complex cases like parentheses)
   */
  private parseImportItems(itemsStr: string): string[] {
    // Remove parentheses and split by comma
    const cleaned = itemsStr.replace(/[()]/g, '').trim();
    return cleaned.split(',').map(item => item.trim()).filter(item => item !== '');
  }

  /**
   * Resolve module name to potential file paths
   */
  resolveModulePaths(module: string, isRelative: boolean = false): string[] {
    const paths: string[] = [];
    
    if (isRelative) {
      // Relative imports - would need current file context
      return paths;
    }
    
    // Standard module resolution
    if (module.includes('.')) {
      // Package.module -> package/module.py
      const packagePath = module.replace(/\./g, '/');
      paths.push(`${packagePath}.py`);
      paths.push(`${packagePath}/__init__.py`);
    } else {
      // Simple module -> module.py
      paths.push(`${module}.py`);
    }
    
    // Add common MicroPython locations
    paths.push(`/flash/${module}.py`);
    paths.push(`/flash/lib/${module}.py`);
    
    return paths;
  }

  /**
   * Check if module is a built-in or standard library module
   */
  isBuiltinModule(module: string): boolean {
    const builtinModules = [
      // Python built-ins
      'sys', 'os', 'time', 'math', 'random', 'json', 'gc',
      'collections', 'itertools', 'functools', 're',
      
      // MicroPython specific
      'machine', 'network', 'socket', 'select', 'struct',
      'binascii', 'hashlib', 'ssl', 'micropython',
      
      // M5Stack specific
      'm5stack', 'm5ui', 'hardware', 'wifiCfg', 'display'
    ];
    
    return builtinModules.includes(module.split('.')[0]);
  }

  /**
   * Build dependency graph for a project
   */
  async buildDependencyGraph(
    entryFile: string,
    fileReader: (filename: string) => Promise<string>
  ): Promise<DependencyGraph> {
    const graph: DependencyGraph = {};
    const visited = new Set<string>();
    
    const analyzeFile = async (filename: string): Promise<void> => {
      if (visited.has(filename)) {
        return;
      }
      
      visited.add(filename);
      
      try {
        const content = await fileReader(filename);
        const imports = this.parseImports(content);
        
        // Filter out built-in modules
        const localImports = imports.filter(imp => !this.isBuiltinModule(imp.module));
        
        const dependencies: string[] = [];
        
        for (const imp of localImports) {
          const possiblePaths = this.resolveModulePaths(imp.module, imp.isRelative);
          
          // For now, just use the first possible path
          if (possiblePaths.length > 0) {
            const depPath = possiblePaths[0];
            dependencies.push(depPath);
            
            // Recursively analyze dependencies
            await analyzeFile(depPath);
          }
        }
        
        graph[filename] = {
          filename,
          dependencies,
          dependents: [],
          exists: true // Assume exists for now
        };
        
      } catch (error) {
        // File doesn't exist or can't be read
        graph[filename] = {
          filename,
          dependencies: [],
          dependents: [],
          exists: false
        };
      }
    };
    
    await analyzeFile(entryFile);
    
    // Build reverse dependencies (dependents)
    for (const [file, info] of Object.entries(graph)) {
      for (const dep of info.dependencies) {
        if (graph[dep]) {
          graph[dep].dependents.push(file);
        }
      }
    }
    
    return graph;
  }

  /**
   * Analyze a complete project
   */
  async analyzeProject(
    entryFile: string,
    entryContent: string,
    fileChecker?: (filename: string) => Promise<boolean>
  ): Promise<ProjectAnalysis> {
    const fileReader = async (filename: string): Promise<string> => {
      if (filename === entryFile) {
        return entryContent;
      }
      throw new Error(`Cannot read file: ${filename}`);
    };
    
    const dependencies = await this.buildDependencyGraph(entryFile, fileReader);
    
    // Find missing files
    const missingFiles: string[] = [];
    if (fileChecker) {
      for (const [filename, info] of Object.entries(dependencies)) {
        if (!await fileChecker(filename)) {
          missingFiles.push(filename);
          info.exists = false;
        }
      }
    } else {
      // Mark all except entry file as potentially missing
      for (const [filename, info] of Object.entries(dependencies)) {
        if (filename !== entryFile) {
          missingFiles.push(filename);
          info.exists = false;
        }
      }
    }
    
    // Detect circular dependencies
    const circularDependencies = this.detectCircularDependencies(dependencies);
    
    return {
      entryPoint: entryFile,
      dependencies,
      missingFiles,
      circularDependencies,
      totalFiles: Object.keys(dependencies).length
    };
  }

  /**
   * Detect circular dependencies
   */
  private detectCircularDependencies(graph: DependencyGraph): string[][] {
    const cycles: string[][] = [];
    const visited = new Set<string>();
    const recursionStack = new Set<string>();
    
    const dfs = (node: string, path: string[]): void => {
      if (recursionStack.has(node)) {
        // Found a cycle
        const cycleStart = path.indexOf(node);
        if (cycleStart !== -1) {
          cycles.push(path.slice(cycleStart));
        }
        return;
      }
      
      if (visited.has(node)) {
        return;
      }
      
      visited.add(node);
      recursionStack.add(node);
      
      const nodeInfo = graph[node];
      if (nodeInfo) {
        for (const dep of nodeInfo.dependencies) {
          dfs(dep, [...path, node]);
        }
      }
      
      recursionStack.delete(node);
    };
    
    for (const node of Object.keys(graph)) {
      if (!visited.has(node)) {
        dfs(node, []);
      }
    }
    
    return cycles;
  }

  /**
   * Get execution order based on dependencies
   */
  getExecutionOrder(graph: DependencyGraph, entryFile: string): string[] {
    const order: string[] = [];
    const visited = new Set<string>();
    
    const visit = (node: string): void => {
      if (visited.has(node)) {
        return;
      }
      
      visited.add(node);
      
      const nodeInfo = graph[node];
      if (nodeInfo) {
        // Visit dependencies first
        for (const dep of nodeInfo.dependencies) {
          visit(dep);
        }
      }
      
      order.push(node);
    };
    
    visit(entryFile);
    return order;
  }

  /**
   * Extract docstrings and function definitions
   */
  extractMetadata(code: string): {
    docstring?: string;
    functions: string[];
    classes: string[];
  } {
    const functions: string[] = [];
    const classes: string[] = [];
    let docstring: string | undefined;
    
    const lines = code.split('\n');
    let inDocstring = false;
    let docstringLines: string[] = [];
    
    for (const line of lines) {
      const trimmed = line.trim();
      
      // Extract docstring (simple implementation)
      if (trimmed.startsWith('"""') || trimmed.startsWith("'''")) {
        if (!inDocstring && !docstring) {
          inDocstring = true;
          docstringLines = [trimmed];
        } else if (inDocstring) {
          docstringLines.push(trimmed);
          if (trimmed.endsWith('"""') || trimmed.endsWith("'''")) {
            docstring = docstringLines.join('\n');
            inDocstring = false;
          }
        }
        continue;
      }
      
      if (inDocstring) {
        docstringLines.push(trimmed);
        continue;
      }
      
      // Extract function definitions
      const funcMatch = trimmed.match(/^def\s+([a-zA-Z_][a-zA-Z0-9_]*)/);
      if (funcMatch) {
        functions.push(funcMatch[1]);
      }
      
      // Extract class definitions
      const classMatch = trimmed.match(/^class\s+([a-zA-Z_][a-zA-Z0-9_]*)/);
      if (classMatch) {
        classes.push(classMatch[1]);
      }
    }
    
    return { docstring, functions, classes };
  }
}