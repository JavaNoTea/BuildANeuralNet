/**
 * Comprehensive Architecture Tests for Neural Network Builder
 * Tests that verify correct PyTorch code generation for various model designs
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { Node, Edge } from 'reactflow';
import FlowCanvas from '../components/FlowCanvas';
import { useFlowStore } from '../stores/flowStore';

// Mock ReactFlow
jest.mock('reactflow', () => ({
  ReactFlow: ({ children }: any) => <div data-testid="react-flow">{children}</div>,
  Background: () => <div data-testid="background" />,
  Controls: () => <div data-testid="controls" />,
  MiniMap: () => <div data-testid="minimap" />,
  useNodesState: () => [[], jest.fn()],
  useEdgesState: () => [[], jest.fn()],
  addEdge: jest.fn(),
  MarkerType: { Arrow: 'arrow' },
  useReactFlow: () => ({
    screenToFlowPosition: jest.fn(),
    setViewport: jest.fn(),
    getViewport: jest.fn(),
  }),
  useNodes: () => [],
  useEdges: () => [],
}));

// Helper function to create test nodes
const createTestNode = (id: string, registryKey: string, params: any = {}, position = { x: 0, y: 0 }): Node => ({
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

// Helper function to create test edges
const createTestEdge = (source: string, target: string, type: string = 'default'): Edge => ({
  id: `${source}-${target}`,
  source,
  target,
  type
});

describe('Neural Network Architecture Code Generation', () => {
  beforeEach(() => {
    // Reset the store before each test
    useFlowStore.getState().clearProject();
  });

  describe('Basic Sequential Models', () => {
    test('Simple CNN generates correct PyTorch code', async () => {
      const nodes = [
        createTestNode('dataset', 'input.dataset', { dataset: 'torchvision.datasets.CIFAR10' }),
        createTestNode('conv1', 'torch.nn.Conv2d', { in_channels: 3, out_channels: 32, kernel_size: 3 }),
        createTestNode('relu1', 'torch.nn.ReLU'),
        createTestNode('pool1', 'torch.nn.MaxPool2d', { kernel_size: 2 }),
        createTestNode('flatten', 'torch.nn.Flatten'),
        createTestNode('fc1', 'torch.nn.Linear', { in_features: 8192, out_features: 10 })
      ];

      const edges = [
        createTestEdge('dataset', 'conv1'),
        createTestEdge('conv1', 'relu1'),
        createTestEdge('relu1', 'pool1'),
        createTestEdge('pool1', 'flatten'),
        createTestEdge('flatten', 'fc1')
      ];

      // Set up the store with test data
      useFlowStore.getState().setNodes(nodes);
      useFlowStore.getState().setEdges(edges);
      useFlowStore.getState().setMode('code');

      render(<FlowCanvas />);

      // Trigger code generation
      const generateButton = screen.getByText(/generate code/i);
      fireEvent.click(generateButton);

      await waitFor(() => {
        const generatedCode = useFlowStore.getState().code;
        
        // Verify model structure
        expect(generatedCode).toMatch(/self\.conv1 = nn\.Conv2d\(in_channels=3, out_channels=32, kernel_size=3\)/);
        expect(generatedCode).toMatch(/self\.relu1 = nn\.ReLU\(\)/);
        expect(generatedCode).toMatch(/self\.pool1 = nn\.MaxPool2d\(kernel_size=2\)/);
        expect(generatedCode).toMatch(/self\.flatten = nn\.Flatten\(\)/);
        expect(generatedCode).toMatch(/self\.fc1 = nn\.Linear\(in_features=8192, out_features=10\)/);

        // Verify forward pass
        expect(generatedCode).toMatch(/conv1_out = self\.conv1\(x\)/);
        expect(generatedCode).toMatch(/relu1_out = self\.relu1\(conv1_out\)/);
        expect(generatedCode).toMatch(/pool1_out = self\.pool1\(relu1_out\)/);
        expect(generatedCode).toMatch(/flatten_out = self\.flatten\(pool1_out\)/);
        expect(generatedCode).toMatch(/fc1_out = self\.fc1\(flatten_out\)/);
        expect(generatedCode).toMatch(/return fc1_out/);
      });
    });

    test('Simple MLP generates correct PyTorch code', async () => {
      const nodes = [
        createTestNode('dataset', 'input.dataset', { dataset: 'torchvision.datasets.MNIST' }),
        createTestNode('flatten', 'torch.nn.Flatten'),
        createTestNode('fc1', 'torch.nn.Linear', { in_features: 784, out_features: 128 }),
        createTestNode('relu', 'torch.nn.ReLU'),
        createTestNode('fc2', 'torch.nn.Linear', { in_features: 128, out_features: 10 })
      ];

      const edges = [
        createTestEdge('dataset', 'flatten'),
        createTestEdge('flatten', 'fc1'),
        createTestEdge('fc1', 'relu'),
        createTestEdge('relu', 'fc2')
      ];

      useFlowStore.getState().setNodes(nodes);
      useFlowStore.getState().setEdges(edges);
      useFlowStore.getState().setMode('code');

      render(<FlowCanvas />);

      const generateButton = screen.getByText(/generate code/i);
      fireEvent.click(generateButton);

      await waitFor(() => {
        const generatedCode = useFlowStore.getState().code;
        
        expect(generatedCode).toMatch(/flatten_out = self\.flatten\(x\)/);
        expect(generatedCode).toMatch(/fc1_out = self\.fc1\(flatten_out\)/);
        expect(generatedCode).toMatch(/relu_out = self\.relu\(fc1_out\)/);
        expect(generatedCode).toMatch(/fc2_out = self\.fc2\(relu_out\)/);
        expect(generatedCode).toMatch(/return fc2_out/);
      });
    });
  });

  describe('Residual Connections', () => {
    test('Simple residual connection generates correct PyTorch code', async () => {
      const nodes = [
        createTestNode('dataset', 'input.dataset'),
        createTestNode('conv1', 'torch.nn.Conv2d', { in_channels: 3, out_channels: 64, kernel_size: 3, padding: 1 }),
        createTestNode('relu1', 'torch.nn.ReLU'),
        createTestNode('conv2', 'torch.nn.Conv2d', { in_channels: 64, out_channels: 64, kernel_size: 3, padding: 1 }),
        createTestNode('relu2', 'torch.nn.ReLU')
      ];

      const edges = [
        createTestEdge('dataset', 'conv1'),
        createTestEdge('conv1', 'relu1'),
        createTestEdge('relu1', 'conv2'),
        createTestEdge('conv2', 'relu2'),
        createTestEdge('conv1', 'relu2', 'residual') // Skip connection
      ];

      useFlowStore.getState().setNodes(nodes);
      useFlowStore.getState().setEdges(edges);
      useFlowStore.getState().setMode('code');

      render(<FlowCanvas />);

      const generateButton = screen.getByText(/generate code/i);
      fireEvent.click(generateButton);

      await waitFor(() => {
        const generatedCode = useFlowStore.getState().code;
        
        // Verify residual connection is handled correctly
        expect(generatedCode).toMatch(/conv1_out = self\.conv1\(x\)/);
        expect(generatedCode).toMatch(/relu1_out = self\.relu1\(conv1_out\)/);
        expect(generatedCode).toMatch(/conv2_out = self\.conv2\(relu1_out\)/);
        expect(generatedCode).toMatch(/relu2_out = self\.relu2\(conv2_out\)/);
        expect(generatedCode).toMatch(/relu2_out = relu2_out \+ conv1_out.*# Residual connection/);
      });
    });

    test('Multiple residual connections to same layer', async () => {
      const nodes = [
        createTestNode('dataset', 'input.dataset'),
        createTestNode('conv1', 'torch.nn.Conv2d', { in_channels: 3, out_channels: 64, kernel_size: 3, padding: 1 }),
        createTestNode('conv2', 'torch.nn.Conv2d', { in_channels: 64, out_channels: 64, kernel_size: 3, padding: 1 }),
        createTestNode('conv3', 'torch.nn.Conv2d', { in_channels: 64, out_channels: 64, kernel_size: 3, padding: 1 }),
        createTestNode('output', 'torch.nn.ReLU')
      ];

      const edges = [
        createTestEdge('dataset', 'conv1'),
        createTestEdge('conv1', 'conv2'),
        createTestEdge('conv2', 'conv3'),
        createTestEdge('conv3', 'output'),
        createTestEdge('conv1', 'output', 'residual'), // Long skip
        createTestEdge('conv2', 'output', 'residual')  // Short skip
      ];

      useFlowStore.getState().setNodes(nodes);
      useFlowStore.getState().setEdges(edges);
      useFlowStore.getState().setMode('code');

      render(<FlowCanvas />);

      const generateButton = screen.getByText(/generate code/i);
      fireEvent.click(generateButton);

      await waitFor(() => {
        const generatedCode = useFlowStore.getState().code;
        
        // Verify multiple residual connections
        expect(generatedCode).toMatch(/output_out = self\.output\(conv3_out\)/);
        expect(generatedCode).toMatch(/output_out = output_out \+ conv1_out \+ conv2_out.*# Residual connection/);
      });
    });

    test('Auto-detection of residual connections', async () => {
      const nodes = [
        createTestNode('dataset', 'input.dataset'),
        createTestNode('flatten', 'torch.nn.Flatten'),
        createTestNode('linear1', 'torch.nn.Linear', { in_features: 784, out_features: 128 }),
        createTestNode('linear2', 'torch.nn.Linear', { in_features: 128, out_features: 10 }),
        createTestNode('output', 'torch.nn.ReLU')
      ];

      const edges = [
        createTestEdge('dataset', 'flatten'),
        createTestEdge('flatten', 'linear1'),
        createTestEdge('linear1', 'linear2'),
        createTestEdge('linear2', 'output'),
        createTestEdge('flatten', 'output') // This should be auto-detected as residual
      ];

      useFlowStore.getState().setNodes(nodes);
      useFlowStore.getState().setEdges(edges);
      useFlowStore.getState().setMode('model');

      render(<FlowCanvas />);

      // Wait for auto-detection to run
      await waitFor(() => {
        const currentEdges = useFlowStore.getState().edges;
        const residualEdge = currentEdges.find(e => e.source === 'flatten' && e.target === 'output');
        expect(residualEdge?.type).toBe('residual');
      }, { timeout: 1000 });

      // Now test code generation
      useFlowStore.getState().setMode('code');
      const generateButton = screen.getByText(/generate code/i);
      fireEvent.click(generateButton);

      await waitFor(() => {
        const generatedCode = useFlowStore.getState().code;
        expect(generatedCode).toMatch(/output_out = output_out \+ flatten_out.*# Residual connection/);
      });
    });
  });

  describe('Complex Architectures', () => {
    test('Inception-like multi-branch network with concatenation', async () => {
      const nodes = [
        createTestNode('dataset', 'input.dataset'),
        createTestNode('conv1x1', 'torch.nn.Conv2d', { in_channels: 3, out_channels: 16, kernel_size: 1 }),
        createTestNode('conv3x3', 'torch.nn.Conv2d', { in_channels: 3, out_channels: 16, kernel_size: 3, padding: 1 }),
        createTestNode('conv5x5', 'torch.nn.Conv2d', { in_channels: 3, out_channels: 16, kernel_size: 5, padding: 2 }),
        createTestNode('concat', 'torch.cat', { dim: 1 }),
        createTestNode('output', 'torch.nn.ReLU')
      ];

      const edges = [
        createTestEdge('dataset', 'conv1x1'),
        createTestEdge('dataset', 'conv3x3'),
        createTestEdge('dataset', 'conv5x5'),
        createTestEdge('conv1x1', 'concat'),
        createTestEdge('conv3x3', 'concat'),
        createTestEdge('conv5x5', 'concat'),
        createTestEdge('concat', 'output')
      ];

      useFlowStore.getState().setNodes(nodes);
      useFlowStore.getState().setEdges(edges);
      useFlowStore.getState().setMode('code');

      render(<FlowCanvas />);

      const generateButton = screen.getByText(/generate code/i);
      fireEvent.click(generateButton);

      await waitFor(() => {
        const generatedCode = useFlowStore.getState().code;
        
        expect(generatedCode).toMatch(/conv1x1_out = self\.conv1x1\(x\)/);
        expect(generatedCode).toMatch(/conv3x3_out = self\.conv3x3\(x\)/);
        expect(generatedCode).toMatch(/conv5x5_out = self\.conv5x5\(x\)/);
        expect(generatedCode).toMatch(/concat_out = torch\.cat\(\[conv1x1_out, conv3x3_out, conv5x5_out\], dim=1\)/);
        expect(generatedCode).toMatch(/output_out = self\.output\(concat_out\)/);
      });
    });

    test('Element-wise addition network', async () => {
      const nodes = [
        createTestNode('dataset', 'input.dataset'),
        createTestNode('branch1', 'torch.nn.Conv2d', { in_channels: 3, out_channels: 64, kernel_size: 3, padding: 1 }),
        createTestNode('branch2', 'torch.nn.Conv2d', { in_channels: 3, out_channels: 64, kernel_size: 5, padding: 2 }),
        createTestNode('add', 'torch.add'),
        createTestNode('output', 'torch.nn.ReLU')
      ];

      const edges = [
        createTestEdge('dataset', 'branch1'),
        createTestEdge('dataset', 'branch2'),
        createTestEdge('branch1', 'add'),
        createTestEdge('branch2', 'add'),
        createTestEdge('add', 'output')
      ];

      useFlowStore.getState().setNodes(nodes);
      useFlowStore.getState().setEdges(edges);
      useFlowStore.getState().setMode('code');

      render(<FlowCanvas />);

      const generateButton = screen.getByText(/generate code/i);
      fireEvent.click(generateButton);

      await waitFor(() => {
        const generatedCode = useFlowStore.getState().code;
        
        expect(generatedCode).toMatch(/branch1_out = self\.branch1\(x\)/);
        expect(generatedCode).toMatch(/branch2_out = self\.branch2\(x\)/);
        expect(generatedCode).toMatch(/add_out = branch1_out \+ branch2_out/);
        expect(generatedCode).toMatch(/output_out = self\.output\(add_out\)/);
      });
    });
  });

  describe('Normalization and Advanced Layers', () => {
    test('Batch normalization network', async () => {
      const nodes = [
        createTestNode('dataset', 'input.dataset'),
        createTestNode('conv', 'torch.nn.Conv2d', { in_channels: 3, out_channels: 64, kernel_size: 3 }),
        createTestNode('bn', 'torch.nn.BatchNorm2d', { num_features: 64 }),
        createTestNode('relu', 'torch.nn.ReLU'),
        createTestNode('flatten', 'torch.nn.Flatten'),
        createTestNode('fc', 'torch.nn.Linear', { in_features: 64, out_features: 10 })
      ];

      const edges = [
        createTestEdge('dataset', 'conv'),
        createTestEdge('conv', 'bn'),
        createTestEdge('bn', 'relu'),
        createTestEdge('relu', 'flatten'),
        createTestEdge('flatten', 'fc')
      ];

      useFlowStore.getState().setNodes(nodes);
      useFlowStore.getState().setEdges(edges);
      useFlowStore.getState().setMode('code');

      render(<FlowCanvas />);

      const generateButton = screen.getByText(/generate code/i);
      fireEvent.click(generateButton);

      await waitFor(() => {
        const generatedCode = useFlowStore.getState().code;
        
        expect(generatedCode).toMatch(/self\.bn = nn\.BatchNorm2d\(num_features=64\)/);
        expect(generatedCode).toMatch(/bn_out = self\.bn\(conv_out\)/);
      });
    });

    test('LSTM sequence model', async () => {
      const nodes = [
        createTestNode('dataset', 'input.dataset'),
        createTestNode('flatten', 'torch.nn.Flatten'),
        createTestNode('lstm', 'torch.nn.LSTM', { input_size: 784, hidden_size: 128, num_layers: 2 }),
        createTestNode('fc', 'torch.nn.Linear', { in_features: 128, out_features: 10 })
      ];

      const edges = [
        createTestEdge('dataset', 'flatten'),
        createTestEdge('flatten', 'lstm'),
        createTestEdge('lstm', 'fc')
      ];

      useFlowStore.getState().setNodes(nodes);
      useFlowStore.getState().setEdges(edges);
      useFlowStore.getState().setMode('code');

      render(<FlowCanvas />);

      const generateButton = screen.getByText(/generate code/i);
      fireEvent.click(generateButton);

      await waitFor(() => {
        const generatedCode = useFlowStore.getState().code;
        
        expect(generatedCode).toMatch(/self\.lstm = nn\.LSTM\(input_size=784, hidden_size=128, num_layers=2\)/);
        expect(generatedCode).toMatch(/lstm_out = self\.lstm\(flatten_out\)/);
      });
    });
  });

  describe('Edge Cases and Error Handling', () => {
    test('Single node network', async () => {
      const nodes = [
        createTestNode('dataset', 'input.dataset'),
        createTestNode('flatten', 'torch.nn.Flatten')
      ];

      const edges = [
        createTestEdge('dataset', 'flatten')
      ];

      useFlowStore.getState().setNodes(nodes);
      useFlowStore.getState().setEdges(edges);
      useFlowStore.getState().setMode('code');

      render(<FlowCanvas />);

      const generateButton = screen.getByText(/generate code/i);
      fireEvent.click(generateButton);

      await waitFor(() => {
        const generatedCode = useFlowStore.getState().code;
        
        expect(generatedCode).toMatch(/flatten_out = self\.flatten\(x\)/);
        expect(generatedCode).toMatch(/return flatten_out/);
      });
    });

    test('Handles disconnected nodes gracefully', async () => {
      const nodes = [
        createTestNode('dataset', 'input.dataset'),
        createTestNode('conv1', 'torch.nn.Conv2d', { in_channels: 3, out_channels: 32, kernel_size: 3 }),
        createTestNode('conv2', 'torch.nn.Conv2d', { in_channels: 3, out_channels: 32, kernel_size: 3 }),
        createTestNode('relu', 'torch.nn.ReLU')
      ];

      const edges = [
        createTestEdge('dataset', 'conv1')
        // conv2 and relu are disconnected
      ];

      useFlowStore.getState().setNodes(nodes);
      useFlowStore.getState().setEdges(edges);

      const validation = useFlowStore.getState().validateForCodeGeneration();
      
      expect(validation.isValid).toBe(false);
      expect(validation.warnings.some(w => w.includes('Disconnected'))).toBe(true);
    });
  });
});

// Performance and stress tests
describe('Performance and Stress Tests', () => {
  test('Large network with many layers', async () => {
    const nodes = [createTestNode('dataset', 'input.dataset')];
    const edges = [];

    // Create a large sequential network
    for (let i = 1; i <= 50; i++) {
      nodes.push(createTestNode(`layer${i}`, 'torch.nn.ReLU'));
      edges.push(createTestEdge(i === 1 ? 'dataset' : `layer${i-1}`, `layer${i}`));
    }

    useFlowStore.getState().setNodes(nodes);
    useFlowStore.getState().setEdges(edges);
    useFlowStore.getState().setMode('code');

    render(<FlowCanvas />);

    const startTime = performance.now();
    const generateButton = screen.getByText(/generate code/i);
    fireEvent.click(generateButton);

    await waitFor(() => {
      const generatedCode = useFlowStore.getState().code;
      expect(generatedCode).toMatch(/return layer50_out/);
    });

    const endTime = performance.now();
    const executionTime = endTime - startTime;
    
    // Should complete within reasonable time (5 seconds)
    expect(executionTime).toBeLessThan(5000);
  });

  test('Complex network with many branches and residual connections', async () => {
    const nodes = [
      createTestNode('dataset', 'input.dataset'),
      createTestNode('stem', 'torch.nn.Conv2d', { in_channels: 3, out_channels: 64, kernel_size: 7 })
    ];
    
    const edges = [createTestEdge('dataset', 'stem')];

    // Create multiple parallel branches with residual connections
    for (let branch = 1; branch <= 10; branch++) {
      const branchNodes = [];
      for (let layer = 1; layer <= 5; layer++) {
        const nodeId = `branch${branch}_layer${layer}`;
        nodes.push(createTestNode(nodeId, 'torch.nn.Conv2d', { 
          in_channels: 64, out_channels: 64, kernel_size: 3, padding: 1 
        }));
        branchNodes.push(nodeId);
        
        if (layer === 1) {
          edges.push(createTestEdge('stem', nodeId));
        } else {
          edges.push(createTestEdge(branchNodes[layer - 2], nodeId));
        }
      }
      
      // Add residual connections within each branch
      edges.push(createTestEdge(branchNodes[0], branchNodes[4], 'residual'));
      edges.push(createTestEdge(branchNodes[1], branchNodes[4], 'residual'));
    }

    // Add final concatenation layer
    nodes.push(createTestNode('concat', 'torch.cat', { dim: 1 }));
    for (let branch = 1; branch <= 10; branch++) {
      edges.push(createTestEdge(`branch${branch}_layer5`, 'concat'));
    }

    useFlowStore.getState().setNodes(nodes);
    useFlowStore.getState().setEdges(edges);
    useFlowStore.getState().setMode('code');

    render(<FlowCanvas />);

    const generateButton = screen.getByText(/generate code/i);
    fireEvent.click(generateButton);

    await waitFor(() => {
      const generatedCode = useFlowStore.getState().code;
      
      // Verify all branches are included
      for (let branch = 1; branch <= 10; branch++) {
        expect(generatedCode).toMatch(new RegExp(`branch${branch}_layer5_out`));
      }
      
      // Verify residual connections are handled
      expect(generatedCode).toMatch(/# Residual connection/);
      
      // Verify concatenation
      expect(generatedCode).toMatch(/torch\.cat\(/);
    }, { timeout: 10000 });
  });
});

export default function runAllArchitectureTests() {
  console.log("🚀 Neural Network Architecture Tests Ready!");
  console.log("Run with: npm test -- --testNamePattern='Neural Network Architecture'");
} 