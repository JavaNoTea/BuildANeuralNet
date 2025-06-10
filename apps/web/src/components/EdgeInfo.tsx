import { EdgeProps, getBezierPath, Node, useNodes, useEdges } from 'reactflow';
import { layerRegistry, LayerMeta } from '@/lib/layerRegistry';
import { trainingRegistry, TrainingMeta } from '@/lib/trainingRegistry';
import { DATASET_SHAPES } from '@/lib/constants';

// Dataset output shapes
const datasetShapes: Record<string, { shape: number[]; type: string }> = {
  'torchvision.datasets.MNIST': { shape: [1, 28, 28], type: 'float32' },
  'torchvision.datasets.FashionMNIST': { shape: [1, 28, 28], type: 'float32' },
  'torchvision.datasets.CIFAR10': { shape: [3, 32, 32], type: 'float32' },
  'torchvision.datasets.CIFAR100': { shape: [3, 32, 32], type: 'float32' },
  'torchvision.datasets.ImageNet': { shape: [3, 224, 224], type: 'float32' },
  'torchvision.datasets.SVHN': { shape: [3, 32, 32], type: 'float32' },
  'torchvision.datasets.EMNIST': { shape: [1, 28, 28], type: 'float32' },
  'torchvision.datasets.KMNIST': { shape: [1, 28, 28], type: 'float32' },
  'torchvision.datasets.QMNIST': { shape: [1, 28, 28], type: 'float32' },
  'torchvision.datasets.STL10': { shape: [3, 96, 96], type: 'float32' },
  'torchvision.datasets.CelebA': { shape: [3, 218, 178], type: 'float32' },
};

interface NodeData {
  registryKey: string;
  label: string;
  params: Record<string, any>;
  shape?: number[];
  isTraining?: boolean;
}

interface CommonMeta {
  outputType: string;
  outputShape: string | number[];
  inputType: string | undefined;
  inputShape: string | undefined;
  category: string;
  outputTypes?: string[];
}

type NodeMeta = CommonMeta;

// Helper function to validate image data shape
function isValidImageShape(shape: string | number[]): boolean {
  const shapeStr = Array.isArray(shape) ? `[${shape.join(', ')}]` : shape;
  // Shape should be [N, C, H, W] or [C, H, W]
  const dimensions = shapeStr.replace(/[\[\]]/g, '').split(',').map(s => s.trim());
  return (dimensions.length === 4 || dimensions.length === 3) && 
         dimensions.every(d => d === 'N' || d === 'C' || d === 'H' || d === 'W' || !isNaN(parseInt(d)));
}

// Helper function to get shape dimensions
function getShapeDimensions(shape: string | number[]): { channels: number, height: number, width: number } | null {
  const shapeStr = Array.isArray(shape) ? `[${shape.join(', ')}]` : shape;
  const dims = shapeStr.replace(/[\[\]]/g, '').split(',').map(s => s.trim());
  // Handle both [N, C, H, W] and [C, H, W] formats
  const [c, h, w] = dims.length === 4 ? dims.slice(1) : dims;
  const channels = parseInt(c);
  const height = parseInt(h);
  const width = parseInt(w);
  
  if (isNaN(channels) || isNaN(height) || isNaN(width)) return null;
  return { channels, height, width };
}

// Get input shape for a node by traversing backwards through the network
function getInputShapeForNode(nodeId: string, nodes: Node<NodeData>[], edges: any[]): number[] | null {
  const node = nodes.find(n => n.id === nodeId);
  if (!node) return null;

  // If it's a dataset node, return its shape directly
  if (node.data.registryKey === 'input.dataset') {
    return datasetShapes[node.data.params.dataset].shape;
  }

  // Find incoming edges
  const incomingEdges = edges.filter(e => e.target === nodeId);
  if (incomingEdges.length === 0) return null;

  // For sum operations (torch.add), all inputs must have the same shape
  if (node.data.registryKey === 'torch.add') {
    if (incomingEdges.length < 2) return null; // Need at least 2 inputs
    
    const shapes = incomingEdges.map(edge => {
      const sourceShape = getInputShapeForNode(edge.source, nodes, edges);
      if (!sourceShape) return null;
      const sourceNode = nodes.find(n => n.id === edge.source);
      return sourceNode ? getOutputShape(sourceNode, sourceShape) : null;
    });
    
    // Check if all shapes are the same
    if (shapes.some(s => !s) || !shapes.every(s => JSON.stringify(s) === JSON.stringify(shapes[0]))) {
      return null; // Invalid - shapes don't match
    }
    
    return shapes[0];
  }

  // For concatenation (torch.cat), collect all input shapes
  if (node.data.registryKey === 'torch.cat') {
    if (incomingEdges.length < 2) return null; // Need at least 2 inputs
    
    const shapes = incomingEdges.map(edge => {
      const sourceShape = getInputShapeForNode(edge.source, nodes, edges);
      if (!sourceShape) return null;
      const sourceNode = nodes.find(n => n.id === edge.source);
      return sourceNode ? getOutputShape(sourceNode, sourceShape) : null;
    });
    
    if (shapes.some(s => !s)) return null;
    
    // For concatenation, return the first shape (we'll handle the actual concatenation in getOutputShape)
    return shapes[0];
  }

  // For single input operations, use the first (and should be only) incoming edge
  const incomingEdge = incomingEdges[0];
  
  // Get shape from source node
  const sourceShape = getInputShapeForNode(incomingEdge.source, nodes, edges);
  if (!sourceShape) return null;

  // Get the source node to calculate its output shape
  const sourceNode = nodes.find(n => n.id === incomingEdge.source);
  if (!sourceNode) return null;

  return getOutputShape(sourceNode, sourceShape);
}

// Get output shape for a layer given its input shape
function getOutputShape(layer: Node<NodeData>, inputShape: number[]): number[] {
  const params = layer.data.params;
  
  switch (layer.data.registryKey) {
    case 'input.dataset':
      return DATASET_SHAPES[layer.data.params.dataset].shape;
    case 'torch.add':
      // Addition preserves the input shape
      return inputShape;
    case 'torch.cat':
      // Concatenation changes the dimension being concatenated
      const dim = params.dim || 1;
      // For now, assume concatenating 2 inputs - in practice, this would need
      // to be calculated based on all incoming edges
      const newShape = [...inputShape];
      newShape[dim] = newShape[dim] * 2; // Simplified - would need actual edge count
      return newShape;
    case 'torch.nn.Linear':
      return [params.out_features];
    case 'torch.nn.Conv1d':
      return [
        params.out_channels,
        Math.floor((inputShape[1] + 2 * params.padding - params.kernel_size) / params.stride + 1)
      ];
    case 'torch.nn.Conv2d':
      return [
        params.out_channels,
        Math.floor((inputShape[1] + 2 * params.padding - params.kernel_size) / params.stride + 1),
        Math.floor((inputShape[2] + 2 * params.padding - params.kernel_size) / params.stride + 1)
      ];
    case 'torch.nn.Conv3d':
      return [
        params.out_channels,
        Math.floor((inputShape[1] + 2 * params.padding - params.kernel_size) / params.stride + 1),
        Math.floor((inputShape[2] + 2 * params.padding - params.kernel_size) / params.stride + 1),
        Math.floor((inputShape[3] + 2 * params.padding - params.kernel_size) / params.stride + 1)
      ];
    case 'torch.nn.MaxPool2d':
    case 'torch.nn.AvgPool2d':
      return [
        inputShape[0],
        Math.floor((inputShape[1] - params.kernel_size) / params.stride + 1),
        Math.floor((inputShape[2] - params.kernel_size) / params.stride + 1)
      ];
    case 'torch.nn.Flatten':
      return [inputShape.reduce((a, b) => a * b, 1)];
    case 'torch.nn.BatchNorm1d':
      return inputShape;
    case 'torch.nn.BatchNorm2d':
      return inputShape;
    case 'torch.nn.LayerNorm':
      return inputShape;
    default:
      // For layers that don't change shape (ReLU, BatchNorm, etc)
      return inputShape;
  }
}

// Get input/output shapes for a connection
function getConnectionShapes(sourceNode: Node<NodeData> | null, targetNode: Node<NodeData> | null, nodes: Node<NodeData>[], edges: any[]): {
  inputShape: number[] | null;
  outputShape: number[] | null;
} {
  if (!sourceNode || !targetNode) {
    return { inputShape: null, outputShape: null };
  }

  // Get input shape by traversing backwards from source node
  const inputShape = getInputShapeForNode(sourceNode.id, nodes, edges);
  if (!inputShape) return { inputShape: null, outputShape: null };

  // Calculate output shape based on source node's transformation
  const outputShape = getOutputShape(sourceNode, inputShape);

  return { inputShape, outputShape };
}

// Check if connection is valid
function isValidConnection(sourceNode: Node<NodeData> | null, targetNode: Node<NodeData> | null, nodes: Node<NodeData>[], edges: any[]): { valid: boolean; reason?: string } {
  if (!sourceNode || !targetNode) return { valid: false, reason: 'Missing nodes' };

  // Get the appropriate registry based on whether this is a training node
  const getNodeMeta = (node: Node<NodeData>): NodeMeta => {
    if (node.data.registryKey === 'input.dataset') {
      return {
        outputType: 'dataset',
        outputShape: node.data.shape || '[N, C, H, W]',
        inputType: undefined,
        inputShape: undefined,
        category: 'DataAugmentation'
      };
    }
    const meta = node.data.isTraining 
      ? trainingRegistry.find(l => l.torchClass === node.data.registryKey)
      : layerRegistry.find(l => l.torchClass === node.data.registryKey);
    
    if (!meta) {
      return {
        outputType: 'unknown',
        outputShape: '',
        inputType: undefined,
        inputShape: undefined,
        category: 'unknown'
      };
    }
    return meta as NodeMeta;
  };

  const sourceMeta = getNodeMeta(sourceNode);
  const nodeMeta = getNodeMeta(targetNode);

  // Rest of the validation logic...
  const { outputShape } = getConnectionShapes(sourceNode, targetNode, nodes, edges);
  if (!outputShape) return { valid: false, reason: 'Cannot determine shape' };

  // If these are training nodes, validate based on training rules
  if (sourceNode.data.isTraining && targetNode.data.isTraining) {
    // --- DYNAMIC OUTPUT TYPE LOGIC FOR TRAINING CONFIG ---
    const isTrainingConfig = sourceNode.data.registryKey === 'training.Config';
    const isMetricTarget = nodeMeta.category === 'Metrics';
    const isOptimizerTarget = nodeMeta.category === 'Optimization';
    let sourceOutputType = sourceMeta.outputType;
    const sourceOutputTypes = sourceMeta.outputTypes || [];
    if (isTrainingConfig) {
      if (isMetricTarget) {
        sourceOutputType = 'prediction';
      } else if (isOptimizerTarget) {
        sourceOutputType = 'trainable';
      }
    }
    // Check if output type of source matches input type of target
    if (!(sourceOutputType === nodeMeta.inputType || sourceOutputTypes.includes(nodeMeta.inputType || ''))) {
      return { valid: false, reason: `Type mismatch: ${sourceOutputType} -> ${nodeMeta.inputType}` };
    }

    // For data augmentation nodes, validate image shape
    if (nodeMeta.category === 'DataAugmentation') {
      if (!isValidImageShape(outputShape)) {
        return { valid: false, reason: `Invalid image shape: ${outputShape}` };
      }

      const dims = getShapeDimensions(outputShape);
      if (!dims) {
        return { valid: false, reason: 'Could not parse shape dimensions' };
      }

      // Validate specific augmentation requirements
      switch (targetNode.data.registryKey) {
        case 'transforms.RandomRotation':
        case 'transforms.RandomHorizontalFlip':
        case 'transforms.RandomVerticalFlip':
          if (dims.height <= 1 || dims.width <= 1) {
            return { valid: false, reason: `Transform ${targetNode.data.registryKey} requires 2D image data` };
          }
          break;

        case 'transforms.ColorJitter':
          if (dims.channels !== 1 && dims.channels !== 3) {
            return { valid: false, reason: `ColorJitter requires 1 or 3 channels, got ${dims.channels}` };
          }
          break;

        case 'transforms.Normalize':
          try {
            const mean = JSON.parse(targetNode.data.params.mean || '[0.485, 0.456, 0.406]');
            const std = JSON.parse(targetNode.data.params.std || '[0.229, 0.224, 0.225]');
            if (mean.length !== dims.channels || std.length !== dims.channels) {
              return { valid: false, reason: `Normalize parameters don't match channel count` };
            }
          } catch (e) {
            return { valid: false, reason: 'Invalid Normalize parameters' };
          }
          break;

        case 'transforms.RandomResizedCrop':
          if (dims.height < targetNode.data.params.size || dims.width < targetNode.data.params.size) {
            return { valid: false, reason: `Image too small for crop size` };
          }
          break;
      }
    }

    return { valid: true };
  }

  // For model nodes, use the existing layer validation
  // Check target layer compatibility
  const targetMeta = layerRegistry.find(l => l.torchClass === targetNode.data.registryKey);
  if (!targetMeta) return { valid: false, reason: 'Invalid target layer' };

  // Check specific layer requirements
  switch (targetNode.data.registryKey) {
    // Input processing layers
    case 'torch.nn.Flatten':
      const startDim = targetNode.data.params.start_dim || 1;
      const endDim = targetNode.data.params.end_dim || -1;
      
      if (startDim >= outputShape.length) {
        return { valid: false, reason: `start_dim (${startDim}) must be less than input dimensions (${outputShape.length})` };
      }
      if (endDim !== -1 && endDim < startDim) {
        return { valid: false, reason: `end_dim (${endDim}) must be greater than or equal to start_dim (${startDim})` };
      }
      if (endDim !== -1 && endDim >= outputShape.length) {
        return { valid: false, reason: `end_dim (${endDim}) must be less than input dimensions (${outputShape.length})` };
      }
      break;

    case 'torch.nn.Embedding':
      // Embedding expects 1D input of indices
      if (outputShape.length !== 1) {
        return { valid: false, reason: 'Embedding layer expects 1D input of indices' };
      }
      break;

    // Linear layers
    case 'torch.nn.Linear':
      if (outputShape.length > 1) {
        return { valid: false, reason: 'Linear layer expects 1D input' };
      }
      if (outputShape[0] !== targetNode.data.params.in_features) {
        return { valid: false, reason: `Input features mismatch: ${outputShape[0]} ≠ ${targetNode.data.params.in_features}` };
      }
      break;

    // Convolutional layers
    case 'torch.nn.Conv1d':
      if (outputShape.length !== 2) {
        return { valid: false, reason: 'Conv1d expects 2D input (C,L)' };
      }
      if (outputShape[0] !== targetNode.data.params.in_channels) {
        return { valid: false, reason: `Input channels mismatch: ${outputShape[0]} ≠ ${targetNode.data.params.in_channels}` };
      }
      // Check if input length is sufficient for kernel size
      if (outputShape[1] < targetNode.data.params.kernel_size) {
        return { valid: false, reason: `Input length (${outputShape[1]}) must be >= kernel size (${targetNode.data.params.kernel_size})` };
      }
      break;

    case 'torch.nn.Conv2d':
      if (outputShape.length !== 3) {
        return { valid: false, reason: 'Conv2d expects 3D input (C,H,W)' };
      }
      if (outputShape[0] !== targetNode.data.params.in_channels) {
        return { valid: false, reason: `Input channels mismatch: ${outputShape[0]} ≠ ${targetNode.data.params.in_channels}` };
      }
      // Check if input dimensions are sufficient for kernel size
      if (outputShape[1] < targetNode.data.params.kernel_size || outputShape[2] < targetNode.data.params.kernel_size) {
        return { valid: false, reason: `Input dimensions (${outputShape[1]}x${outputShape[2]}) must be >= kernel size (${targetNode.data.params.kernel_size})` };
      }
      break;

    case 'torch.nn.Conv3d':
      if (outputShape.length !== 4) {
        return { valid: false, reason: 'Conv3d expects 4D input (C,D,H,W)' };
      }
      if (outputShape[0] !== targetNode.data.params.in_channels) {
        return { valid: false, reason: `Input channels mismatch: ${outputShape[0]} ≠ ${targetNode.data.params.in_channels}` };
      }
      // Check if input dimensions are sufficient for kernel size
      if (outputShape[1] < targetNode.data.params.kernel_size || 
          outputShape[2] < targetNode.data.params.kernel_size || 
          outputShape[3] < targetNode.data.params.kernel_size) {
        return { valid: false, reason: `Input dimensions must be >= kernel size (${targetNode.data.params.kernel_size})` };
      }
      break;

    // Pooling layers
    case 'torch.nn.MaxPool1d':
    case 'torch.nn.AvgPool1d':
      if (outputShape.length !== 2) {
        return { valid: false, reason: `${targetNode.data.registryKey.split('.').pop()} expects 2D input (C,L)` };
      }
      if (outputShape[1] < targetNode.data.params.kernel_size) {
        return { valid: false, reason: `Input length (${outputShape[1]}) must be >= kernel size (${targetNode.data.params.kernel_size})` };
      }
      break;

    case 'torch.nn.MaxPool2d':
    case 'torch.nn.AvgPool2d':
      if (outputShape.length !== 3) {
        return { valid: false, reason: `${targetNode.data.registryKey.split('.').pop()} expects 3D input (C,H,W)` };
      }
      if (outputShape[1] < targetNode.data.params.kernel_size || outputShape[2] < targetNode.data.params.kernel_size) {
        return { valid: false, reason: `Input dimensions (${outputShape[1]}x${outputShape[2]}) must be >= kernel size (${targetNode.data.params.kernel_size})` };
      }
      break;

    case 'torch.nn.MaxPool3d':
    case 'torch.nn.AvgPool3d':
      if (outputShape.length !== 4) {
        return { valid: false, reason: `${targetNode.data.registryKey.split('.').pop()} expects 4D input (C,D,H,W)` };
      }
      if (outputShape[1] < targetNode.data.params.kernel_size || 
          outputShape[2] < targetNode.data.params.kernel_size || 
          outputShape[3] < targetNode.data.params.kernel_size) {
        return { valid: false, reason: `Input dimensions must be >= kernel size (${targetNode.data.params.kernel_size})` };
      }
      break;

    case 'torch.nn.AdaptiveAvgPool2d':
      if (outputShape.length !== 3) {
        return { valid: false, reason: 'AdaptiveAvgPool2d expects 3D input (C,H,W)' };
      }
      break;

    // Normalization layers
    case 'torch.nn.BatchNorm1d':
      if (outputShape.length !== 2) {
        return { valid: false, reason: 'BatchNorm1d expects 2D input (N,C) or 3D input (N,C,L)' };
      }
      if (outputShape[0] !== targetNode.data.params.num_features) {
        return { valid: false, reason: `Number of features mismatch: ${outputShape[0]} ≠ ${targetNode.data.params.num_features}` };
      }
      break;

    case 'torch.nn.BatchNorm2d':
      if (outputShape.length !== 3) {
        return { valid: false, reason: 'BatchNorm2d expects 3D input (N,C,H,W)' };
      }
      if (outputShape[0] !== targetNode.data.params.num_features) {
        return { valid: false, reason: `Number of features mismatch: ${outputShape[0]} ≠ ${targetNode.data.params.num_features}` };
      }
      break;

    case 'torch.nn.LayerNorm':
      if (outputShape.length < 1) {
        return { valid: false, reason: 'LayerNorm expects at least 1D input' };
      }
      const lastDim = outputShape[outputShape.length - 1];
      if (lastDim !== targetNode.data.params.normalized_shape) {
        return { valid: false, reason: `Last dimension mismatch: ${lastDim} ≠ ${targetNode.data.params.normalized_shape}` };
      }
      break;

    case 'torch.nn.GroupNorm':
      if (outputShape.length < 2) {
        return { valid: false, reason: 'GroupNorm expects at least 2D input (N,C,*)' };
      }
      if (outputShape[0] !== targetNode.data.params.num_channels) {
        return { valid: false, reason: `Number of channels mismatch: ${outputShape[0]} ≠ ${targetNode.data.params.num_channels}` };
      }
      if (targetNode.data.params.num_channels % targetNode.data.params.num_groups !== 0) {
        return { valid: false, reason: `Number of channels (${targetNode.data.params.num_channels}) must be divisible by number of groups (${targetNode.data.params.num_groups})` };
      }
      break;

    // Recurrent layers
    case 'torch.nn.LSTM':
    case 'torch.nn.GRU':
    case 'torch.nn.RNN':
      if (outputShape.length !== 1) {
        return { valid: false, reason: `${targetNode.data.registryKey.split('.').pop()} expects 1D input for feature size` };
      }
      if (outputShape[0] !== targetNode.data.params.input_size) {
        return { valid: false, reason: `Input size mismatch: ${outputShape[0]} ≠ ${targetNode.data.params.input_size}` };
      }
      break;

    // Activation functions - most are shape-preserving but some have specific requirements
    case 'torch.nn.Softmax':
      if (targetNode.data.params.dim >= outputShape.length) {
        return { valid: false, reason: `Softmax dimension (${targetNode.data.params.dim}) must be less than input dimensions (${outputShape.length})` };
      }
      break;
  }

  return { valid: true };
}

export default function EdgeInfo({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  source,
  target,
  selected,
  markerEnd,
  data,
}: EdgeProps & { data?: { type?: 'default' | 'residual' | 'sum' } }) {
  const nodes = useNodes() as Node<NodeData>[];
  const edges = useEdges();
  const sourceNode = nodes.find(n => n.id === source) as Node<NodeData> | null;
  const targetNode = nodes.find(n => n.id === target) as Node<NodeData> | null;

  // Check connection validity first
  const connectionValidity = isValidConnection(sourceNode, targetNode, nodes, edges);

  // Determine edge type and styling
  // Force default type for training mode edges
  const isTrainingEdge = sourceNode?.data.isTraining || targetNode?.data.isTraining;
  const edgeType = isTrainingEdge ? 'default' : (data?.type || 'default');
  
  let strokeColor = '#1e40af'; // Default blue
  let strokeWidth = 2;
  let strokeDasharray = undefined;
  let markerId = 'arrowhead';
  
  if (edgeType === 'residual') {
    strokeColor = '#059669'; // Green for residual connections
    strokeWidth = 2;
    strokeDasharray = '5,5'; // Dashed line for residual
    markerId = 'residual-arrow';
  } else if (edgeType === 'sum') {
    strokeColor = '#dc2626'; // Red for sum connections
    strokeWidth = 3;
    markerId = 'sum-arrow';
  }

  // Override stroke color for invalid connections
  if (!connectionValidity.valid) {
    strokeColor = '#dc2626'; // Red for invalid connections
  }

  // Enhanced selection styling
  if (selected) {
    strokeWidth += 2; // Make selected edges thicker
    // Add a subtle glow effect for selected edges
  }

  // Calculate the center point of the edge
  const centerX = (sourceX + targetX) / 2;
  const centerY = (sourceY + targetY) / 2;

  // Calculate edge angle for label rotation
  const dx = targetX - sourceX;
  const dy = targetY - sourceY;
  const angle = Math.atan2(dy, dx);

  // Function to check if a box intersects with any node
  const checkNodeIntersection = (x: number, y: number, width: number, height: number) => {
    const boxBuffer = 20; // Buffer space around nodes
    const labelBox = {
      left: x - width / 2,
      right: x + width / 2,
      top: y,
      bottom: y + height
    };

    return nodes.some(node => {
      if (!node.position) return false;
      const nodeBox = {
        left: node.position.x - boxBuffer,
        right: node.position.x + 200 + boxBuffer, // Node width is 200
        top: node.position.y - boxBuffer,
        bottom: node.position.y + 60 + boxBuffer  // Node height is 60
      };

      return !(labelBox.right < nodeBox.left || 
               labelBox.left > nodeBox.right || 
               labelBox.bottom < nodeBox.top || 
               labelBox.top > nodeBox.bottom);
    });
  };

  // Find a good position for the label
  const findLabelPosition = () => {
    const labelWidth = 300;
    const labelHeight = 100;
    const minOffset = 40;
    const maxOffset = 200;
    const stepSize = 20;

    for (let offset = minOffset; offset <= maxOffset; offset += stepSize) {
      // Try above the edge
      const yPos = centerY - offset;
      if (!checkNodeIntersection(centerX, yPos, labelWidth, labelHeight)) {
        return { x: centerX, y: yPos, offset };
      }
      
      // Try below the edge if above doesn't work
      const yPosBelow = centerY + offset - labelHeight;
      if (!checkNodeIntersection(centerX, yPosBelow, labelWidth, labelHeight)) {
        return { x: centerX, y: yPosBelow, offset: -offset };
      }
    }

    // If no good position found, return the highest position
    return { x: centerX, y: centerY - maxOffset, offset: maxOffset };
  };

  const labelPosition = findLabelPosition();

  const [edgePath] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  // Get input/output information
  const { inputShape, outputShape } = getConnectionShapes(sourceNode, targetNode, nodes, edges);
  
  let inputInfo = 'Unknown';
  let outputInfo = 'Unknown';

  if (sourceNode) {
    if (sourceNode.data.registryKey === 'input.dataset') {
      const datasetInfo = datasetShapes[sourceNode.data.params.dataset];
      inputInfo = `${sourceNode.data.label} [${datasetInfo.shape.join(', ')}]`;
    } else {
      const meta = layerRegistry.find(l => l.torchClass === sourceNode.data.registryKey);
      if (meta && inputShape) {
        inputInfo = `${meta.friendly} [${inputShape.join(', ')}]`;
      }
    }
  }

  if (targetNode && outputShape) {
    const meta = layerRegistry.find(l => l.torchClass === targetNode.data.registryKey);
    if (meta) {
      outputInfo = `${meta.friendly} [${outputShape.join(', ')}]`;
    }
  }

  return (
    <g>
      {/* Wider invisible stroke for easier clicking - this goes first */}
      <path
        d={edgePath}
        strokeWidth={20}
        stroke="transparent"
        fill="none"
        style={{
          pointerEvents: 'stroke',
          cursor: 'pointer',
        }}
      />
      
      {/* Shadow/glow effect for selected edges */}
      {selected && (
        <path
          d={edgePath}
          strokeWidth={strokeWidth + 4}
          stroke={strokeColor}
          strokeDasharray={strokeDasharray}
          opacity={0.25}
          style={{
            filter: 'blur(4px)',
            pointerEvents: 'none',
          }}
        />
      )}
      
      {/* Main visible edge */}
      <path
        id={id}
        className="react-flow__edge-path"
        d={edgePath}
        strokeWidth={strokeWidth}
        stroke={strokeColor}
        strokeDasharray={strokeDasharray}
        markerEnd={`url(#${markerId})`}
        style={{
          transition: 'all 0.2s ease',
          pointerEvents: 'none', // Let the transparent path handle clicks
        }}
      />
      
      {/* Edge Label */}
      {(!connectionValidity.valid || selected) && (
        <foreignObject
          width={300}
          height={100}
          x={labelPosition.x - 150}
          y={labelPosition.y}
          className="edge-info-label"
          requiredExtensions="http://www.w3.org/1999/xhtml"
          style={{
            position: 'relative',
            zIndex: 1000,
          }}
        >
          <div
            className={`
              ${!connectionValidity.valid 
                ? 'bg-white p-2 rounded shadow-lg border border-red-200' 
                : selected 
                  ? 'bg-blue-50 p-2 rounded shadow-lg border border-blue-200' 
                  : ''
              }
              text-xs transform-gpu
            `}
            style={{
              position: 'absolute',
              left: '50%',
              transform: 'translateX(-50%)',
              width: 'fit-content',
              minWidth: '200px',
              maxWidth: '300px',
              transition: 'all 0.2s ease-out',
            }}
          >
            <div className="font-mono">
              <span className="text-gray-400">in:</span>{' '}
              <span className="text-gray-900">{inputInfo}</span>
            </div>
            <div className="font-mono">
              <span className="text-gray-400">out:</span>{' '}
              <span className="text-gray-900">{outputInfo}</span>
            </div>
            {!connectionValidity.valid && (
              <div className="text-red-600 mt-1 font-semibold">
                ⚠️ {connectionValidity.reason}
              </div>
            )}
            {selected && connectionValidity.valid && (
              <div className="text-blue-600 mt-1 font-semibold">
                📌 Edge Selected - {edgeType} connection
              </div>
            )}
          </div>
        </foreignObject>
      )}
    </g>
  );
} 