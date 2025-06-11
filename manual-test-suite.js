/**
 * Manual Test Suite for Neural Network Builder
 * Comprehensive testing of different model architectures
 * 
 * To run: Open browser console and execute `runArchitectureTests()`
 */

console.log("🧪 Loading Neural Network Architecture Test Suite...");

// Test configuration
const TEST_CONFIG = {
  autoRun: false,
  verbose: true,
  delayBetweenTests: 1000, // ms
  timeoutPerTest: 5000 // ms
};

// Test case definitions
const ARCHITECTURE_TESTS = {
  // 1. BASIC SEQUENTIAL MODELS
  basicCNN: {
    name: "Basic CNN",
    description: "Simple convolutional neural network for image classification",
    instructions: [
      "1. Add Dataset node (CIFAR10)",
      "2. Add Conv2d node (in_channels=3, out_channels=32, kernel_size=3)",
      "3. Add ReLU node",
      "4. Add MaxPool2d node (kernel_size=2)",
      "5. Add Flatten node", 
      "6. Add Linear node (in_features=8192, out_features=10)",
      "7. Connect: Dataset → Conv2d → ReLU → MaxPool2d → Flatten → Linear",
      "8. Generate code and verify patterns"
    ],
    expectedCode: [
      /self\..*conv.*= nn\.Conv2d.*in_channels=3.*out_channels=32.*kernel_size=3/,
      /self\..*relu.*= nn\.ReLU/,
      /self\..*maxpool.*= nn\.MaxPool2d.*kernel_size=2/,
      /self\..*flatten.*= nn\.Flatten/,
      /self\..*linear.*= nn\.Linear.*in_features=.*out_features=10/,
      /.*conv.*_out = self\..*conv.*\(x\)/,
      /.*relu.*_out = self\..*relu.*\(.*conv.*_out\)/,
      /.*maxpool.*_out = self\..*maxpool.*\(.*relu.*_out\)/,
      /.*flatten.*_out = self\..*flatten.*\(.*maxpool.*_out\)/,
      /.*linear.*_out = self\..*linear.*\(.*flatten.*_out\)/,
      /return .*linear.*_out/
    ]
  },

  basicMLP: {
    name: "Basic MLP",
    description: "Multi-layer perceptron for tabular data",
    instructions: [
      "1. Add Dataset node (MNIST)",
      "2. Add Flatten node",
      "3. Add Linear node (in_features=784, out_features=128)",
      "4. Add ReLU node",
      "5. Add Linear node (in_features=128, out_features=10)",
      "6. Connect: Dataset → Flatten → Linear → ReLU → Linear",
      "7. Generate code and verify patterns"
    ],
    expectedCode: [
      /self\..*flatten.*= nn\.Flatten/,
      /self\..*linear.*= nn\.Linear.*in_features=784.*out_features=128/,
      /self\..*relu.*= nn\.ReLU/,
      /self\..*linear.*= nn\.Linear.*in_features=128.*out_features=10/,
      /.*flatten.*_out = self\..*flatten.*\(x\)/,
      /.*linear.*_out = self\..*linear.*\(.*flatten.*_out\)/,
      /.*relu.*_out = self\..*relu.*\(.*linear.*_out\)/,
      /.*linear.*_out = self\..*linear.*\(.*relu.*_out\)/,
      /return .*linear.*_out/
    ]
  },

  // 2. RESIDUAL CONNECTIONS
  simpleResidual: {
    name: "Simple Residual Connection",
    description: "Basic skip connection bypassing one layer",
    steps: [
      { action: "addNode", type: "input.dataset", params: { dataset: "torchvision.datasets.CIFAR10" }, position: { x: 100, y: 100 } },
      { action: "addNode", type: "torch.nn.Conv2d", params: { in_channels: 3, out_channels: 64, kernel_size: 3, padding: 1 }, position: { x: 300, y: 100 } },
      { action: "addNode", type: "torch.nn.ReLU", params: {}, position: { x: 500, y: 100 } },
      { action: "addNode", type: "torch.nn.Conv2d", params: { in_channels: 64, out_channels: 64, kernel_size: 3, padding: 1 }, position: { x: 700, y: 100 } },
      { action: "addNode", type: "torch.nn.ReLU", params: {}, position: { x: 900, y: 200 } },
      { action: "connect", from: 0, to: 1 },
      { action: "connect", from: 1, to: 2 },
      { action: "connect", from: 2, to: 3 },
      { action: "connect", from: 3, to: 4 },
      { action: "connect", from: 1, to: 4, type: "residual" } // Skip connection
    ],
    expectedCode: [
      /# Residual connection/,
      /.*_relu_out = .*_relu_out \+ .*_conv2d_out/
    ]
  },

  autoDetectedResidual: {
    name: "Auto-detected Residual",
    description: "Test auto-detection of residual connections",
    instructions: [
      "1. Add Dataset node (MNIST)",
      "2. Add Flatten node",
      "3. Add Linear node (in_features=784, out_features=128)",
      "4. Add Linear node (in_features=128, out_features=10)", 
      "5. Add ReLU node",
      "6. Connect: Dataset → Flatten → Linear → Linear → ReLU",
      "7. Connect: Flatten → ReLU (this should be auto-detected as residual)",
      "8. Wait for auto-detection (check console for logs)",
      "9. Verify edge becomes green and dashed",
      "10. Generate code and verify residual connection code"
    ],
    expectedCode: [
      /# Residual connection/,
      /.*relu.*_out = .*relu.*_out \+ .*flatten.*_out.*# Residual connection/
    ],
    visualChecks: [
      "Edge from Flatten to ReLU should be green and dashed",
      "Console should show 'Auto-detection: updating edges with residual connections'",
      "Should see notification about detected residual connections"
    ]
  },

  manualResidual: {
    name: "Manual Residual Connection",
    description: "Basic skip connection manually marked",
    instructions: [
      "1. Add Dataset node (CIFAR10)",
      "2. Add Conv2d node (in_channels=3, out_channels=64, kernel_size=3, padding=1)",
      "3. Add ReLU node",
      "4. Add Conv2d node (in_channels=64, out_channels=64, kernel_size=3, padding=1)",
      "5. Add ReLU node",
      "6. Connect: Dataset → Conv2d → ReLU → Conv2d → ReLU",
      "7. Connect: First Conv2d → Final ReLU",
      "8. Select the skip connection edge and mark as 'residual' type",
      "9. Generate code and verify residual connection"
    ],
    expectedCode: [
      /# Residual connection/,
      /.*relu.*_out = .*relu.*_out \+ .*conv.*_out.*# Residual connection/
    ]
  },

  // 3. COMPLEX ARCHITECTURES
  inceptionLike: {
    name: "Inception-like Multi-branch",
    description: "Multi-branch network with concatenation",
    instructions: [
      "1. Add Dataset node (CIFAR10)",
      "2. Add Conv2d node (1x1): in_channels=3, out_channels=16, kernel_size=1",
      "3. Add Conv2d node (3x3): in_channels=3, out_channels=16, kernel_size=3, padding=1",
      "4. Add Conv2d node (5x5): in_channels=3, out_channels=16, kernel_size=5, padding=2",
      "5. Add torch.cat node (dim=1)",
      "6. Add ReLU node",
      "7. Connect: Dataset → all three Conv2d nodes",
      "8. Connect: all three Conv2d nodes → torch.cat",
      "9. Connect: torch.cat → ReLU",
      "10. Generate code and verify concatenation"
    ],
    expectedCode: [
      /.*cat.*_out = torch\.cat\(\[.*\], dim=1\)/,
      /torch\.cat\(\[.*conv.*_out.*conv.*_out.*conv.*_out.*\], dim=1\)/
    ]
  },

  elementWiseAdd: {
    name: "Element-wise Addition",
    description: "Network using torch.add for element-wise operations",
    instructions: [
      "1. Add Dataset node (CIFAR10)",
      "2. Add Conv2d node (3x3): in_channels=3, out_channels=64, kernel_size=3, padding=1",
      "3. Add Conv2d node (5x5): in_channels=3, out_channels=64, kernel_size=5, padding=2",
      "4. Add torch.add node",
      "5. Add ReLU node",
      "6. Connect: Dataset → both Conv2d nodes",
      "7. Connect: both Conv2d nodes → torch.add",
      "8. Connect: torch.add → ReLU",
      "9. Generate code and verify element-wise addition"
    ],
    expectedCode: [
      /.*add.*_out = .*conv.*_out \+ .*conv.*_out/
    ]
  },

  // 4. NORMALIZATION LAYERS
  batchNormNetwork: {
    name: "Batch Normalization",
    description: "Network with batch normalization layers",
    instructions: [
      "1. Add Dataset node (CIFAR10)",
      "2. Add Conv2d node (in_channels=3, out_channels=64, kernel_size=3)",
      "3. Add BatchNorm2d node (num_features=64)",
      "4. Add ReLU node",
      "5. Add Flatten node",
      "6. Add Linear node (in_features=?, out_features=10)",
      "7. Connect all nodes in sequence",
      "8. Generate code and verify batch normalization"
    ],
    expectedCode: [
      /self\..*batchnorm.*= nn\.BatchNorm2d.*num_features=64/,
      /.*batchnorm.*_out = self\..*batchnorm.*\(.*conv.*_out\)/
    ]
  },

  // 5. SEQUENCE MODELS  
  lstmNetwork: {
    name: "LSTM Network",
    description: "LSTM for sequence processing",
    instructions: [
      "1. Add Dataset node (MNIST)",
      "2. Add Flatten node",
      "3. Add LSTM node (input_size=784, hidden_size=128, num_layers=2)",
      "4. Add Linear node (in_features=128, out_features=10)",
      "5. Connect all nodes in sequence",
      "6. Generate code and verify LSTM structure"
    ],
    expectedCode: [
      /self\..*lstm.*= nn\.LSTM.*input_size=784.*hidden_size=128.*num_layers=2/,
      /.*lstm.*_out = self\..*lstm.*\(.*flatten.*_out\)/
    ]
  }
};

// Test execution functions
class ArchitectureTestRunner {
  constructor() {
    this.currentTest = null;
    this.results = [];
    this.nodeRefs = [];
  }

  async runAllTests() {
    console.log("🚀 Starting Comprehensive Architecture Tests");
    console.log("=" .repeat(60));
    
    this.results = [];
    
    for (const [testKey, testCase] of Object.entries(ARCHITECTURE_TESTS)) {
      console.log(`\n🧪 Running Test: ${testCase.name}`);
      console.log(`📝 ${testCase.description}`);
      
      try {
        const result = await this.runSingleTest(testCase);
        this.results.push({ testKey, testCase, result, passed: result.success });
        
        if (result.success) {
          console.log("✅ PASSED");
        } else {
          console.log("❌ FAILED");
          console.log("   Errors:", result.errors);
        }
        
      } catch (error) {
        console.log("💥 ERROR:", error.message);
        this.results.push({ testKey, testCase, result: { success: false, errors: [error.message] }, passed: false });
      }
      
      // Delay between tests
      if (TEST_CONFIG.delayBetweenTests > 0) {
        await this.delay(TEST_CONFIG.delayBetweenTests);
      }
    }
    
    this.printSummary();
    return this.results;
  }

  async runSingleTest(testCase) {
    this.currentTest = testCase;
    this.nodeRefs = [];
    
    try {
      // Clear the canvas
      await this.clearCanvas();
      
      // Execute test steps
      for (const step of testCase.steps) {
        await this.executeStep(step);
      }
      
      // Generate code
      const generatedCode = await this.generateCode();
      
      // Validate code against expected patterns
      const codeValidation = this.validateCode(generatedCode, testCase.expectedCode || []);
      
      // Check visual elements if specified
      const visualValidation = await this.validateVisualElements(testCase.visualChecks || []);
      
      return {
        success: codeValidation.success && visualValidation.success,
        errors: [...codeValidation.errors, ...visualValidation.errors],
        generatedCode,
        codeMatches: codeValidation.matches,
        visualChecks: visualValidation.checks
      };
      
    } catch (error) {
      return {
        success: false,
        errors: [error.message],
        generatedCode: null
      };
    }
  }

  async executeStep(step) {
    switch (step.action) {
      case "addNode":
        await this.addNode(step.type, step.params, step.position);
        break;
      case "connect":
        await this.connectNodes(step.from, step.to, step.type);
        break;
      case "wait":
        await this.delay(step.duration);
        break;
      default:
        throw new Error(`Unknown step action: ${step.action}`);
    }
  }

  async addNode(type, params, position) {
    // Simulate drag and drop
    const sidebar = document.querySelector('[data-testid="sidebar"]') || document.querySelector('.sidebar');
    if (!sidebar) throw new Error("Sidebar not found");
    
    const layerButton = Array.from(sidebar.querySelectorAll('button')).find(btn => 
      btn.textContent.includes(type.split('.').pop())
    );
    
    if (!layerButton) throw new Error(`Layer button for ${type} not found`);
    
    // Simulate drag and drop (simplified)
    const canvas = document.querySelector('[data-testid="react-flow"]') || document.querySelector('.react-flow');
    if (!canvas) throw new Error("Canvas not found");
    
    // Click the layer button and then click on canvas
    layerButton.click();
    
    // Create a click event at the specified position
    const clickEvent = new MouseEvent('click', {
      clientX: position.x,
      clientY: position.y,
      bubbles: true
    });
    canvas.dispatchEvent(clickEvent);
    
    // Store node reference for connections
    const nodeId = this.getLastAddedNodeId();
    this.nodeRefs.push(nodeId);
    
    await this.delay(100); // Small delay for DOM updates
  }

  async connectNodes(fromIndex, toIndex, type = 'default') {
    const fromNodeId = this.nodeRefs[fromIndex];
    const toNodeId = this.nodeRefs[toIndex];
    
    if (!fromNodeId || !toNodeId) {
      throw new Error(`Invalid node indices: from=${fromIndex}, to=${toIndex}`);
    }
    
    // Find the nodes in the DOM
    const fromNode = document.querySelector(`[data-id="${fromNodeId}"]`);
    const toNode = document.querySelector(`[data-id="${toNodeId}"]`);
    
    if (!fromNode || !toNode) {
      throw new Error(`Nodes not found in DOM: from=${fromNodeId}, to=${toNodeId}`);
    }
    
    // Simulate connection (this would need to be adapted to the actual UI)
    const connectEvent = new CustomEvent('connect', {
      detail: { source: fromNodeId, target: toNodeId, type }
    });
    document.dispatchEvent(connectEvent);
    
    await this.delay(100);
  }

  async generateCode() {
    const generateButton = document.querySelector('button') && Array.from(document.querySelectorAll('button')).find(btn => 
      btn.textContent.toLowerCase().includes('generate')
    );
    
    if (!generateButton) throw new Error("Generate button not found");
    
    generateButton.click();
    
    // Wait for code generation
    await this.delay(2000);
    
    // Try to get generated code from various possible locations
    const codeElement = document.querySelector('pre') || 
                       document.querySelector('code') ||
                       document.querySelector('[data-testid="generated-code"]') ||
                       document.querySelector('.code-output');
    
    if (!codeElement) throw new Error("Generated code element not found");
    
    return codeElement.textContent || codeElement.innerText;
  }

  validateCode(generatedCode, expectedPatterns) {
    const errors = [];
    const matches = [];
    
    for (const pattern of expectedPatterns) {
      if (pattern.test(generatedCode)) {
        matches.push(pattern.toString());
      } else {
        errors.push(`Pattern not found: ${pattern.toString()}`);
      }
    }
    
    return {
      success: errors.length === 0,
      errors,
      matches
    };
  }

  async validateVisualElements(visualChecks) {
    const errors = [];
    const checks = [];
    
    for (const check of visualChecks) {
      try {
        const result = await this.performVisualCheck(check);
        checks.push({ check: check.check, passed: result.passed, description: check.description });
        if (!result.passed) {
          errors.push(`Visual check failed: ${check.description} - ${result.error}`);
        }
      } catch (error) {
        errors.push(`Visual check error: ${check.description} - ${error.message}`);
        checks.push({ check: check.check, passed: false, description: check.description });
      }
    }
    
    return {
      success: errors.length === 0,
      errors,
      checks
    };
  }

  async performVisualCheck(check) {
    switch (check.check) {
      case "residualEdgeExists":
        return this.checkResidualEdge(check.from, check.to);
      default:
        throw new Error(`Unknown visual check: ${check.check}`);
    }
  }

  checkResidualEdge(fromIndex, toIndex) {
    const fromNodeId = this.nodeRefs[fromIndex];
    const toNodeId = this.nodeRefs[toIndex];
    
    const edge = document.querySelector(`[data-source="${fromNodeId}"][data-target="${toNodeId}"]`);
    
    if (!edge) {
      return { passed: false, error: "Edge not found" };
    }
    
    // Check if edge is styled as residual (green dashed)
    const isGreenDashed = edge.style.stroke?.includes('green') || edge.style.stroke?.includes('#059669');
    const isDashed = edge.style.strokeDasharray?.includes('5,5') || edge.classList.contains('residual');
    
    return { 
      passed: isGreenDashed && isDashed, 
      error: isGreenDashed ? "Not dashed" : "Not green" 
    };
  }

  async clearCanvas() {
    // Try to clear the canvas - this depends on the specific UI implementation
    const clearButton = Array.from(document.querySelectorAll('button')).find(btn => 
      btn.textContent.toLowerCase().includes('clear') || 
      btn.textContent.toLowerCase().includes('new')
    );
    
    if (clearButton) {
      clearButton.click();
      await this.delay(500);
    }
    
    this.nodeRefs = [];
  }

  getLastAddedNodeId() {
    // This would need to be implemented based on how nodes are tracked in the actual app
    // For now, return a mock ID
    return `node_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  printSummary() {
    console.log("\n" + "=" .repeat(60));
    console.log("📊 TEST SUMMARY");
    console.log("=" .repeat(60));
    
    const passed = this.results.filter(r => r.passed).length;
    const failed = this.results.filter(r => !r.passed).length;
    const total = this.results.length;
    
    console.log(`✅ Passed: ${passed}/${total}`);
    console.log(`❌ Failed: ${failed}/${total}`);
    console.log(`📈 Success Rate: ${((passed/total) * 100).toFixed(1)}%`);
    
    if (failed > 0) {
      console.log("\n❌ Failed Tests:");
      this.results.filter(r => !r.passed).forEach(result => {
        console.log(`   • ${result.testCase.name}: ${result.result.errors.join(', ')}`);
      });
    }
    
    console.log("\n🎯 Recommendations:");
    if (passed === total) {
      console.log("   🎉 All tests passed! The neural network builder is working correctly.");
    } else {
      console.log("   🔧 Review failed tests and fix the underlying issues.");
      console.log("   📝 Consider adding more specific error handling.");
      console.log("   🧪 Run tests individually for detailed debugging.");
    }
  }
}

// Global test runner instance
window.testRunner = new ArchitectureTestRunner();

// Main entry point
async function runArchitectureTests() {
  console.clear();
  console.log("🔬 Neural Network Builder - Comprehensive Architecture Tests");
  console.log("Version: 1.0.0");
  console.log("Date:", new Date().toLocaleString());
  console.log("\n📋 Test Coverage:");
  console.log("   • Basic Sequential Models (CNN, MLP)");
  console.log("   • Residual Connections (Manual & Auto-detected)");
  console.log("   • Complex Architectures (Inception-like, Element-wise ops)");
  console.log("   • Normalization Layers (BatchNorm)");
  console.log("   • Sequence Models (LSTM)");
  console.log("   • Visual Validation (Edge styling)");
  console.log("   • Code Generation Validation");
  
  return await window.testRunner.runAllTests();
}

// Utility functions for manual testing
function runSingleTest(testName) {
  const testCase = ARCHITECTURE_TESTS[testName];
  if (!testCase) {
    console.error(`Test '${testName}' not found. Available tests:`, Object.keys(ARCHITECTURE_TESTS));
    return;
  }
  return window.testRunner.runSingleTest(testCase);
}

function listTests() {
  console.log("📋 Available Tests:");
  Object.entries(ARCHITECTURE_TESTS).forEach(([key, test]) => {
    console.log(`   • ${key}: ${test.name} - ${test.description}`);
  });
}

// Export for browser console usage
window.runArchitectureTests = runArchitectureTests;
window.runSingleTest = runSingleTest;  
window.listTests = listTests;
window.ARCHITECTURE_TESTS = ARCHITECTURE_TESTS;

console.log("🧪 Architecture Test Suite Loaded!");
console.log("📝 Usage:");
console.log("   runArchitectureTests() - Run all tests");
console.log("   runSingleTest('basicCNN') - Run specific test");
console.log("   listTests() - Show available tests"); 