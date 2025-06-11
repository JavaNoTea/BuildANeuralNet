'use client';

import React, { useCallback, useState, useMemo, useEffect, useRef } from 'react';
import ReactFlow, {
  Background,
  Controls,
  Connection,
  addEdge,
  MiniMap,
  ReactFlowProvider,
  useReactFlow,
  Node,
  NodeProps,
  applyNodeChanges,
  applyEdgeChanges,
  Edge,
  Handle,
  Position,
  MarkerType,
  NodeChange,
  EdgeChange,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { nanoid } from 'nanoid';
import { layerRegistry } from '@/lib/layerRegistry';
import { trainingRegistry } from '@/lib/trainingRegistry';
import PropertyPanel from '@/components/PropertyPanel';
import { useFlowStore } from '@/stores/flowStore';
import { useAuthStore } from '@/stores/authStore';
import { FaCode, FaProjectDiagram, FaCog, FaCopy, FaQuestionCircle } from 'react-icons/fa';
import EdgeInfo from '@/components/EdgeInfo';
import CodeEditor from '@/components/CodeEditor';
import { api } from '@/lib/api';
import type { ComponentType } from 'react';
import type { EditorProps } from '@monaco-editor/react';

// Heroicons arrow path (right arrow)
interface ArrowIconProps {
  active?: boolean;
}

const ArrowIcon: React.FC<ArrowIconProps> = ({ active }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    viewBox="0 0 24 24"
    strokeWidth={2}
    stroke={active ? '#2563eb' : 'currentColor'}
    className={`w-6 h-6 ${active ? 'drop-shadow' : ''}`}
  >
    <path strokeLinecap="round" strokeLinejoin="round" d="M17.25 6.75L21 12m0 0l-3.75 5.25M21 12H3" />
  </svg>
);

/* Custom node component */
const CustomNode: React.FC<NodeProps> = ({ data }) => {
  // Color code by category
  let color = '#2563eb'; // default blue
  let bg = '#e0e7ff'; // default bg
  let displayName = 'Unnamed Node';
  let borderStyle = 'border-gray-200'; // default border
  
  if (data.registryKey) {
    if (data.registryKey === 'input.dataset') {
      displayName = 'Dataset';
      color = '#ca8a04'; 
      bg = '#fef9c3';
    } else {
      if (data.isTraining) {
        const meta = trainingRegistry.find((l) => l.torchClass === data.registryKey);
        if (meta) {
          displayName = meta.friendly;
          switch (meta.category) {
            case 'DataAugmentation':
              color = '#9333ea'; bg = '#f3e8ff'; break; // purple
            case 'Training':
              color = '#059669'; bg = '#d1fae5'; break; // green
            case 'Optimization':
              color = '#2563eb'; bg = '#e0e7ff'; break; // blue
            case 'Metrics':
              color = '#eab308'; bg = '#fef9c3'; break; // yellow
            case 'Callbacks':
              color = '#dc2626'; bg = '#fee2e2'; break; // red
            default:
              color = '#2563eb'; bg = '#e0e7ff';
          }
        }
      } else {
        // For model nodes
        const meta = layerRegistry.find(l => l.torchClass === data.registryKey);
        if (meta) {
          displayName = meta.friendly;
          
          // Special styling for architectural blocks
          if (data.registryKey.startsWith('blocks.')) {
            borderStyle = 'border-2 border-dashed border-purple-500';
            color = '#7c3aed';
            bg = '#f3f4f6';
          } else {
            switch (meta.category) {
              case 'Input':
                color = '#ca8a04'; bg = '#fef9c3'; break; // yellow
              case 'Layers':
                color = '#2563eb'; bg = '#e0e7ff'; break; // blue
              case 'Activations':
                color = '#059669'; bg = '#d1fae5'; break; // green
              case 'Pooling':
                color = '#ea580c'; bg = '#fff7ed'; break; // orange
              case 'Normalization':
                color = '#9333ea'; bg = '#f3e8ff'; break; // purple
              case 'Loss':
                color = '#dc2626'; bg = '#fee2e2'; break; // red
              case 'Utility':
                color = '#64748b'; bg = '#f1f5f9'; break; // gray
              default:
                color = '#2563eb'; bg = '#e0e7ff';
            }
          }
        }
      }
    }
  }

  return (
    <div className="relative" style={{ minWidth: '150px' }}>
      {/* Input handle */}
      <Handle
        type="target"
        position={Position.Left}
        style={{ background: color, width: 8, height: 8 }}
      />
      
      {/* Node content */}
      <div className={`px-4 py-2 shadow-md rounded-md border ${borderStyle}`} style={{ background: bg }}>
        <div className="flex items-center">
          <div className="ml-2">
            <div className="text-sm font-medium" style={{ color }}>
              {displayName}
            </div>
          </div>
        </div>
      </div>

      {/* Output handle */}
      <Handle
        type="source"
        position={Position.Right}
        style={{ background: color, width: 8, height: 8 }}
      />
    </div>
  );
}

// Custom edge components for different connection types
const DefaultEdge = React.memo((props: any) => <EdgeInfo {...props} data={{ type: 'default' }} />);
const ResidualEdge = React.memo((props: any) => <EdgeInfo {...props} data={{ type: 'residual' }} />);
const SumEdge = React.memo((props: any) => <EdgeInfo {...props} data={{ type: 'sum' }} />);

// Memoize node types and edge types
const nodeTypes = {
  default: React.memo(CustomNode),
};

const edgeTypes = {
  default: DefaultEdge,
  residual: ResidualEdge,
  sum: SumEdge,
};

// Define types for better type safety
interface NodeData {
  registryKey: string;
  label: string;
  params: Record<string, any>;
  isTraining?: boolean;
}

function FlowCanvasInner() {
  const { nodes, edges, setNodes, setEdges, mode, setMode, modelNodes, modelEdges, trainingNodes, trainingEdges, code, setCode } = useFlowStore();
  const { isAuthenticated, user } = useAuthStore();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const [consoleOutput, setConsoleOutput] = useState<string>('');
  const [showExecutionPopup, setShowExecutionPopup] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const { screenToFlowPosition } = useReactFlow();
  const [connectMode, setConnectMode] = useState(false);
  const [connectSource, setConnectSource] = useState<string | null>(null);
  const [edgeType, setEdgeType] = useState<'default' | 'residual' | 'sum'>('default');
  
  // Track polling state to prevent memory leaks and infinite loops
  const pollingRef = useRef<{
    isActive: boolean;
    timeoutId: NodeJS.Timeout | null;
    cleanup: () => void;
  }>({
    isActive: false,
    timeoutId: null,
    cleanup: () => {}
  });

  // Cleanup polling on component unmount
  useEffect(() => {
    return () => {
      pollingRef.current.cleanup();
    };
  }, []);

  // Check if training mode is available (dataset node exists)
  const hasDatasetNode = useMemo(() => 
    nodes.some((n: Node<NodeData>) => n.data.registryKey === 'input.dataset'),
    [nodes]
  );

  // Delete node or edge on Delete key only
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Delete') {
        if (selectedId) {
          setNodes((nds: Node<NodeData>[]) => nds.filter((n: Node<NodeData>) => n.id !== selectedId));
          setEdges((eds: Edge[]) => eds.filter((e: Edge) => e.source !== selectedId && e.target !== selectedId));
          setSelectedId(null);
        } else if (selectedEdgeId) {
          setEdges((eds: Edge[]) => eds.filter((e: Edge) => e.id !== selectedEdgeId));
          setSelectedEdgeId(null);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedId, selectedEdgeId, setNodes, setEdges]);

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const raw = e.dataTransfer.getData('application/reactflow');
      if (!raw) return;

      const data = JSON.parse(raw);
      const isTrainingNode = Boolean(data.isTraining);
      
      // Only allow training nodes in training mode and model nodes in model mode
      if ((mode === 'training' && !isTrainingNode) || (mode === 'model' && isTrainingNode)) {
        return;
      }

      const meta = isTrainingNode 
        ? trainingRegistry.find((l: { torchClass: string }) => l.torchClass === data.registryKey)
        : layerRegistry.find(l => l.torchClass === data.registryKey);

      if (!meta && data.registryKey !== 'input.dataset') return;

      // Place node where cursor is released
      const position = screenToFlowPosition({ x: e.clientX, y: e.clientY });
      const registryKey = meta ? meta.torchClass : 'input.dataset';
      const id = nanoid(6);
      const newNode: Node = {
        id,
        type: 'default',
        position,
        data: {
          registryKey,
          label: id,
          params: meta ? { ...meta.defaults } : { dataset: 'torchvision.datasets.MNIST' },
          isTraining: isTrainingNode,
        },
      };
      setNodes((nds: Node<NodeData>[]) => [...nds, newNode]);
    },
    [screenToFlowPosition, setNodes, mode]
  );

  // Always add markerEnd to edges for arrows
  const edgesWithArrows = useMemo(() =>
    edges.map((e: Edge) => {
      const eType = e.type || 'default';
      let color = '#1e40af';
      let strokeWidth = 2;
      
      if (eType === 'residual') {
        color = '#059669';
      } else if (eType === 'sum') {
        color = '#dc2626';
        strokeWidth = 3;
      }
      
      return {
        ...e,
        markerEnd: {
          type: MarkerType.Arrow,
          width: 25,
          height: 25,
          color,
        },
        style: {
          strokeWidth,
          stroke: color,
          ...(eType === 'residual' && { strokeDasharray: '5,5' }),
        },
      };
    }),
    [edges]
  );

  const onConnect = useCallback(
    (params: Connection) => {
      const validation = useFlowStore.getState().validateConnection(params);
      if (!validation.isValid) {
        setValidationError(validation.errorMessage || 'Invalid connection');
        // Clear error after 5 seconds
        setTimeout(() => setValidationError(null), 5000);
        return;
      }
      const newEdge = {
        ...params,
        // In training mode, always use default edge type
        type: mode === 'training' ? 'default' : edgeType,
      };
      setEdges((eds: Edge[]) => addEdge(newEdge, eds));
    },
    [setEdges, edgeType, mode]
  );

  // Add visual feedback for valid/invalid connections
  const onConnectStart = useCallback((event: any, { nodeId }: any) => {
    const state = useFlowStore.getState();
    const sourceNode = state.nodes.find((n: Node<NodeData>) => n.id === nodeId);
    if (!sourceNode) return;

    // Add visual feedback by highlighting valid target nodes and showing warnings for invalid ones
    const nodeValidation = state.nodes.map((n: Node<NodeData>) => {
      if (n.id === nodeId) return { node: n, isValid: false, className: '' };
      
      const validation = state.validateConnection({
        source: nodeId,
        target: n.id,
        sourceHandle: 'output',
        targetHandle: 'input'
      });
      
      return {
        node: n,
        isValid: validation.isValid,
        className: validation.isValid ? 'valid-target' : 'invalid-target'
      };
    });

    setNodes((nodes: Node<NodeData>[]) => 
      nodes.map((node: Node<NodeData>) => {
        const validation = nodeValidation.find(v => v.node.id === node.id);
        return {
          ...node,
          className: validation?.className || ''
        };
      })
    );
  }, [setNodes]);

  const onConnectEnd = useCallback(() => {
    // Remove highlighting
    setNodes((nodes: Node<NodeData>[]) => 
      nodes.map((node: Node<NodeData>) => ({
        ...node,
        className: ''
      }))
    );
  }, [setNodes]);

  const safeNodes = useMemo(
    () =>
      nodes.filter(
        (n: Node<NodeData>) =>
          n.position &&
          typeof n.position.x === 'number' &&
          typeof n.position.y === 'number'
      ),
    [nodes]
  );

  // Add edge selection handler
  const handleEdgeClick = useCallback((_: any, edge: Edge) => {
    setSelectedEdgeId(edge.id);
    setSelectedId(null);
    // Set the dropdown to show the selected edge's type
    setEdgeType((edge.type as 'default' | 'residual' | 'sum') || 'default');
  }, []);

  // Update node click handler to clear edge selection
  const handleNodeClick = useCallback(
    (_: any, node: Node) => {
      if (connectMode) {
        if (!connectSource) {
          setConnectSource(node.id);
        } else if (connectSource !== node.id) {
          setEdges((eds: Edge[]) =>
            addEdge({ source: connectSource!, target: node.id } as Connection, eds)
          );
          setConnectSource(null);
        }
      } else {
        setSelectedId(node.id);
        setSelectedEdgeId(null);
      }
    },
    [connectMode, connectSource, setEdges]
  );

  // --- CODE GENERATION LOGIC ---
  const generatePyTorchCode = useCallback(() => {
    // Helper function to convert parameter values to Python format
    const toPythonValue = (value: any): string => {
      if (typeof value === 'boolean') {
        return value ? 'True' : 'False';
      }
      if (value === null || value === undefined) {
        return 'None';
      }
      if (typeof value === 'string' && value.startsWith('[') && value.endsWith(']')) {
        // Handle list-like strings from select options
        return value;
      }
      if (Array.isArray(value)) {
        // Handle arrays
        return `[${value.map(v => typeof v === 'string' ? JSON.stringify(v) : v).join(', ')}]`;
      }
      return JSON.stringify(value);
    };

    // Helper function to get node name
    const getNodeName = (node: Node) => {
      if (node.data.label && node.data.label !== node.data.registryKey) {
        return node.data.label.toLowerCase()
          .replace(/[^a-z0-9]/g, '_')
          .replace(/^[^a-z]/, 'n$&')
          .replace(/^$/, node.id);
      }
      return node.id;
    };

    // Helper function to format parameters for PyTorch
    const formatParameters = (node: Node, meta: any) => {
      const params = { ...node.data.params };
      
      // Special handling for specific node types
      if (meta.torchClass === 'transforms.RandomResizedCrop') {
        // Combine scale_min/max and ratio_min/max into tuples
        if (params.scale_min !== undefined && params.scale_max !== undefined) {
          params.scale = [params.scale_min, params.scale_max];
          delete params.scale_min;
          delete params.scale_max;
        }
        if (params.ratio_min !== undefined && params.ratio_max !== undefined) {
          params.ratio = [params.ratio_min, params.ratio_max];
          delete params.ratio_min;
          delete params.ratio_max;
        }
      }

      // Filter out null/undefined values and create parameter string
      return Object.entries(params)
        .filter(([key, value]) => value !== null && value !== undefined)
        .map(([key, value]) => `${key}=${toPythonValue(value)}`)
        .join(', ');
    };

    // We'll use both model and training nodes/edges regardless of current mode
    const allModelNodes = modelNodes;
    const allTrainingNodes = trainingNodes;

    // Find dataset nodes
    const modelDatasetNode = allModelNodes.find(n => n.data.registryKey === 'input.dataset');
    const trainingDatasetNode = allTrainingNodes.find(n => n.data.registryKey === 'input.dataset');
    
    if (!modelDatasetNode) return '# Error: No dataset node found in model.';

    // BFS to collect all model nodes connected from dataset
    const visitedModel = new Set<string>();
    const modelOrder: typeof allModelNodes = [];
    const modelQueue: string[] = [modelDatasetNode.id];
    while (modelQueue.length > 0) {
      const currId = modelQueue.shift()!;
      if (visitedModel.has(currId)) continue;
      visitedModel.add(currId);
      const node = allModelNodes.find(n => n.id === currId);
      // Only add non-dataset and non-loss nodes to the model order
      if (node && !node.data.registryKey.includes('Loss') && node.data.registryKey !== 'input.dataset') {
        modelOrder.push(node);
      }
      // Find outgoing edges
      const outgoing = modelEdges.filter(e => e.source === currId);
      for (const edge of outgoing) {
        if (!visitedModel.has(edge.target)) {
          modelQueue.push(edge.target);
        }
      }
    }

    // Find loss node separately
    const lossNode = allModelNodes.find(n => n.data.registryKey.includes('Loss'));

    // Collect training nodes by category using correct torchClass prefixes
    const transforms = allTrainingNodes.filter(n => {
      const meta = trainingRegistry.find(m => m.torchClass === n.data.registryKey);
      return meta?.torchClass.startsWith('transforms.');
    });
    const optimizers = allTrainingNodes.filter(n => {
      const meta = trainingRegistry.find(m => m.torchClass === n.data.registryKey);
      return meta?.torchClass.startsWith('torch.optim.');
    });
    const metrics = allTrainingNodes.filter(n => {
      const meta = trainingRegistry.find(m => m.torchClass === n.data.registryKey);
      return meta?.torchClass.startsWith('metrics.');
    });
    const callbacks = allTrainingNodes.filter(n => {
      const meta = trainingRegistry.find(m => m.torchClass === n.data.registryKey);
      return meta?.torchClass.startsWith('callbacks.');
    });
    const trainingConfig = allTrainingNodes.find(n => n.data.registryKey === 'training.Config');

    // Helper function to infer output channels for a node
    const getOutputChannels = (node: Node): number | null => {
      const meta = layerRegistry.find(l => l.torchClass === node.data.registryKey);
      if (!meta) return null;
      
      const params = node.data.params;
      
      // Handle different layer types
      if (meta.torchClass.includes('Conv')) {
        return params.out_channels || null;
      } else if (meta.torchClass === 'torch.nn.Linear') {
        return params.out_features || null;
      } else if (meta.torchClass === 'torch.nn.BatchNorm2d') {
        return params.num_features || null;
      } else if (meta.torchClass.startsWith('blocks.ResNet')) {
        return params.out_channels || null;
      } else if (meta.torchClass === 'blocks.InceptionModule') {
        // Inception output channels = sum of all branches
        return (params.out_1x1 || 0) + (params.out_3x3 || 0) + (params.out_5x5 || 0) + (params.out_pool || 0);
      }
      
      return null;
    };

    // Helper function to calculate actual output shape after operations
    const calculateOutputShape = (node: Node, inputChannels: number, inputHeight?: number, inputWidth?: number): { channels: number; height?: number; width?: number; flattened?: number } => {
      const meta = layerRegistry.find(l => l.torchClass === node.data.registryKey);
      if (!meta) return { channels: inputChannels };
      
      const params = node.data.params;
      
      if (meta.torchClass === 'torch.nn.AdaptiveAvgPool2d' || meta.torchClass === 'torch.nn.AdaptiveMaxPool2d') {
        const outputSize = params.output_size || 1;
        return { 
          channels: inputChannels, 
          height: outputSize, 
          width: outputSize 
        };
      } else if (meta.torchClass === 'torch.nn.Flatten') {
        // Calculate flattened size based on previous layer output
        const startDim = params.start_dim || 1;
        if (startDim === 1 && inputHeight && inputWidth) {
          // Flatten from dimension 1 onward: [batch, C, H, W] -> [batch, C*H*W]
          return { 
            channels: inputChannels, 
            flattened: inputChannels * inputHeight * inputWidth 
          };
        } else {
          // If we don't have spatial dimensions, assume it's already flattened to channels
          return { 
            channels: inputChannels, 
            flattened: inputChannels 
          };
        }
      } else if (meta.torchClass === 'torch.nn.Linear') {
        return { channels: params.out_features || inputChannels };
      } else if (meta.torchClass.includes('Conv')) {
        return { channels: params.out_channels || inputChannels };
      } else if (meta.torchClass.startsWith('blocks.ResNet')) {
        return { channels: params.out_channels || inputChannels };
      } else if (meta.torchClass === 'blocks.InceptionModule') {
        const totalChannels = (params.out_1x1 || 0) + (params.out_3x3 || 0) + (params.out_5x5 || 0) + (params.out_pool || 0);
        return { channels: totalChannels };
      }
      
      // Default: preserve input channels
      return { channels: inputChannels, height: inputHeight, width: inputWidth };
    };

    // Helper function to propagate channel dimensions
    const propagateChannelDimensions = () => {
      // Create maps to track node shapes
      const nodeShapes = new Map<string, { channels: number; height?: number; width?: number; flattened?: number }>();
      
      // Set initial shape based on dataset
      if (modelDatasetNode) {
        const datasetName = modelDatasetNode.data.params?.dataset || 'torchvision.datasets.MNIST';
        
        // Map datasets to their channel counts and dimensions
        const datasetShapes: Record<string, { channels: number; height: number; width: number }> = {
          'torchvision.datasets.MNIST': { channels: 1, height: 28, width: 28 },
          'torchvision.datasets.FashionMNIST': { channels: 1, height: 28, width: 28 },
          'torchvision.datasets.EMNIST': { channels: 1, height: 28, width: 28 },
          'torchvision.datasets.KMNIST': { channels: 1, height: 28, width: 28 },
          'torchvision.datasets.QMNIST': { channels: 1, height: 28, width: 28 },
          'torchvision.datasets.CIFAR10': { channels: 3, height: 32, width: 32 },
          'torchvision.datasets.CIFAR100': { channels: 3, height: 32, width: 32 },
          'torchvision.datasets.ImageNet': { channels: 3, height: 224, width: 224 },
          'torchvision.datasets.SVHN': { channels: 3, height: 32, width: 32 },
          'torchvision.datasets.STL10': { channels: 3, height: 96, width: 96 },
          'torchvision.datasets.CelebA': { channels: 3, height: 218, width: 178 },
        };
        
        const datasetShape = datasetShapes[datasetName] || { channels: 3, height: 224, width: 224 };
        nodeShapes.set(modelDatasetNode.id, datasetShape);
      }
      
      // Process nodes in topological order
      modelOrder.forEach((node: any) => {
        const incomingEdges = modelEdges.filter((e: any) => e.target === node.id);
        
        if (incomingEdges.length > 0) {
          // Get input shape from the first incoming edge
          const sourceId = incomingEdges[0].source;
          const inputShape = nodeShapes.get(sourceId);
          
          if (inputShape) {
            // Calculate output shape using the new function
            const outputShape = calculateOutputShape(
              node, 
              inputShape.channels, 
              inputShape.height, 
              inputShape.width
            );
            
            // Update the node's parameters based on calculated shapes
            const meta = layerRegistry.find(l => l.torchClass === node.data.registryKey);
            if (meta) {
              if (meta.torchClass.includes('Conv') || meta.torchClass === 'torch.nn.BatchNorm2d') {
                if (meta.torchClass.includes('Conv')) {
                  node.data.params.in_channels = inputShape.channels;
                } else if (meta.torchClass === 'torch.nn.BatchNorm2d') {
                  node.data.params.num_features = inputShape.channels;
                }
              } else if (meta.torchClass === 'torch.nn.Linear') {
                // For linear layers, use the flattened size if available
                if (inputShape.flattened !== undefined) {
                  node.data.params.in_features = inputShape.flattened;
                } else if (inputShape.height && inputShape.width) {
                  node.data.params.in_features = inputShape.channels * inputShape.height * inputShape.width;
                } else {
                  node.data.params.in_features = inputShape.channels;
                }
              } else if (meta.torchClass.startsWith('blocks.ResNet') || meta.torchClass === 'blocks.InceptionModule') {
                node.data.params.in_channels = inputShape.channels;
              }
            }
            
            // Store the output shape for this node
            nodeShapes.set(node.id, outputShape);
          }
        }
      });
    };

    // Apply parameter inference before code generation
    propagateChannelDimensions();

    // Generate code
    let code = '';

    // Imports
    code += 'import torch\n';
    code += 'import torch.nn as nn\n';
    code += 'import torch.optim as optim\n';
    code += 'from torch.utils.data import DataLoader\n';
    code += 'from torchvision import datasets, transforms\n';
    if (metrics.length > 0) code += 'from torchmetrics import Accuracy, Precision, Recall, F1Score\n';
    if (callbacks.length > 0) code += 'from pytorch_lightning.callbacks import ModelCheckpoint, EarlyStopping, LearningRateMonitor\n';
    code += '\n';

    // Check if we need to define any architectural blocks
    const needsResNetBlocks = modelOrder.some(n => n.data.registryKey?.startsWith('blocks.ResNet'));
    const needsInceptionBlocks = modelOrder.some(n => n.data.registryKey?.startsWith('blocks.Inception'));

    if (needsResNetBlocks) {
      code += '# ResNet Block Definitions\n';
      code += 'class ResNetBasicBlock(nn.Module):\n';
      code += '    def __init__(self, in_channels, out_channels, stride=1, downsample=False):\n';
      code += '        super().__init__()\n';
      code += '        self.conv1 = nn.Conv2d(in_channels, out_channels, 3, stride, 1, bias=False)\n';
      code += '        self.bn1 = nn.BatchNorm2d(out_channels)\n';
      code += '        self.conv2 = nn.Conv2d(out_channels, out_channels, 3, 1, 1, bias=False)\n';
      code += '        self.bn2 = nn.BatchNorm2d(out_channels)\n';
      code += '        self.relu = nn.ReLU(inplace=True)\n';
      code += '        self.downsample = None\n';
      code += '        if downsample or stride != 1 or in_channels != out_channels:\n';
      code += '            self.downsample = nn.Sequential(\n';
      code += '                nn.Conv2d(in_channels, out_channels, 1, stride, bias=False),\n';
      code += '                nn.BatchNorm2d(out_channels)\n';
      code += '            )\n\n';
      code += '    def forward(self, x):\n';
      code += '        identity = x\n';
      code += '        out = self.conv1(x)\n';
      code += '        out = self.bn1(out)\n';
      code += '        out = self.relu(out)\n';
      code += '        out = self.conv2(out)\n';
      code += '        out = self.bn2(out)\n';
      code += '        if self.downsample is not None:\n';
      code += '            identity = self.downsample(x)\n';
      code += '        out += identity\n';
      code += '        out = self.relu(out)\n';
      code += '        return out\n\n';
      
      code += 'class ResNetBottleneckBlock(nn.Module):\n';
      code += '    def __init__(self, in_channels, out_channels, stride=1, downsample=False):\n';
      code += '        super().__init__()\n';
      code += '        expansion = 4\n';
      code += '        self.conv1 = nn.Conv2d(in_channels, out_channels, 1, bias=False)\n';
      code += '        self.bn1 = nn.BatchNorm2d(out_channels)\n';
      code += '        self.conv2 = nn.Conv2d(out_channels, out_channels, 3, stride, 1, bias=False)\n';
      code += '        self.bn2 = nn.BatchNorm2d(out_channels)\n';
      code += '        self.conv3 = nn.Conv2d(out_channels, out_channels * expansion, 1, bias=False)\n';
      code += '        self.bn3 = nn.BatchNorm2d(out_channels * expansion)\n';
      code += '        self.relu = nn.ReLU(inplace=True)\n';
      code += '        self.downsample = None\n';
      code += '        if downsample or stride != 1 or in_channels != out_channels * expansion:\n';
      code += '            self.downsample = nn.Sequential(\n';
      code += '                nn.Conv2d(in_channels, out_channels * expansion, 1, stride, bias=False),\n';
      code += '                nn.BatchNorm2d(out_channels * expansion)\n';
      code += '            )\n\n';
      code += '    def forward(self, x):\n';
      code += '        identity = x\n';
      code += '        out = self.conv1(x)\n';
      code += '        out = self.bn1(out)\n';
      code += '        out = self.relu(out)\n';
      code += '        out = self.conv2(out)\n';
      code += '        out = self.bn2(out)\n';
      code += '        out = self.relu(out)\n';
      code += '        out = self.conv3(out)\n';
      code += '        out = self.bn3(out)\n';
      code += '        if self.downsample is not None:\n';
      code += '            identity = self.downsample(x)\n';
      code += '        out += identity\n';
      code += '        out = self.relu(out)\n';
      code += '        return out\n\n';
    }

    if (needsInceptionBlocks) {
      code += '# Inception Block Definition\n';
      code += 'class InceptionModule(nn.Module):\n';
      code += '    def __init__(self, in_channels, out_1x1, out_3x3_reduce, out_3x3, out_5x5_reduce, out_5x5, out_pool):\n';
      code += '        super().__init__()\n';
      code += '        # 1x1 conv branch\n';
      code += '        self.branch1 = nn.Conv2d(in_channels, out_1x1, 1)\n';
      code += '        # 3x3 conv branch\n';
      code += '        self.branch2 = nn.Sequential(\n';
      code += '            nn.Conv2d(in_channels, out_3x3_reduce, 1),\n';
      code += '            nn.ReLU(inplace=True),\n';
      code += '            nn.Conv2d(out_3x3_reduce, out_3x3, 3, padding=1)\n';
      code += '        )\n';
      code += '        # 5x5 conv branch\n';
      code += '        self.branch3 = nn.Sequential(\n';
      code += '            nn.Conv2d(in_channels, out_5x5_reduce, 1),\n';
      code += '            nn.ReLU(inplace=True),\n';
      code += '            nn.Conv2d(out_5x5_reduce, out_5x5, 5, padding=2)\n';
      code += '        )\n';
      code += '        # Pooling branch\n';
      code += '        self.branch4 = nn.Sequential(\n';
      code += '            nn.MaxPool2d(3, stride=1, padding=1),\n';
      code += '            nn.Conv2d(in_channels, out_pool, 1)\n';
      code += '        )\n\n';
      code += '    def forward(self, x):\n';
      code += '        branch1 = self.branch1(x)\n';
      code += '        branch2 = self.branch2(x)\n';
      code += '        branch3 = self.branch3(x)\n';
      code += '        branch4 = self.branch4(x)\n';
      code += '        return torch.cat([branch1, branch2, branch3, branch4], 1)\n\n';
    }

    // Dataset and transforms
    code += '# Data transforms\n';
    code += 'transform = transforms.Compose([\n';
    code += '    transforms.ToTensor(),\n';
    transforms.forEach(node => {
      const meta = trainingRegistry.find(l => l.torchClass === node.data.registryKey);
      if (meta) {
        const transformName = meta.torchClass.split('.').pop() || '';
        const paramStr = formatParameters(node, meta);
        code += `    transforms.${transformName}(${paramStr}),\n`;
      }
    });
    code += '])\n\n';

    // Dataset
    const datasetName = (modelDatasetNode.data.params.dataset || 'torchvision.datasets.MNIST').split('.').pop();
    code += '# Dataset\n';
    code += `train_dataset = datasets.${datasetName}(root='./data', train=True, download=True, transform=transform)\n`;
    code += `test_dataset = datasets.${datasetName}(root='./data', train=False, download=True, transform=transform)\n\n`;

    // DataLoader
    const batchSize = trainingConfig?.data.params.batch_size || 32;
    const numWorkers = trainingConfig?.data.params.num_workers || 4;
    const pinMemory = trainingConfig?.data.params.pin_memory !== false;
    code += '# Data loaders\n';
    code += `train_loader = DataLoader(train_dataset, batch_size=${batchSize}, shuffle=True, num_workers=${numWorkers}, pin_memory=${pinMemory ? 'True' : 'False'})\n`;
    code += `test_loader = DataLoader(test_dataset, batch_size=${batchSize}, shuffle=False, num_workers=${numWorkers}, pin_memory=${pinMemory ? 'True' : 'False'})\n\n`;

    // Model
    code += '# Model definition\n';
    code += 'class Net(nn.Module):\n';
    code += '    def __init__(self):\n';
    code += '        super().__init__()\n';
    modelOrder.forEach(node => {
      const meta = layerRegistry.find(l => l.torchClass === node.data.registryKey);
      if (meta && node.data.registryKey.startsWith('torch.nn.')) {
        // Only create layers for actual PyTorch nn modules, not utility operations
        const paramStr = formatParameters(node, meta);
        const layerClass = meta.torchClass.split('.').pop();
        code += `        self.${getNodeName(node)} = nn.${layerClass}(${paramStr})\n`;
      } else if (meta && node.data.registryKey.startsWith('blocks.')) {
        // Handle architectural blocks
        const paramStr = formatParameters(node, meta);
        const blockClass = meta.torchClass.split('.').pop();
        code += `        self.${getNodeName(node)} = ${blockClass}(${paramStr})\n`;
      }
    });
    code += '\n';

    // Forward method
    code += '    def forward(self, x):\n';
    
    // Handle complex architectures with residual/sum connections
    const processedNodes = new Set<string>();
    const nodeOutputs = new Map<string, string>();
    
    // Track residual connections for skip connections
    const residualSources = new Map<string, string[]>(); // target node -> source nodes for residual connections
    const sumSources = new Map<string, string[]>(); // target node -> source nodes for sum operations
    
    // First, analyze edges to identify residual and sum connections
    modelEdges.forEach(edge => {
      if (edge.type === 'residual') {
        if (!residualSources.has(edge.target)) {
          residualSources.set(edge.target, []);
        }
        residualSources.get(edge.target)!.push(edge.source);
      } else if (edge.type === 'sum') {
        if (!sumSources.has(edge.target)) {
          sumSources.set(edge.target, []);
        }
        sumSources.get(edge.target)!.push(edge.source);
      }
    });
    
    // For each node in order, generate the forward pass code
    modelOrder.forEach((node, index) => {
      const nodeVar = getNodeName(node);
      const incomingEdges = modelEdges.filter(e => e.target === node.id);
      const hasResidualConnections = residualSources.has(node.id);
      const hasSumConnections = sumSources.has(node.id);
      
      // Check if this node explicitly handles addition (torch.add)
      if (node.data.registryKey === 'torch.add') {
        // Handle explicit sum operations
        if (incomingEdges.length >= 2) {
          const inputs = incomingEdges.map(edge => {
            const sourceNode = allModelNodes.find(n => n.id === edge.source);
            const sourceName = sourceNode ? getNodeName(sourceNode) : 'x';
            return nodeOutputs.get(sourceName) || (sourceName === getNodeName(modelOrder[0]) ? 'x' : sourceName);
          });
          const inputVars = inputs.join(' + ');
          code += `        ${nodeVar}_out = ${inputVars}\n`;
          nodeOutputs.set(nodeVar, `${nodeVar}_out`);
        }
      } else if (node.data.registryKey === 'torch.cat') {
        // Handle concatenation operations
        if (incomingEdges.length >= 2) {
          const inputs = incomingEdges.map(edge => {
            const sourceNode = allModelNodes.find(n => n.id === edge.source);
            const sourceName = sourceNode ? getNodeName(sourceNode) : 'x';
            return nodeOutputs.get(sourceName) || (sourceName === getNodeName(modelOrder[0]) ? 'x' : sourceName);
          });
          const inputVars = inputs.join(', ');
          const dim = node.data.params.dim || 1;
          code += `        ${nodeVar}_out = torch.cat([${inputVars}], dim=${dim})\n`;
          nodeOutputs.set(nodeVar, `${nodeVar}_out`);
        }
      } else {
        // Handle regular layers with potential residual/sum connections
        
        // First, get the main input (from default edge or previous node)
        const defaultEdge = incomingEdges.find(e => !e.type || e.type === 'default');
        let inputVar = 'x';
        
        if (defaultEdge) {
          const sourceNode = allModelNodes.find(n => n.id === defaultEdge.source);
          if (sourceNode && sourceNode.data.registryKey !== 'input.dataset') {
            // Only use output from non-dataset nodes
            const sourceName = getNodeName(sourceNode);
            inputVar = nodeOutputs.get(sourceName) || `${sourceName}_out`;
          }
          // If source is dataset, keep inputVar as 'x'
        } else if (incomingEdges.length > 0) {
          // If no default edge, use the first edge
          const sourceNode = allModelNodes.find(n => n.id === incomingEdges[0].source);
          if (sourceNode && sourceNode.data.registryKey !== 'input.dataset') {
            // Only use output from non-dataset nodes
            const sourceName = getNodeName(sourceNode);
            inputVar = nodeOutputs.get(sourceName) || `${sourceName}_out`;
          }
          // If source is dataset, keep inputVar as 'x'
        } else if (index > 0) {
          // If no edges, use previous node output
          const prevNodeName = getNodeName(modelOrder[index - 1]);
          inputVar = nodeOutputs.get(prevNodeName) || `${prevNodeName}_out`;
        }
        
        // Apply the layer - check if it's a utility operation or actual layer
        if (node.data.registryKey.startsWith('torch.nn.')) {
          // Regular PyTorch layer
          code += `        ${nodeVar}_out = self.${nodeVar}(${inputVar})\n`;
        } else if (node.data.registryKey.startsWith('blocks.')) {
          // Architectural blocks (ResNet blocks, Inception modules, etc.)
          code += `        ${nodeVar}_out = self.${nodeVar}(${inputVar})\n`;
        } else if (node.data.registryKey === 'torch.add') {
          // Handle torch.add differently - it doesn't need to be a layer
          code += `        ${nodeVar}_out = ${inputVar}  # torch.add will be handled by sum connections\n`;
        } else {
          // Other utility operations
          code += `        ${nodeVar}_out = ${inputVar}  # ${node.data.registryKey}\n`;
        }
        
        // Handle sum connections (element-wise addition)
        if (hasSumConnections) {
          const sumInputs = sumSources.get(node.id)!.map(sourceId => {
            const sourceNode = allModelNodes.find(n => n.id === sourceId);
            const sourceName = sourceNode ? getNodeName(sourceNode) : 'x';
            return nodeOutputs.get(sourceName) || (sourceName === getNodeName(modelOrder[0]) ? 'x' : sourceName);
          });
          const sumExpression = sumInputs.join(' + ');
          code += `        ${nodeVar}_out = ${nodeVar}_out + ${sumExpression}  # Sum connection\n`;
        }
        
        // Handle residual connections (skip connections)
        if (hasResidualConnections) {
          const residualInputs = residualSources.get(node.id)!.map(sourceId => {
            const sourceNode = allModelNodes.find(n => n.id === sourceId);
            const sourceName = sourceNode ? getNodeName(sourceNode) : 'x';
            return nodeOutputs.get(sourceName) || (sourceName === getNodeName(modelOrder[0]) ? 'x' : sourceName);
          });
          // For residual connections, we add them after the layer transformation
          const residualExpression = residualInputs.join(' + ');
          code += `        ${nodeVar}_out = ${nodeVar}_out + ${residualExpression}  # Residual connection\n`;
        }
        
        nodeOutputs.set(nodeVar, `${nodeVar}_out`);
      }
      
      processedNodes.add(node.id);
    });
    
    // Return the output of the last node
    const lastNode = modelOrder[modelOrder.length - 1];
    const lastNodeVar = getNodeName(lastNode);
    const finalOutput = nodeOutputs.get(lastNodeVar) || `${lastNodeVar}_out`;
    code += `        return ${finalOutput}\n\n`;

    // Training setup
    code += '# Training setup\n';
    const device = trainingConfig?.data.params.device || 'cuda';
    code += `device = torch.device("${device}" if torch.cuda.is_available() else "cpu")\n`;
    code += 'model = Net().to(device)\n';

    // Optimizer - Use actual selected optimizer with proper parameters
    if (optimizers.length > 0) {
      const optimizer = optimizers[0];
      const meta = trainingRegistry.find(l => l.torchClass === optimizer.data.registryKey);
      if (meta) {
        // Special handling for optimizer parameters
        const params = { ...optimizer.data.params };
        
        // For Adam optimizer, handle betas parameter specially
        if (meta.torchClass === 'torch.optim.Adam' && !params.betas) {
          params.betas = [0.9, 0.999]; // Default betas for Adam
        }
        
        const paramStr = Object.entries(params)
          .filter(([key, value]) => value !== null && value !== undefined)
          .map(([key, value]) => `${key}=${toPythonValue(value)}`)
          .join(', ');
        const optimizerClass = meta.torchClass.split('.').pop();
        code += `optimizer = optim.${optimizerClass}(model.parameters(), ${paramStr})\n`;
      }
    } else {
      code += 'optimizer = optim.Adam(model.parameters(), lr=0.001)\n';
    }

    // Loss function
    if (lossNode) {
      const meta = layerRegistry.find(l => l.torchClass === lossNode.data.registryKey);
      if (meta) {
        const paramStr = formatParameters(lossNode, meta);
        const lossClass = meta.torchClass.split('.').pop();
        code += `criterion = nn.${lossClass}(${paramStr})\n\n`;
      }
    } else {
      code += 'criterion = nn.CrossEntropyLoss()\n\n';
    }

    // Metrics
    if (metrics.length > 0) {
      code += '# Metrics\n';
      metrics.forEach(node => {
        const meta = trainingRegistry.find(l => l.torchClass === node.data.registryKey);
        if (meta) {
          const metricName = meta.torchClass.split('.').pop() || '';
          const params = { ...node.data.params };
          
          // Add required task parameter for classification metrics if not present
          if (['Accuracy', 'Precision', 'Recall', 'F1Score'].includes(metricName) && !params.task) {
            // Default to multiclass for classification metrics
            params.task = 'multiclass';
            // For multiclass metrics, we need num_classes
            if (!params.num_classes) {
              params.num_classes = 10; // Default to 10 for MNIST-like datasets
            }
          }

          const paramStr = Object.entries(params)
            .filter(([key, value]) => value !== null && value !== undefined)
            .map(([key, value]) => `${key}=${toPythonValue(value)}`)
            .join(', ');
          code += `${getNodeName(node)} = ${metricName}(${paramStr}).to(device)\n`;
        }
      });
      code += '\n';
    }

    // Callbacks setup
    if (callbacks.length > 0) {
      code += '# Callbacks\n';
      callbacks.forEach(node => {
        const meta = trainingRegistry.find(l => l.torchClass === node.data.registryKey);
        if (meta) {
          const callbackName = meta.torchClass.split('.').pop() || '';
          const paramStr = formatParameters(node, meta);
          code += `${getNodeName(node)} = ${callbackName}(${paramStr})\n`;
        }
      });
      code += '\n';
    }

    // Training loop
    code += '# Training loop\n';
    const epochs = trainingConfig?.data.params.epochs || 10;
    code += `num_epochs = ${epochs}\n\n`;
    
    code += 'def train_epoch():\n';
    code += '    model.train()\n';
    code += '    running_loss = 0.0\n';
    code += '    for batch_idx, (data, target) in enumerate(train_loader):\n';
    code += '        data, target = data.to(device), target.to(device)\n';
    code += '        optimizer.zero_grad()\n';
    code += '        output = model(data)\n';
    code += '        loss = criterion(output, target)\n';
    code += '        loss.backward()\n';
    code += '        optimizer.step()\n';
    code += '        running_loss += loss.item()\n';
    code += '        if batch_idx % 100 == 0:\n';
    code += '            print(f"Train Batch {batch_idx}/{len(train_loader)} "\n';
    code += '                  f"Loss: {running_loss / (batch_idx + 1):.6f}")\n\n';

    code += 'def evaluate():\n';
    code += '    model.eval()\n';
    code += '    test_loss = 0\n';
    if (metrics.length > 0) {
      metrics.forEach(node => {
        code += `    ${getNodeName(node)}.reset()\n`;
      });
    }
    code += '    with torch.no_grad():\n';
    code += '        for data, target in test_loader:\n';
    code += '            data, target = data.to(device), target.to(device)\n';
    code += '            output = model(data)\n';
    code += '            test_loss += criterion(output, target).item()\n';
    if (metrics.length > 0) {
      metrics.forEach(node => {
        const meta = trainingRegistry.find(l => l.torchClass === node.data.registryKey);
        if (meta) {
          code += `            ${getNodeName(node)}.update(output, target)\n`;
        }
      });
    }
    code += '    test_loss /= len(test_loader)\n';
    code += '    print(f"Test set: Average loss: {test_loss:.4f}")\n';
    if (metrics.length > 0) {
      metrics.forEach(node => {
        const meta = trainingRegistry.find(l => l.torchClass === node.data.registryKey);
        if (meta) {
          const metricName = meta.torchClass.split('.').pop();
          code += `    print(f"Test set: ${metricName}: {${getNodeName(node)}.compute():.4f}")\n`;
        }
      });
    }
    code += '\n';

    // Main training loop with callbacks
    code += 'def train():\n';
    code += '    best_metric = float("inf")\n';
    code += '    for epoch in range(num_epochs):\n';
    code += '        print(f"Epoch {epoch+1}/{num_epochs}")\n';
    code += '        train_epoch()\n';
    code += '        evaluate()\n';
    if (callbacks.length > 0) {
      // Add callback variables initialization
      let hasEarlyStopping = false;
      let hasLRMonitor = false;
      
      callbacks.forEach(node => {
        const meta = trainingRegistry.find(l => l.torchClass === node.data.registryKey);
        if (meta && meta.torchClass === 'callbacks.EarlyStopping') {
          hasEarlyStopping = true;
        } else if (meta && meta.torchClass === 'callbacks.LearningRateMonitor') {
          hasLRMonitor = true;
        }
      });
      
      // Add early stopping variables if needed
      if (hasEarlyStopping) {
        code = code.replace('def train():\n    best_metric = float("inf")\n', 
          'def train():\n    best_metric = float("inf")\n    early_stop_counter = 0\n    early_stop_patience = 7\n    best_val_loss = float("inf")\n');
      }
      
      // Add LR monitoring variables if needed
      if (hasLRMonitor) {
        code += '        current_lr = optimizer.param_groups[0]["lr"]\n';
        code += '        print(f"Learning Rate: {current_lr:.6f}")\n';
      }
      
      callbacks.forEach(node => {
        const meta = trainingRegistry.find(l => l.torchClass === node.data.registryKey);
        const params = node.data.params || {};
        
        if (meta && meta.torchClass === 'callbacks.ModelCheckpoint') {
          const monitor = params.monitor || 'val_loss';
          const mode = params.mode || 'min';
          const save_top_k = params.save_top_k || 1;
          const verbose = params.verbose || false;
          
          code += '        # Model checkpoint\n';
          if (mode === 'min') {
            code += `        if ${monitor.replace('val_', '')} < best_metric:\n`;
          } else {
            code += `        if ${monitor.replace('val_', '')} > best_metric:\n`;
          }
          code += `            best_metric = ${monitor.replace('val_', '')}\n`;
          code += '            torch.save({\n';
          code += '                "model_state_dict": model.state_dict(),\n';
          code += '                "optimizer_state_dict": optimizer.state_dict(),\n';
          code += '                "epoch": epoch,\n';
          code += `                "${monitor}": best_metric,\n`;
          code += '            }, "best_model_checkpoint.pth")\n';
          if (verbose) {
            code += `            print(f"Saved new best model with {monitor}: {{best_metric:.4f}}")\n`;
          }
          
        } else if (meta && meta.torchClass === 'callbacks.EarlyStopping') {
          const monitor = params.monitor || 'val_loss';
          const patience = params.patience || 7;
          const mode = params.mode || 'min';
          const min_delta = params.min_delta || 0.0;
          const verbose = params.verbose || false;
          const restore_best = params.restore_best_weights || false;
          
          code += '        # Early stopping logic\n';
          if (mode === 'min') {
            code += `        if ${monitor.replace('val_', '')} < (best_val_loss - ${min_delta}):\n`;
          } else {
            code += `        if ${monitor.replace('val_', '')} > (best_val_loss + ${min_delta}):\n`;
          }
          code += `            best_val_loss = ${monitor.replace('val_', '')}\n`;
          code += '            early_stop_counter = 0\n';
          if (restore_best) {
            code += '            # Save best weights\n';
            code += '            best_model_state = model.state_dict().copy()\n';
          }
          code += '        else:\n';
          code += '            early_stop_counter += 1\n';
          if (verbose) {
            code += `            print(f"Early stopping counter: {{early_stop_counter}}/{patience}")\n`;
          }
          code += `        if early_stop_counter >= {patience}:\n`;
          if (verbose) {
            code += `            print(f"Early stopping triggered after {{epoch + 1}} epochs")\n`;
          }
          if (restore_best) {
            code += '            model.load_state_dict(best_model_state)\n';
          }
          code += '            break\n';
          
        } else if (meta && meta.torchClass === 'callbacks.LearningRateMonitor') {
          const logging_interval = params.logging_interval || 'epoch';
          const log_momentum = params.log_momentum || false;
          
          code += '        # Learning rate monitoring\n';
          code += '        current_lr = optimizer.param_groups[0]["lr"]\n';
          if (logging_interval === 'epoch') {
            code += '        print(f"Epoch {epoch+1} - Learning Rate: {current_lr:.8f}")\n';
          }
          if (log_momentum && 'momentum' in meta.defaults) {
            code += '        if hasattr(optimizer, "defaults") and "momentum" in optimizer.defaults:\n';
            code += '            momentum = optimizer.param_groups[0].get("momentum", 0)\n';
            code += '            print(f"Momentum: {momentum:.4f}")\n';
          }
        }
      });
    }
    code += '\n';

    // Main execution
    code += 'if __name__ == "__main__":\n';
    code += '    train()\n';

    return code;
  }, [modelNodes, modelEdges, trainingNodes, trainingEdges]);

  // Copy code to clipboard
  const copyCodeToClipboard = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    } catch (err) {
      console.error('Failed to copy code:', err);
    }
  }, [code]);

  // Add template creation function
  const createResNetTemplate = useCallback(() => {
    const position = { x: 100, y: 100 };
    const spacing = { x: 200, y: 100 };
    const newNodes: Node[] = [];
    
    // Input layer
    const inputNode: Node = {
      id: nanoid(6),
      type: 'default',
      position: { x: position.x, y: position.y },
      data: {
        registryKey: 'torch.nn.Conv2d',
        label: 'input_conv',
        params: { in_channels: 3, out_channels: 64, kernel_size: 7, stride: 2, padding: 3, bias: false },
        isTraining: false,
      },
    };
    newNodes.push(inputNode);
    
    // BatchNorm + ReLU + MaxPool
    const bnNode: Node = {
      id: nanoid(6),
      type: 'default',
      position: { x: position.x + spacing.x, y: position.y },
      data: {
        registryKey: 'torch.nn.BatchNorm2d',
        label: 'input_bn',
        params: { num_features: 64 },
        isTraining: false,
      },
    };
    newNodes.push(bnNode);
    
    const reluNode: Node = {
      id: nanoid(6),
      type: 'default',
      position: { x: position.x + spacing.x * 2, y: position.y },
      data: {
        registryKey: 'torch.nn.ReLU',
        label: 'input_relu',
        params: { inplace: true },
        isTraining: false,
      },
    };
    newNodes.push(reluNode);
    
    const poolNode: Node = {
      id: nanoid(6),
      type: 'default',
      position: { x: position.x + spacing.x * 3, y: position.y },
      data: {
        registryKey: 'torch.nn.MaxPool2d',
        label: 'input_pool',
        params: { kernel_size: 3, stride: 2, padding: 1 },
        isTraining: false,
      },
    };
    newNodes.push(poolNode);
    
    // ResNet blocks
    const resBlockPositions = [
      { x: position.x, y: position.y + spacing.y },
      { x: position.x + spacing.x, y: position.y + spacing.y },
      { x: position.x + spacing.x * 2, y: position.y + spacing.y },
    ];
    
    resBlockPositions.forEach((pos, i) => {
      const resBlock: Node = {
        id: nanoid(6),
        type: 'default',
        position: pos,
        data: {
          registryKey: 'blocks.ResNetBasicBlock',
          label: `resblock_${i + 1}`,
          params: { 
            in_channels: i === 0 ? 64 : 64, 
            out_channels: 64, 
            stride: 1, 
            downsample: false 
          },
          isTraining: false,
        },
      };
      newNodes.push(resBlock);
    });
    
    // Global average pooling and classifier
    const globalPoolNode: Node = {
      id: nanoid(6),
      type: 'default',
      position: { x: position.x + spacing.x * 3, y: position.y + spacing.y },
      data: {
        registryKey: 'torch.nn.AdaptiveAvgPool2d',
        label: 'global_pool',
        params: { output_size: 1 },
        isTraining: false,
      },
    };
    newNodes.push(globalPoolNode);
    
    const flattenNode: Node = {
      id: nanoid(6),
      type: 'default',
      position: { x: position.x + spacing.x * 4, y: position.y + spacing.y },
      data: {
        registryKey: 'torch.nn.Flatten',
        label: 'flatten',
        params: { start_dim: 1 },
        isTraining: false,
      },
    };
    newNodes.push(flattenNode);
    
    const classifierNode: Node = {
      id: nanoid(6),
      type: 'default',
      position: { x: position.x + spacing.x * 5, y: position.y + spacing.y },
      data: {
        registryKey: 'torch.nn.Linear',
        label: 'classifier',
        params: { in_features: 64, out_features: 10 },
        isTraining: false,
      },
    };
    newNodes.push(classifierNode);
    
    // Create edges to connect the nodes
    const newEdges: Edge[] = [
      { id: `${inputNode.id}-${bnNode.id}`, source: inputNode.id, target: bnNode.id, type: 'default' },
      { id: `${bnNode.id}-${reluNode.id}`, source: bnNode.id, target: reluNode.id, type: 'default' },
      { id: `${reluNode.id}-${poolNode.id}`, source: reluNode.id, target: poolNode.id, type: 'default' },
      { id: `${poolNode.id}-${newNodes[4].id}`, source: poolNode.id, target: newNodes[4].id, type: 'default' },
      { id: `${newNodes[4].id}-${newNodes[5].id}`, source: newNodes[4].id, target: newNodes[5].id, type: 'default' },
      { id: `${newNodes[5].id}-${newNodes[6].id}`, source: newNodes[5].id, target: newNodes[6].id, type: 'default' },
      { id: `${newNodes[6].id}-${globalPoolNode.id}`, source: newNodes[6].id, target: globalPoolNode.id, type: 'default' },
      { id: `${globalPoolNode.id}-${flattenNode.id}`, source: globalPoolNode.id, target: flattenNode.id, type: 'default' },
      { id: `${flattenNode.id}-${classifierNode.id}`, source: flattenNode.id, target: classifierNode.id, type: 'default' },
    ];
    
    setNodes((nds) => [...nds, ...newNodes]);
    setEdges((eds) => [...eds, ...newEdges]);
  }, [setNodes, setEdges]);

  // Add Inception model template
  const createInceptionTemplate = useCallback(() => {
    const position = { x: 100, y: 100 };
    const spacing = { x: 250, y: 120 };
    const newNodes: Node[] = [];
    
    // Initial layers
    const conv1: Node = {
      id: nanoid(6),
      type: 'default',
      position: { x: position.x, y: position.y },
      data: {
        registryKey: 'torch.nn.Conv2d',
        label: 'conv1',
        params: { in_channels: 3, out_channels: 64, kernel_size: 7, stride: 2, padding: 3, bias: false },
        isTraining: false,
      },
    };
    newNodes.push(conv1);
    
    const maxpool1: Node = {
      id: nanoid(6),
      type: 'default',
      position: { x: position.x + spacing.x, y: position.y },
      data: {
        registryKey: 'torch.nn.MaxPool2d',
        label: 'maxpool1',
        params: { kernel_size: 3, stride: 2, padding: 1 },
        isTraining: false,
      },
    };
    newNodes.push(maxpool1);
    
    // Inception modules
    const inception1: Node = {
      id: nanoid(6),
      type: 'default',
      position: { x: position.x, y: position.y + spacing.y },
      data: {
        registryKey: 'blocks.InceptionModule',
        label: 'inception1',
        params: { 
          in_channels: 64, 
          out_1x1: 32,
          out_3x3_reduce: 48,
          out_3x3: 64,
          out_5x5_reduce: 8,
          out_5x5: 16,
          out_pool: 16
        },
        isTraining: false,
      },
    };
    newNodes.push(inception1);
    
    const inception2: Node = {
      id: nanoid(6),
      type: 'default',
      position: { x: position.x + spacing.x, y: position.y + spacing.y },
      data: {
        registryKey: 'blocks.InceptionModule',
        label: 'inception2',
        params: { 
          in_channels: 128, // 32+64+16+16 from previous inception
          out_1x1: 64,
          out_3x3_reduce: 96,
          out_3x3: 128,
          out_5x5_reduce: 16,
          out_5x5: 32,
          out_pool: 32
        },
        isTraining: false,
      },
    };
    newNodes.push(inception2);
    
    // Global pooling and classifier
    const globalPool: Node = {
      id: nanoid(6),
      type: 'default',
      position: { x: position.x + spacing.x * 2, y: position.y + spacing.y },
      data: {
        registryKey: 'torch.nn.AdaptiveAvgPool2d',
        label: 'global_pool',
        params: { output_size: 1 },
        isTraining: false,
      },
    };
    newNodes.push(globalPool);
    
    const flatten: Node = {
      id: nanoid(6),
      type: 'default',
      position: { x: position.x + spacing.x * 3, y: position.y + spacing.y },
      data: {
        registryKey: 'torch.nn.Flatten',
        label: 'flatten',
        params: { start_dim: 1 },
        isTraining: false,
      },
    };
    newNodes.push(flatten);
    
    const classifier: Node = {
      id: nanoid(6),
      type: 'default',
      position: { x: position.x + spacing.x * 4, y: position.y + spacing.y },
      data: {
        registryKey: 'torch.nn.Linear',
        label: 'classifier',
        params: { in_features: 256, out_features: 10 }, // 64+128+32+32 from inception2
        isTraining: false,
      },
    };
    newNodes.push(classifier);
    
    // Create edges
    const newEdges: Edge[] = [
      { id: `${conv1.id}-${maxpool1.id}`, source: conv1.id, target: maxpool1.id, type: 'default' },
      { id: `${maxpool1.id}-${inception1.id}`, source: maxpool1.id, target: inception1.id, type: 'default' },
      { id: `${inception1.id}-${inception2.id}`, source: inception1.id, target: inception2.id, type: 'default' },
      { id: `${inception2.id}-${globalPool.id}`, source: inception2.id, target: globalPool.id, type: 'default' },
      { id: `${globalPool.id}-${flatten.id}`, source: globalPool.id, target: flatten.id, type: 'default' },
      { id: `${flatten.id}-${classifier.id}`, source: flatten.id, target: classifier.id, type: 'default' },
    ];
    
    setNodes((nds) => [...nds, ...newNodes]);
    setEdges((eds) => [...eds, ...newEdges]);
  }, [setNodes, setEdges]);

  // ResNet training template
  const createResNetTrainingTemplate = useCallback(() => {
    const modelNodes: Node[] = [];
    const trainingNodes: Node[] = [];
    const newEdges: Edge[] = [];
    
    const position = { x: 50, y: 50 };
    const spacing = { x: 180, y: 100 };
    
    // Dataset node
    const dataset: Node = {
      id: nanoid(6),
      type: 'default',
      position: { x: position.x, y: position.y },
      data: {
        registryKey: 'input.dataset',
        label: 'dataset',
        params: { dataset: 'torchvision.datasets.CIFAR10' },
        isTraining: false,
      },
    };
    modelNodes.push(dataset);
    
    // Model architecture - simplified ResNet
    const conv1: Node = {
      id: nanoid(6),
      type: 'default',
      position: { x: position.x + spacing.x, y: position.y },
      data: {
        registryKey: 'torch.nn.Conv2d',
        label: 'conv1',
        params: { in_channels: 3, out_channels: 64, kernel_size: 3, stride: 1, padding: 1, bias: false },
        isTraining: false,
      },
    };
    modelNodes.push(conv1);
    
    const resBlock: Node = {
      id: nanoid(6),
      type: 'default',
      position: { x: position.x + spacing.x * 2, y: position.y },
      data: {
        registryKey: 'blocks.ResNetBasicBlock',
        label: 'resblock1',
        params: { in_channels: 64, out_channels: 64, stride: 1, downsample: false },
        isTraining: false,
      },
    };
    modelNodes.push(resBlock);
    
    const globalPool: Node = {
      id: nanoid(6),
      type: 'default',
      position: { x: position.x + spacing.x * 3, y: position.y },
      data: {
        registryKey: 'torch.nn.AdaptiveAvgPool2d',
        label: 'global_pool',
        params: { output_size: 1 },
        isTraining: false,
      },
    };
    modelNodes.push(globalPool);
    
    const flatten: Node = {
      id: nanoid(6),
      type: 'default',
      position: { x: position.x + spacing.x * 4, y: position.y },
      data: {
        registryKey: 'torch.nn.Flatten',
        label: 'flatten',
        params: { start_dim: 1 },
        isTraining: false,
      },
    };
    modelNodes.push(flatten);
    
    const classifier: Node = {
      id: nanoid(6),
      type: 'default',
      position: { x: position.x + spacing.x * 5, y: position.y },
      data: {
        registryKey: 'torch.nn.Linear',
        label: 'classifier',
        params: { in_features: 64, out_features: 10 },
        isTraining: false,
      },
    };
    modelNodes.push(classifier);
    
    // Loss function
    const loss: Node = {
      id: nanoid(6),
      type: 'default',
      position: { x: position.x + spacing.x * 6, y: position.y },
      data: {
        registryKey: 'torch.nn.CrossEntropyLoss',
        label: 'loss',
        params: { reduction: 'mean' },
        isTraining: false,
      },
    };
    modelNodes.push(loss);
    
    // Training components
    const transforms: Node[] = [
      {
        id: nanoid(6),
        type: 'default',
        position: { x: position.x, y: position.y + spacing.y * 2 },
        data: {
          registryKey: 'transforms.RandomHorizontalFlip',
          label: 'flip',
          params: { p: 0.5 },
          isTraining: true,
        },
      },
      {
        id: nanoid(6),
        type: 'default',
        position: { x: position.x + spacing.x, y: position.y + spacing.y * 2 },
        data: {
          registryKey: 'transforms.Normalize',
          label: 'normalize',
          params: { mean: [0.485, 0.456, 0.406], std: [0.229, 0.224, 0.225] },
          isTraining: true,
        },
      },
    ];
    trainingNodes.push(...transforms);
    
    const optimizer: Node = {
      id: nanoid(6),
      type: 'default',
      position: { x: position.x + spacing.x * 2, y: position.y + spacing.y * 2 },
      data: {
        registryKey: 'torch.optim.Adam',
        label: 'optimizer',
        params: { lr: 0.001, weight_decay: 1e-4 },
        isTraining: true,
      },
    };
    trainingNodes.push(optimizer);
    
    const accuracy: Node = {
      id: nanoid(6),
      type: 'default',
      position: { x: position.x + spacing.x * 3, y: position.y + spacing.y * 2 },
      data: {
        registryKey: 'metrics.Accuracy',
        label: 'accuracy',
        params: { task: 'multiclass', num_classes: 10 },
        isTraining: true,
      },
    };
    trainingNodes.push(accuracy);
    
    const config: Node = {
      id: nanoid(6),
      type: 'default',
      position: { x: position.x + spacing.x * 4, y: position.y + spacing.y * 2 },
      data: {
        registryKey: 'training.config',
        label: 'config',
        params: { epochs: 20, batch_size: 64, device: 'cuda' },
        isTraining: true,
      },
    };
    trainingNodes.push(config);
    
    // Model edges
    const modelEdges: Edge[] = [
      { id: `${dataset.id}-${conv1.id}`, source: dataset.id, target: conv1.id, type: 'default' },
      { id: `${conv1.id}-${resBlock.id}`, source: conv1.id, target: resBlock.id, type: 'default' },
      { id: `${resBlock.id}-${globalPool.id}`, source: resBlock.id, target: globalPool.id, type: 'default' },
      { id: `${globalPool.id}-${flatten.id}`, source: globalPool.id, target: flatten.id, type: 'default' },
      { id: `${flatten.id}-${classifier.id}`, source: flatten.id, target: classifier.id, type: 'default' },
      { id: `${classifier.id}-${loss.id}`, source: classifier.id, target: loss.id, type: 'default' },
    ];
    
    setNodes((nds) => [...nds, ...modelNodes, ...trainingNodes]);
    setEdges((eds) => [...eds, ...modelEdges]);
  }, [setNodes, setEdges]);

  // Inception training template
  const createInceptionTrainingTemplate = useCallback(() => {
    const modelNodes: Node[] = [];
    const trainingNodes: Node[] = [];
    
    const position = { x: 50, y: 50 };
    const spacing = { x: 200, y: 100 };
    
    // Dataset node
    const dataset: Node = {
      id: nanoid(6),
      type: 'default',
      position: { x: position.x, y: position.y },
      data: {
        registryKey: 'input.dataset',
        label: 'dataset',
        params: { dataset: 'torchvision.datasets.CIFAR10' },
        isTraining: false,
      },
    };
    modelNodes.push(dataset);
    
    // Model architecture - simplified Inception
    const conv1: Node = {
      id: nanoid(6),
      type: 'default',
      position: { x: position.x + spacing.x, y: position.y },
      data: {
        registryKey: 'torch.nn.Conv2d',
        label: 'conv1',
        params: { in_channels: 3, out_channels: 64, kernel_size: 3, stride: 1, padding: 1 },
        isTraining: false,
      },
    };
    modelNodes.push(conv1);
    
    const inception: Node = {
      id: nanoid(6),
      type: 'default',
      position: { x: position.x + spacing.x * 2, y: position.y },
      data: {
        registryKey: 'blocks.InceptionModule',
        label: 'inception1',
        params: { 
          in_channels: 64,
          out_1x1: 32,
          out_3x3_reduce: 48,
          out_3x3: 64,
          out_5x5_reduce: 8,
          out_5x5: 16,
          out_pool: 16
        },
        isTraining: false,
      },
    };
    modelNodes.push(inception);
    
    const globalPool: Node = {
      id: nanoid(6),
      type: 'default',
      position: { x: position.x + spacing.x * 3, y: position.y },
      data: {
        registryKey: 'torch.nn.AdaptiveAvgPool2d',
        label: 'global_pool',
        params: { output_size: 1 },
        isTraining: false,
      },
    };
    modelNodes.push(globalPool);
    
    const flatten: Node = {
      id: nanoid(6),
      type: 'default',
      position: { x: position.x + spacing.x * 4, y: position.y },
      data: {
        registryKey: 'torch.nn.Flatten',
        label: 'flatten',
        params: { start_dim: 1 },
        isTraining: false,
      },
    };
    modelNodes.push(flatten);
    
    const classifier: Node = {
      id: nanoid(6),
      type: 'default',
      position: { x: position.x + spacing.x * 5, y: position.y },
      data: {
        registryKey: 'torch.nn.Linear',
        label: 'classifier',
        params: { in_features: 128, out_features: 10 }, // 32+64+16+16
        isTraining: false,
      },
    };
    modelNodes.push(classifier);
    
    // Loss function
    const loss: Node = {
      id: nanoid(6),
      type: 'default',
      position: { x: position.x + spacing.x * 6, y: position.y },
      data: {
        registryKey: 'torch.nn.CrossEntropyLoss',
        label: 'loss',
        params: { reduction: 'mean' },
        isTraining: false,
      },
    };
    modelNodes.push(loss);
    
    // Training components
    const transforms: Node[] = [
      {
        id: nanoid(6),
        type: 'default',
        position: { x: position.x, y: position.y + spacing.y * 2 },
        data: {
          registryKey: 'transforms.RandomCrop',
          label: 'crop',
          params: { size: 32, padding: 4 },
          isTraining: true,
        },
      },
      {
        id: nanoid(6),
        type: 'default',
        position: { x: position.x + spacing.x, y: position.y + spacing.y * 2 },
        data: {
          registryKey: 'transforms.ColorJitter',
          label: 'jitter',
          params: { brightness: 0.2, contrast: 0.2, saturation: 0.2, hue: 0.1 },
          isTraining: true,
        },
      },
    ];
    trainingNodes.push(...transforms);
    
    const optimizer: Node = {
      id: nanoid(6),
      type: 'default',
      position: { x: position.x + spacing.x * 2, y: position.y + spacing.y * 2 },
      data: {
        registryKey: 'torch.optim.SGD',
        label: 'optimizer',
        params: { lr: 0.01, momentum: 0.9, weight_decay: 1e-4 },
        isTraining: true,
      },
    };
    trainingNodes.push(optimizer);
    
    const metrics: Node[] = [
      {
        id: nanoid(6),
        type: 'default',
        position: { x: position.x + spacing.x * 3, y: position.y + spacing.y * 2 },
        data: {
          registryKey: 'metrics.Accuracy',
          label: 'accuracy',
          params: { task: 'multiclass', num_classes: 10 },
          isTraining: true,
        },
      },
      {
        id: nanoid(6),
        type: 'default',
        position: { x: position.x + spacing.x * 4, y: position.y + spacing.y * 2 },
        data: {
          registryKey: 'metrics.F1Score',
          label: 'f1',
          params: { task: 'multiclass', num_classes: 10, average: 'macro' },
          isTraining: true,
        },
      },
    ];
    trainingNodes.push(...metrics);
    
    const config: Node = {
      id: nanoid(6),
      type: 'default',
      position: { x: position.x + spacing.x * 5, y: position.y + spacing.y * 2 },
      data: {
        registryKey: 'training.config',
        label: 'config',
        params: { epochs: 30, batch_size: 32, device: 'cuda' },
        isTraining: true,
      },
    };
    trainingNodes.push(config);
    
    // Model edges
    const modelEdges: Edge[] = [
      { id: `${dataset.id}-${conv1.id}`, source: dataset.id, target: conv1.id, type: 'default' },
      { id: `${conv1.id}-${inception.id}`, source: conv1.id, target: inception.id, type: 'default' },
      { id: `${inception.id}-${globalPool.id}`, source: inception.id, target: globalPool.id, type: 'default' },
      { id: `${globalPool.id}-${flatten.id}`, source: globalPool.id, target: flatten.id, type: 'default' },
      { id: `${flatten.id}-${classifier.id}`, source: flatten.id, target: classifier.id, type: 'default' },
      { id: `${classifier.id}-${loss.id}`, source: classifier.id, target: loss.id, type: 'default' },
    ];
    
    setNodes((nds) => [...nds, ...modelNodes, ...trainingNodes]);
    setEdges((eds) => [...eds, ...modelEdges]);
  }, [setNodes, setEdges]);

  return (
    <>
      <div
        className="flex-1 h-screen bg-gray-100 relative"
        style={{ zIndex: 0 }}
        onDragOver={(e) => e.preventDefault()}
        onDrop={onDrop}
      >
        {mode === 'code' ? (
          <div className="w-full h-full flex flex-col items-stretch bg-white overflow-hidden">
            <div className="flex justify-between items-center p-4 border-b bg-gray-50">
              <div className="flex items-center gap-4">
                <h2 className="text-lg font-semibold text-gray-900">PyTorch Code Generator</h2>
                <div className="flex gap-3">
                  <button
                    onClick={() => {
                      const validation = useFlowStore.getState().validateForCodeGeneration();
                      if (!validation.isValid) {
                        const allIssues = [
                          ...validation.errors,
                          ...validation.missingComponents
                        ].join('\n\n');
                        setValidationError(`Cannot generate code:\n\n${allIssues}`);
                        setTimeout(() => setValidationError(null), 8000);
                        return;
                      }
                      if (validation.warnings.length > 0) {
                        const warnings = validation.warnings.join('\n');
                        setValidationError(`Code generated with warnings:\n\n${warnings}`);
                        setTimeout(() => setValidationError(null), 5000);
                      }
                      const generatedCode = generatePyTorchCode();
                      setCode(generatedCode);
                    }}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
                  >
                    <FaCode className="w-4 h-4" />
                    Generate Code
                  </button>
                  <button
                    onClick={copyCodeToClipboard}
                    className={`px-4 py-2 rounded-lg transition-colors flex items-center gap-2 ${
                      copySuccess 
                        ? 'bg-green-600 text-white' 
                        : 'bg-gray-600 text-white hover:bg-gray-700'
                    }`}
                  >
                    <FaCopy className="w-4 h-4" />
                    {copySuccess ? 'Copied!' : 'Copy Code'}
                  </button>
                  <button
                    onClick={() => setShowExecutionPopup(true)}
                    className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors flex items-center gap-2"
                  >
                    <FaQuestionCircle className="w-4 h-4" />
                    Why No Execute?
                  </button>
                </div>
              </div>
            </div>
            <div className="flex-1 overflow-hidden">
              <CodeEditor
                code={code}
                onCodeChange={setCode}
              />
            </div>
          </div>
        ) : (
          <ReactFlow
            nodes={safeNodes}
            edges={edgesWithArrows}
            onNodesChange={(changes) => setNodes((nds) => applyNodeChanges(changes, nds))}
            onEdgesChange={(changes) => setEdges((eds) => applyEdgeChanges(changes, eds))}
            onConnect={onConnect}
            onConnectStart={onConnectStart}
            onConnectEnd={onConnectEnd}
            onNodeClick={handleNodeClick}
            onEdgeClick={handleEdgeClick}
            onPaneClick={() => {
              setSelectedId(null);
              setSelectedEdgeId(null);
            }}
            defaultViewport={{ x: 0, y: 0, zoom: 1 }}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
          >
            {/* SVG marker for arrowhead */}
            <svg style={{ position: 'absolute', width: 0, height: 0 }}>
              <defs>
                <marker
                  id="arrowhead"
                  markerWidth="25"
                  markerHeight="25"
                  viewBox="-12 -12 24 24"
                  orient="auto"
                  refX="8"
                  refY="0"
                  markerUnits="strokeWidth"
                >
                  <path
                    stroke="#1e40af"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    fill="#1e40af"
                    d="M-8,-6 L0,0 L-8,6 L-5,0 z"
                  />
                </marker>
                {/* Marker for residual/skip connections */}
                <marker
                  id="residual-arrow"
                  markerWidth="25"
                  markerHeight="25"
                  viewBox="-12 -12 24 24"
                  orient="auto"
                  refX="8"
                  refY="0"
                  markerUnits="strokeWidth"
                >
                  <path
                    stroke="#059669"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    fill="#059669"
                    d="M-8,-6 L0,0 L-8,6 L-5,0 z"
                  />
                </marker>
                {/* Marker for sum/merge connections */}
                <marker
                  id="sum-arrow"
                  markerWidth="25"
                  markerHeight="25"
                  viewBox="-12 -12 24 24"
                  orient="auto"
                  refX="8"
                  refY="0"
                  markerUnits="strokeWidth"
                >
                  <circle
                    cx="0"
                    cy="0"
                    r="6"
                    stroke="#dc2626"
                    strokeWidth="2"
                    fill="#fef2f2"
                  />
                  <text
                    x="0"
                    y="2"
                    textAnchor="middle"
                    fontSize="8"
                    fontWeight="bold"
                    fill="#dc2626"
                  >
                    +
                  </text>
                </marker>
              </defs>
            </svg>
            <MiniMap />
            <Controls />
            <Background gap={16} />
          </ReactFlow>
        )}
        {/* Bottom toolbar */}
        <div className="fixed bottom-0 left-0 w-full flex justify-center items-center bg-white border-t py-2 z-20 shadow gap-2">
          {/* Edge type selector - only show in model mode */}
          {mode === 'model' && (
            <div className="flex items-center gap-2 mr-4">
              <span className="text-sm font-medium text-gray-900">
                {selectedEdgeId ? "Selected Edge Type:" : "Edge Type:"}
              </span>
              <select 
                value={edgeType} 
                onChange={(e) => {
                  const newType = e.target.value as 'default' | 'residual' | 'sum';
                  setEdgeType(newType);
                  
                  // If an edge is selected, update its type
                  if (selectedEdgeId) {
                    setEdges((eds: Edge[]) => 
                      eds.map(edge => 
                        edge.id === selectedEdgeId 
                          ? { ...edge, type: newType }
                          : edge
                      )
                    );
                  }
                }}
                className={`text-sm border border-gray-300 rounded px-2 py-1 bg-white text-gray-900 ${
                  selectedEdgeId ? 'ring-2 ring-blue-200 border-blue-300' : ''
                }`}
              >
                <option value="default">Default</option>
                <option value="residual">Residual</option>
                <option value="sum">Sum</option>
              </select>
            </div>
          )}
          
          {/* Mode buttons */}
          <button
            className={`mx-2 p-2 rounded-full border-2 ${mode === 'model' ? 'bg-blue-100 border-blue-600' : 'bg-gray-100 border-gray-300'} transition-colors`}
            onClick={() => {
              setMode('model');
              // Reset edge type when switching modes
              if (mode !== 'model') setEdgeType('default');
            }}
            title="Model Mode"
          >
            <FaProjectDiagram className={mode === 'model' ? 'text-blue-700' : 'text-gray-700'} />
          </button>
          <button
            className={`mx-2 p-2 rounded-full border-2 ${mode === 'training' ? 'bg-blue-100 border-blue-600' : 'bg-gray-100 border-gray-300'} transition-colors ${!hasDatasetNode ? 'opacity-50 cursor-not-allowed' : ''}`}
            onClick={() => {
              if (hasDatasetNode) {
                setMode('training');
                // Reset edge type when switching to training mode
                setEdgeType('default');
              }
            }}
            title={hasDatasetNode ? 'Training Mode' : 'Add a dataset node first'}
            disabled={!hasDatasetNode}
          >
            <FaCog className={mode === 'training' ? 'text-blue-700' : 'text-gray-700'} />
          </button>
          <button
            className={`mx-2 p-2 rounded-full border-2 ${mode === 'code' ? 'bg-blue-100 border-blue-600' : 'bg-gray-100 border-gray-300'} transition-colors`}
            onClick={() => {
              setMode('code');
              // Reset edge type when switching modes
              if (mode === 'model') setEdgeType('default');
            }}
            title="Code Mode"
          >
            <FaCode className={mode === 'code' ? 'text-blue-700' : 'text-gray-700'} />
          </button>
        </div>
      </div>

      {/* Validation Error Display */}
      {validationError && (
        <div className={`fixed top-4 right-4 max-w-md rounded-lg p-4 shadow-lg z-50 ${
          validationError.includes('warnings') 
            ? 'bg-yellow-50 border border-yellow-200' 
            : 'bg-red-50 border border-red-200'
        }`}>
          <div className="flex items-start gap-3">
            <div className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center ${
              validationError.includes('warnings') 
                ? 'bg-yellow-100' 
                : 'bg-red-100'
            }`}>
              <FaQuestionCircle className={`w-3 h-3 ${
                validationError.includes('warnings') 
                  ? 'text-yellow-600' 
                  : 'text-red-600'
              }`} />
            </div>
            <div className="flex-1">
              <h3 className={`text-sm font-semibold mb-1 ${
                validationError.includes('warnings') 
                  ? 'text-yellow-800' 
                  : 'text-red-800'
              }`}>
                {validationError.includes('Cannot generate code') 
                  ? 'Validation Error' 
                  : validationError.includes('warnings')
                  ? 'Code Generated with Warnings'
                  : 'Connection Error'}
              </h3>
              <p className={`text-sm whitespace-pre-line ${
                validationError.includes('warnings') 
                  ? 'text-yellow-700' 
                  : 'text-red-700'
              }`}>
                {validationError}
              </p>
              <button 
                onClick={() => setValidationError(null)}
                className={`mt-2 text-xs hover:underline ${
                  validationError.includes('warnings') 
                    ? 'text-yellow-600 hover:text-yellow-800' 
                    : 'text-red-600 hover:text-red-800'
                }`}
              >
                Dismiss
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Right-click Hint */}
      {mode !== 'code' && (
        <div className="fixed top-4 left-4 bg-blue-50 border border-blue-200 rounded-lg p-3 shadow-lg z-40">
          <div className="flex items-center gap-2">
            <FaQuestionCircle className="w-4 h-4 text-blue-600" />
            <span className="text-sm text-blue-800">
              <strong>Tip:</strong> Right-click on toolbar items for more info!
            </span>
          </div>
        </div>
      )}

      {selectedId && mode !== 'code' && (
        <PropertyPanel nodeId={selectedId} onClose={() => setSelectedId(null)} />
      )}

      {/* Execution Explanation Popup */}
      {showExecutionPopup && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md mx-4 shadow-xl">
            <div className="flex items-start gap-3 mb-4">
              <div className="flex-shrink-0 w-8 h-8 bg-orange-100 rounded-full flex items-center justify-center">
                <FaQuestionCircle className="w-4 h-4 text-orange-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  Why is Code Execution Disabled?
                </h3>
                <div className="text-gray-600 space-y-3">
                  <p>
                    <strong>Code execution has been permanently removed</strong> because it required expensive cloud resources to run PyTorch training.
                  </p>
                  <p>
                    As the creator, I felt uncomfortable charging users for this feature since this is meant to be a <strong>free, open-source educational tool</strong> for learning neural network architectures.
                  </p>
                  <p>
                    Instead, you can:
                  </p>
                  <ul className="list-disc list-inside space-y-1 text-sm">
                    <li>Copy the generated PyTorch code</li>
                    <li>Run it in your local environment</li>
                    <li>Use Google Colab (free GPU access)</li>
                    <li>Upload to Kaggle notebooks</li>
                  </ul>
                  <p className="text-sm italic">
                    This keeps the tool completely free for everyone! 🎓
                  </p>
                </div>
              </div>
            </div>
            <div className="flex justify-end">
              <button
                onClick={() => setShowExecutionPopup(false)}
                className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
              >
                Got it!
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default function FlowCanvas() {
  return (
    <ReactFlowProvider>
      <FlowCanvasInner />
    </ReactFlowProvider>
  );
}
