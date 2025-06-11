/**
 * Comprehensive Model Architecture Test Suite
 * Tests code generation for various neural network designs
 */

// Mock node and edge creation utilities
const createNode = (id, registryKey, params = {}, position = { x: 0, y: 0 }) => ({
  id,
  type: 'default',
  position,
  data: {
    registryKey,
    label: id,
    params,
    isTraining: false
  }
});

const createEdge = (source, target, type = 'default') => ({
  id: `${source}-${target}`,
  source,
  target,
  type
});

// Test cases for different architectures
const testCases = {
  // 1. BASIC SEQUENTIAL MODELS
  simpleCNN: {
    name: "Simple CNN",
    description: "Basic convolutional neural network",
    nodes: [
      createNode('dataset', 'input.dataset', { dataset: 'torchvision.datasets.CIFAR10' }),
      createNode('conv1', 'torch.nn.Conv2d', { in_channels: 3, out_channels: 32, kernel_size: 3 }),
      createNode('relu1', 'torch.nn.ReLU'),
      createNode('pool1', 'torch.nn.MaxPool2d', { kernel_size: 2 }),
      createNode('flatten', 'torch.nn.Flatten'),
      createNode('fc1', 'torch.nn.Linear', { in_features: 8192, out_features: 10 })
    ],
    edges: [
      createEdge('dataset', 'conv1'),
      createEdge('conv1', 'relu1'),
      createEdge('relu1', 'pool1'),
      createEdge('pool1', 'flatten'),
      createEdge('flatten', 'fc1')
    ],
    expectedPatterns: [
      /conv1_out = self\.conv1\(x\)/,
      /relu1_out = self\.relu1\(conv1_out\)/,
      /pool1_out = self\.pool1\(relu1_out\)/,
      /flatten_out = self\.flatten\(pool1_out\)/,
      /fc1_out = self\.fc1\(flatten_out\)/,
      /return fc1_out/
    ]
  },

  simpleMLP: {
    name: "Simple MLP",
    description: "Multi-layer perceptron",
    nodes: [
      createNode('dataset', 'input.dataset', { dataset: 'torchvision.datasets.MNIST' }),
      createNode('flatten', 'torch.nn.Flatten'),
      createNode('fc1', 'torch.nn.Linear', { in_features: 784, out_features: 128 }),
      createNode('relu', 'torch.nn.ReLU'),
      createNode('fc2', 'torch.nn.Linear', { in_features: 128, out_features: 10 })
    ],
    edges: [
      createEdge('dataset', 'flatten'),
      createEdge('flatten', 'fc1'),
      createEdge('fc1', 'relu'),
      createEdge('relu', 'fc2')
    ],
    expectedPatterns: [
      /flatten_out = self\.flatten\(x\)/,
      /fc1_out = self\.fc1\(flatten_out\)/,
      /relu_out = self\.relu\(fc1_out\)/,
      /fc2_out = self\.fc2\(relu_out\)/,
      /return fc2_out/
    ]
  },

  // 2. RESIDUAL/SKIP CONNECTIONS
  simpleResidual: {
    name: "Simple Residual Connection",
    description: "Basic skip connection bypassing one layer",
    nodes: [
      createNode('dataset', 'input.dataset'),
      createNode('conv1', 'torch.nn.Conv2d', { in_channels: 3, out_channels: 64, kernel_size: 3, padding: 1 }),
      createNode('relu1', 'torch.nn.ReLU'),
      createNode('conv2', 'torch.nn.Conv2d', { in_channels: 64, out_channels: 64, kernel_size: 3, padding: 1 }),
      createNode('relu2', 'torch.nn.ReLU')
    ],
    edges: [
      createEdge('dataset', 'conv1'),
      createEdge('conv1', 'relu1'),
      createEdge('relu1', 'conv2'),
      createEdge('conv1', 'relu2', 'residual'), // Skip connection
      createEdge('conv2', 'relu2')
    ],
    expectedPatterns: [
      /conv1_out = self\.conv1\(x\)/,
      /relu1_out = self\.relu1\(conv1_out\)/,
      /conv2_out = self\.conv2\(relu1_out\)/,
      /relu2_out = self\.relu2\(conv2_out\)/,
      /relu2_out = relu2_out \+ conv1_out.*# Residual connection/,
      /return relu2_out/
    ]
  },

  multipleResiduals: {
    name: "Multiple Residual Connections",
    description: "Multiple skip connections to the same layer",
    nodes: [
      createNode('dataset', 'input.dataset'),
      createNode('conv1', 'torch.nn.Conv2d', { in_channels: 3, out_channels: 64, kernel_size: 3, padding: 1 }),
      createNode('conv2', 'torch.nn.Conv2d', { in_channels: 64, out_channels: 64, kernel_size: 3, padding: 1 }),
      createNode('conv3', 'torch.nn.Conv2d', { in_channels: 64, out_channels: 64, kernel_size: 3, padding: 1 }),
      createNode('output', 'torch.nn.ReLU')
    ],
    edges: [
      createEdge('dataset', 'conv1'),
      createEdge('conv1', 'conv2'),
      createEdge('conv2', 'conv3'),
      createEdge('conv3', 'output'),
      createEdge('conv1', 'output', 'residual'), // Long skip
      createEdge('conv2', 'output', 'residual')  // Short skip
    ],
    expectedPatterns: [
      /conv1_out = self\.conv1\(x\)/,
      /conv2_out = self\.conv2\(conv1_out\)/,
      /conv3_out = self\.conv3\(conv2_out\)/,
      /output_out = self\.output\(conv3_out\)/,
      /output_out = output_out \+ conv1_out \+ conv2_out.*# Residual connection/
    ]
  },

  // 3. COMPLEX ARCHITECTURES
  inceptionLike: {
    name: "Inception-like Architecture",
    description: "Multi-branch network with concatenation",
    nodes: [
      createNode('dataset', 'input.dataset'),
      createNode('conv1x1', 'torch.nn.Conv2d', { in_channels: 3, out_channels: 16, kernel_size: 1 }),
      createNode('conv3x3', 'torch.nn.Conv2d', { in_channels: 3, out_channels: 16, kernel_size: 3, padding: 1 }),
      createNode('conv5x5', 'torch.nn.Conv2d', { in_channels: 3, out_channels: 16, kernel_size: 5, padding: 2 }),
      createNode('concat', 'torch.cat', { dim: 1 }),
      createNode('output', 'torch.nn.ReLU')
    ],
    edges: [
      createEdge('dataset', 'conv1x1'),
      createEdge('dataset', 'conv3x3'),
      createEdge('dataset', 'conv5x5'),
      createEdge('conv1x1', 'concat'),
      createEdge('conv3x3', 'concat'),
      createEdge('conv5x5', 'concat'),
      createEdge('concat', 'output')
    ],
    expectedPatterns: [
      /conv1x1_out = self\.conv1x1\(x\)/,
      /conv3x3_out = self\.conv3x3\(x\)/,
      /conv5x5_out = self\.conv5x5\(x\)/,
      /concat_out = torch\.cat\(\[conv1x1_out, conv3x3_out, conv5x5_out\], dim=1\)/,
      /output_out = self\.output\(concat_out\)/
    ]
  },

  elementWiseAddition: {
    name: "Element-wise Addition",
    description: "Networks using torch.add for element-wise operations",
    nodes: [
      createNode('dataset', 'input.dataset'),
      createNode('branch1', 'torch.nn.Conv2d', { in_channels: 3, out_channels: 64, kernel_size: 3, padding: 1 }),
      createNode('branch2', 'torch.nn.Conv2d', { in_channels: 3, out_channels: 64, kernel_size: 5, padding: 2 }),
      createNode('add', 'torch.add'),
      createNode('output', 'torch.nn.ReLU')
    ],
    edges: [
      createEdge('dataset', 'branch1'),
      createEdge('dataset', 'branch2'),
      createEdge('branch1', 'add'),
      createEdge('branch2', 'add'),
      createEdge('add', 'output')
    ],
    expectedPatterns: [
      /branch1_out = self\.branch1\(x\)/,
      /branch2_out = self\.branch2\(x\)/,
      /add_out = branch1_out \+ branch2_out/,
      /output_out = self\.output\(add_out\)/
    ]
  },

  // 4. SEQUENCE MODELS
  simpleLSTM: {
    name: "Simple LSTM",
    description: "Basic LSTM for sequence processing",
    nodes: [
      createNode('dataset', 'input.dataset'),
      createNode('flatten', 'torch.nn.Flatten'),
      createNode('lstm', 'torch.nn.LSTM', { input_size: 784, hidden_size: 128, num_layers: 2 }),
      createNode('fc', 'torch.nn.Linear', { in_features: 128, out_features: 10 })
    ],
    edges: [
      createEdge('dataset', 'flatten'),
      createEdge('flatten', 'lstm'),
      createEdge('lstm', 'fc')
    ],
    expectedPatterns: [
      /flatten_out = self\.flatten\(x\)/,
      /lstm_out = self\.lstm\(flatten_out\)/,
      /fc_out = self\.fc\(lstm_out\)/
    ]
  },

  // 5. NORMALIZATION LAYERS
  batchNormNetwork: {
    name: "Batch Normalization Network",
    description: "Network with batch normalization layers",
    nodes: [
      createNode('dataset', 'input.dataset'),
      createNode('conv', 'torch.nn.Conv2d', { in_channels: 3, out_channels: 64, kernel_size: 3 }),
      createNode('bn', 'torch.nn.BatchNorm2d', { num_features: 64 }),
      createNode('relu', 'torch.nn.ReLU'),
      createNode('flatten', 'torch.nn.Flatten'),
      createNode('fc', 'torch.nn.Linear', { in_features: 64, out_features: 10 })
    ],
    edges: [
      createEdge('dataset', 'conv'),
      createEdge('conv', 'bn'),
      createEdge('bn', 'relu'),
      createEdge('relu', 'flatten'),
      createEdge('flatten', 'fc')
    ],
    expectedPatterns: [
      /conv_out = self\.conv\(x\)/,
      /bn_out = self\.bn\(conv_out\)/,
      /relu_out = self\.relu\(bn_out\)/,
      /flatten_out = self\.flatten\(relu_out\)/,
      /fc_out = self\.fc\(flatten_out\)/
    ]
  },

  // 6. EDGE CASES
  singleNode: {
    name: "Single Node Network",
    description: "Minimal network with just dataset and one layer",
    nodes: [
      createNode('dataset', 'input.dataset'),
      createNode('flatten', 'torch.nn.Flatten')
    ],
    edges: [
      createEdge('dataset', 'flatten')
    ],
    expectedPatterns: [
      /flatten_out = self\.flatten\(x\)/,
      /return flatten_out/
    ]
  },

  disconnectedBranches: {
    name: "Disconnected Branches",
    description: "Network with disconnected components (should be invalid)",
    nodes: [
      createNode('dataset', 'input.dataset'),
      createNode('conv1', 'torch.nn.Conv2d', { in_channels: 3, out_channels: 32, kernel_size: 3 }),
      createNode('conv2', 'torch.nn.Conv2d', { in_channels: 3, out_channels: 32, kernel_size: 3 }),
      createNode('relu', 'torch.nn.ReLU')
    ],
    edges: [
      createEdge('dataset', 'conv1'),
      // conv2 and relu are disconnected
    ],
    shouldFail: true,
    expectedError: /disconnected/i
  }
};

// Training mode test cases
const trainingTestCases = {
  completeTrainingPipeline: {
    name: "Complete Training Pipeline",
    description: "Full training setup with optimizer, loss, and metrics",
    nodes: [
      createNode('dataset', 'input.dataset', { dataset: 'torchvision.datasets.MNIST' }, undefined, true),
      createNode('transform', 'transforms.ToTensor', {}, undefined, true),
      createNode('config', 'training.Config', { loss: 'CrossEntropyLoss', epochs: 10 }, undefined, true),
      createNode('optimizer', 'torch.optim.Adam', { lr: 0.001 }, undefined, true),
      createNode('accuracy', 'metrics.Accuracy', {}, undefined, true)
    ],
    edges: [
      createEdge('dataset', 'transform'),
      createEdge('transform', 'config'),
      createEdge('config', 'optimizer'),
      createEdge('config', 'accuracy')
    ],
    expectedPatterns: [
      /optimizer = torch\.optim\.Adam/,
      /criterion = nn\.CrossEntropyLoss/,
      /epochs = 10/
    ]
  }
};

// Test runner function
function runArchitectureTest(testCase) {
  console.log(`\n🧪 Testing: ${testCase.name}`);
  console.log(`📝 Description: ${testCase.description}`);
  
  try {
    // Simulate the code generation process
    const generatedCode = generateCodeFromNodesAndEdges(testCase.nodes, testCase.edges);
    
    if (testCase.shouldFail) {
      console.log("❌ Expected failure but code was generated");
      return false;
    }
    
    // Check all expected patterns
    let allPatternsMatch = true;
    for (const pattern of testCase.expectedPatterns) {
      if (!pattern.test(generatedCode)) {
        console.log(`❌ Pattern not found: ${pattern}`);
        allPatternsMatch = false;
      }
    }
    
    if (allPatternsMatch) {
      console.log("✅ All patterns matched successfully");
      return true;
    } else {
      console.log("❌ Some patterns failed to match");
      console.log("Generated code:");
      console.log(generatedCode);
      return false;
    }
    
  } catch (error) {
    if (testCase.shouldFail && testCase.expectedError?.test(error.message)) {
      console.log("✅ Expected error occurred");
      return true;
    } else {
      console.log(`❌ Unexpected error: ${error.message}`);
      return false;
    }
  }
}

// Mock code generation function (replace with actual implementation)
function generateCodeFromNodesAndEdges(nodes, edges) {
  // This would be replaced with the actual code generation logic
  // For now, return a simple mock
  return `
# Model definition
class Net(nn.Module):
    def __init__(self):
        super().__init__()
        ${nodes.map(node => {
          if (node.data.registryKey.startsWith('torch.nn.')) {
            const layerClass = node.data.registryKey.split('.').pop();
            const params = Object.entries(node.data.params)
              .map(([key, value]) => `${key}=${value}`)
              .join(', ');
            return `self.${node.id} = nn.${layerClass}(${params})`;
          }
          return '';
        }).filter(Boolean).join('\n        ')}

    def forward(self, x):
        ${edges.map(edge => {
          const sourceNode = nodes.find(n => n.id === edge.source);
          const targetNode = nodes.find(n => n.id === edge.target);
          
          if (sourceNode?.data.registryKey === 'input.dataset') {
            return `${edge.target}_out = self.${edge.target}(x)`;
          } else if (targetNode?.data.registryKey === 'torch.cat') {
            return `${edge.target}_out = torch.cat([...], dim=1)`;
          } else if (targetNode?.data.registryKey === 'torch.add') {
            return `${edge.target}_out = ${edge.source}_out + ...`;
          } else if (edge.type === 'residual') {
            return `${edge.target}_out = ${edge.target}_out + ${edge.source}_out  # Residual connection`;
          } else {
            return `${edge.target}_out = self.${edge.target}(${edge.source}_out)`;
          }
        }).join('\n        ')}
        return ${nodes[nodes.length - 1].id}_out
  `;
}

// Main test runner
function runAllTests() {
  console.log("🚀 Starting Comprehensive Model Architecture Tests\n");
  
  let passedTests = 0;
  let totalTests = 0;
  
  // Test model architectures
  console.log("📊 Testing Model Architectures:");
  for (const [key, testCase] of Object.entries(testCases)) {
    totalTests++;
    if (runArchitectureTest(testCase)) {
      passedTests++;
    }
  }
  
  // Test training pipelines
  console.log("\n🎯 Testing Training Pipelines:");
  for (const [key, testCase] of Object.entries(trainingTestCases)) {
    totalTests++;
    if (runArchitectureTest(testCase)) {
      passedTests++;
    }
  }
  
  // Summary
  console.log(`\n📈 Test Results: ${passedTests}/${totalTests} tests passed`);
  if (passedTests === totalTests) {
    console.log("🎉 All tests passed! Neural network builder is working correctly.");
  } else {
    console.log("⚠️  Some tests failed. Please review the implementation.");
  }
  
  return passedTests === totalTests;
}

// Export for use in actual testing framework
if (typeof module !== 'undefined') {
  module.exports = {
    testCases,
    trainingTestCases,
    runArchitectureTest,
    runAllTests
  };
}

// Auto-run if executed directly
if (typeof window === 'undefined' && require.main === module) {
  runAllTests();
}

console.log("Test suite created successfully!"); 