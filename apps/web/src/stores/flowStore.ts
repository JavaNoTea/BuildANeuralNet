import { create } from 'zustand';
import { Node, Edge, Connection } from 'reactflow';
import { trainingRegistry, TrainingMeta } from '@/lib/trainingRegistry';
import { layerRegistry } from '@/lib/layerRegistry';
import { DATASET_SHAPES } from '@/lib/constants';
import { saveProject, loadProject, SavedState, clearProject } from '@/lib/saveLoad';

type Mode = 'model' | 'training' | 'code';

// Validation result types for educational feedback
// These interfaces provide detailed error messages and suggested fixes
// to help users understand why connections fail and how to fix them
interface ValidationResult {
  isValid: boolean;
  errorMessage?: string;
  suggestedFix?: string;
}

interface CodeValidationResult {
  isValid: boolean;
  errors: string[];           // Critical issues preventing code generation
  warnings: string[];         // Non-critical issues that should be noted
  missingComponents: string[]; // Specific components needed to complete the network
}

interface FlowState {
  nodes: Node[];
  edges: Edge[];
  mode: Mode;
  code: string;
  setNodes: (nodes: Node[] | ((nodes: Node[]) => Node[])) => void;
  setEdges: (edges: Edge[] | ((edges: Edge[]) => Edge[])) => void;
  setMode: (mode: Mode) => void;
  setCode: (code: string) => void;
  modelNodes: Node[];
  trainingNodes: Node[];
  modelEdges: Edge[];
  trainingEdges: Edge[];
  setModelNodes: (nodes: Node[] | ((nodes: Node[]) => Node[])) => void;
  setTrainingNodes: (nodes: Node[] | ((nodes: Node[]) => Node[])) => void;
  isValidConnection: (connection: Connection) => boolean;
  validateConnection: (connection: Connection) => ValidationResult;
  validateForCodeGeneration: () => CodeValidationResult;
  saveProject: () => void;
  loadProject: () => Promise<void>;
  clearProject: () => void;
}

interface NodeMeta {
  inputType?: string;
  outputType?: string;
  outputTypes?: string[];
  inputShape?: string;
  outputShape?: string;
  category?: string;
}

interface NodeData {
  registryKey: string;
  label: string;
  params: Record<string, any>;
  isTraining?: boolean;
  shape?: string;
  dtype?: string;
  outputShape?: string;
  outputType?: string;
  outputTypes?: string[];
}

// Helper function to get node metadata
const getNodeMeta = (node: Node<NodeData>): NodeMeta | undefined => {
  if (node.data.registryKey === 'input.dataset') {
    const datasetKey = node.data.params?.dataset || 'torchvision.datasets.MNIST';
    const shape = DATASET_SHAPES[datasetKey]?.shape || [1, 28, 28];
    return {
      outputType: 'dataset',
      outputShape: `[N, ${shape.join(', ')}]`,
      inputType: undefined,
      inputShape: undefined,
      category: 'DataAugmentation'
    };
  }
  
  // Check if this is a training node
  if (node.data.isTraining) {
    const meta = trainingRegistry.find(l => l.torchClass === node.data.registryKey);
    if (meta) {
      // Special handling for Training Config node
      if (node.data.registryKey === 'training.config') {
        return {
          ...meta,
          outputType: 'prediction',  // Default to prediction for metrics
          outputTypes: ['trainable', 'prediction'],
          inputType: meta.inputType || undefined,
          inputShape: meta.inputShape || undefined,
          outputShape: meta.outputShape || undefined,
          category: meta.category
        };
      }
      return {
        ...meta,
        outputType: meta.outputType || undefined,
        outputTypes: meta.outputTypes,
        inputType: meta.inputType || undefined,
        inputShape: meta.inputShape || undefined,
        outputShape: meta.outputShape || undefined,
        category: meta.category
      };
    }
  }
  
  // For model nodes, use the layer registry
  return layerRegistry.find(l => l.torchClass === node.data.registryKey);
};

// Helper function to update node data with output information
const updateNodeData = (node: Node<NodeData>, sourceMeta: NodeMeta | undefined): Node<NodeData> => {
  if (!sourceMeta) return node;
  
  return {
    ...node,
    data: {
      ...node.data,
      outputShape: sourceMeta.outputShape,
      outputType: sourceMeta.outputType,
      outputTypes: sourceMeta.outputTypes
    }
  };
};

// Helper function to validate image data shape
const isValidImageShape = (shape: string): boolean => {
  // Shape should be [N, C, H, W] or [C, H, W]
  const dimensions = shape.replace(/[\[\]]/g, '').split(',').map(s => s.trim());
  return (dimensions.length === 4 || dimensions.length === 3) && 
         dimensions.every(d => d === 'N' || d === 'C' || d === 'H' || d === 'W' || !isNaN(parseInt(d)));
};

// Helper function to get shape dimensions
const getShapeDimensions = (shape: string): { channels: number, height: number, width: number } | null => {
  const dims = shape.replace(/[\[\]]/g, '').split(',').map(s => s.trim());
  
  // Handle both [N, C, H, W] and [C, H, W] formats
  const [c, h, w] = dims.length === 4 ? dims.slice(1) : dims;
  
  // If we have symbolic dimensions (N, C, H, W), use default values
  // Otherwise, parse the numeric values
  const channels = c === 'C' ? 3 : parseInt(c);
  const height = h === 'H' ? 28 : parseInt(h);
  const width = w === 'W' ? 28 : parseInt(w);
  
  // Validate the dimensions
  if (isNaN(channels) || channels <= 0 || 
      isNaN(height) || height <= 0 || 
      isNaN(width) || width <= 0) {
    return null;
  }

  return { channels, height, width };
};

// Helper function to validate a connection in training mode with detailed feedback
const validateTrainingConnection = (nodes: Node[], connection: Connection): ValidationResult => {
  if (!connection.source || !connection.target) {
    return {
      isValid: false,
      errorMessage: "Connection is missing source or target node",
      suggestedFix: "Make sure you are connecting from one node to another"
    };
  }

  const sourceNode = nodes.find(n => n.id === connection.source);
  const targetNode = nodes.find(n => n.id === connection.target);

  if (!sourceNode || !targetNode) {
    return {
      isValid: false,
      errorMessage: "Cannot find source or target node",
      suggestedFix: "Try refreshing the page or recreating the nodes"
    };
  }

  if (!sourceNode.data.isTraining || !targetNode.data.isTraining) {
    return {
      isValid: false,
      errorMessage: "Can only connect training nodes in training mode",
      suggestedFix: "Switch to model mode to connect model layers, or use training-specific nodes"
    };
  }

  const sourceMeta = getNodeMeta(sourceNode);
  const targetMeta = getNodeMeta(targetNode);

  if (!sourceMeta || !targetMeta) {
    return {
      isValid: false,
      errorMessage: "Node metadata not found",
      suggestedFix: "This node type may not be supported in training mode"
    };
  }

  // Special case for Training Config node
  const isTrainingConfig = sourceNode.data.registryKey === 'training.config';
  const isMetricTarget = targetMeta.category === 'Metrics';
  const isOptimizerTarget = targetMeta.category === 'Optimization';

  // Get type information
  const targetInputType = targetMeta.inputType;
  let sourceOutputType = sourceMeta.outputType;
  const sourceOutputTypes = sourceMeta.outputTypes || [];
  
  if (isTrainingConfig) {
    if (isMetricTarget) {
      sourceOutputType = 'prediction';
    } else if (isOptimizerTarget) {
      sourceOutputType = 'trainable';
    }
  }

  // Validate type compatibility
  const isValidType = sourceOutputType === targetInputType || sourceOutputTypes.includes(targetInputType || '');
  
  if (!isValidType) {
    return {
      isValid: false,
      errorMessage: `Type mismatch: ${sourceNode.data.label} outputs "${sourceOutputType}" but ${targetNode.data.label} expects "${targetInputType}"`,
      suggestedFix: `Try connecting to a node that accepts "${sourceOutputType}" input, or use a different source node that outputs "${targetInputType}"`
    };
  }

  // Validate workflow order
  let isValidWorkflow = false;
  let workflowError = "";
  
  if (sourceNode.data.registryKey === 'input.dataset') {
    isValidWorkflow = targetMeta.category === 'DataAugmentation' || targetMeta.category === 'Training';
    if (!isValidWorkflow) {
      workflowError = "Dataset can only connect to Data Augmentation or Training nodes";
    }
  } else if (sourceMeta.category === 'DataAugmentation') {
    isValidWorkflow = targetMeta.category === 'DataAugmentation' || targetMeta.category === 'Training';
    if (!isValidWorkflow) {
      workflowError = "Data Augmentation nodes can only connect to other Data Augmentation or Training nodes";
    }
  } else if (sourceMeta.category === 'Training') {
    isValidWorkflow = targetMeta.category === 'Optimization' || targetMeta.category === 'Metrics' || targetMeta.category === 'Callbacks';
    if (!isValidWorkflow) {
      workflowError = "Training nodes can only connect to Optimization, Metrics, or Callback nodes";
    }
  } else if (sourceMeta.category === 'Optimization') {
    isValidWorkflow = targetMeta.category === 'Training' || targetMeta.category === 'Callbacks';
    if (!isValidWorkflow) {
      workflowError = "Optimization nodes can only connect to Training or Callback nodes";
    }
  } else if (sourceMeta.category === 'Metrics') {
    isValidWorkflow = targetMeta.category === 'Callbacks';
    if (!isValidWorkflow) {
      workflowError = "Metrics nodes can only connect to Callback nodes";
    }
  } else if (sourceMeta.category === 'Callbacks') {
    workflowError = "Callback nodes cannot connect to other nodes (they are endpoints)";
  } else {
    workflowError = `Unknown category: ${sourceMeta.category}`;
  }

  if (!isValidWorkflow) {
    return {
      isValid: false,
      errorMessage: workflowError,
      suggestedFix: "Follow the training workflow: Dataset → Data Augmentation → Training → Optimization/Metrics → Callbacks"
    };
  }

  return { isValid: true };
};

// Helper function to check if a connection is valid in training mode (backward compatibility)
const isValidTrainingConnection = (nodes: Node[], connection: Connection): boolean => {
  return validateTrainingConnection(nodes, connection).isValid;
};

// Helper function to validate a connection in model mode with detailed feedback
const validateModelConnection = (nodes: Node[], connection: Connection): ValidationResult => {
  if (!connection.source || !connection.target) {
    return {
      isValid: false,
      errorMessage: "Connection is missing source or target node",
      suggestedFix: "Make sure you are connecting from one node to another"
    };
  }

  const sourceNode = nodes.find(n => n.id === connection.source);
  const targetNode = nodes.find(n => n.id === connection.target);

  if (!sourceNode || !targetNode) {
    return {
      isValid: false,
      errorMessage: "Cannot find source or target node",
      suggestedFix: "Try refreshing the page or recreating the nodes"
    };
  }

  // Only allow connections between model nodes (non-training nodes)
  if (sourceNode.data.isTraining || targetNode.data.isTraining) {
    return {
      isValid: false,
      errorMessage: "Cannot connect training nodes in model mode",
      suggestedFix: "Switch to training mode to connect training-specific nodes"
    };
  }

  // Dataset nodes can only be source nodes
  if (targetNode.data.registryKey === 'input.dataset') {
    return {
      isValid: false,
      errorMessage: "Cannot connect to a dataset node",
      suggestedFix: "Dataset nodes provide input data - connect FROM the dataset TO other layers"
    };
  }

  // Check if source node can connect to target node based on layer types
  const sourceMeta = getNodeMeta(sourceNode);
  const targetMeta = getNodeMeta(targetNode);

  if (!sourceMeta || !targetMeta) {
    return {
      isValid: false,
      errorMessage: "Node metadata not found",
      suggestedFix: "This node type may not be supported in model mode"
    };
  }

  // Shape compatibility check for specific layer types
  if (sourceNode.data.registryKey === 'input.dataset') {
    // Dataset can connect to any layer
    return { isValid: true };
  }

  // Check for shape compatibility warnings
  if (sourceMeta.outputShape && targetMeta.inputShape) {
    if (sourceMeta.outputShape !== targetMeta.inputShape && 
        !sourceMeta.outputShape.includes('N') && !targetMeta.inputShape.includes('N')) {
      return {
        isValid: false,
        errorMessage: `Shape mismatch: ${sourceNode.data.label} outputs ${sourceMeta.outputShape} but ${targetNode.data.label} expects ${targetMeta.inputShape}`,
        suggestedFix: "Add a reshape layer or adjust the layer parameters to match dimensions"
      };
    }
  }

  // Special cases for specific layer combinations
  if (sourceNode.data.registryKey === 'nn.Conv2d' && targetNode.data.registryKey === 'nn.Linear') {
    return {
      isValid: false,
      errorMessage: "Cannot directly connect Conv2d to Linear layer",
      suggestedFix: "Add a Flatten layer between Conv2d and Linear layers to reshape the tensor"
    };
  }

  if (sourceNode.data.registryKey === 'nn.Linear' && targetNode.data.registryKey === 'nn.Conv2d') {
    return {
      isValid: false,
      errorMessage: "Cannot directly connect Linear to Conv2d layer",
      suggestedFix: "Linear layers output 1D tensors while Conv2d expects 2D feature maps. Consider using Conv1d or adding reshape operations"
    };
  }

  return { isValid: true };
};

// Helper function to check if a connection is valid in model mode (backward compatibility)
const isValidModelConnection = (nodes: Node[], connection: Connection): boolean => {
  return validateModelConnection(nodes, connection).isValid;
};

// Helper function to create a training dataset node
const createTrainingDatasetNode = (modelDatasetNode: Node | undefined): Node => ({
  id: 'training-dataset',
  type: 'default',
  position: { x: 100, y: 100 },
  data: {
    registryKey: 'input.dataset',
    label: 'Training Dataset',
    params: modelDatasetNode 
      ? { ...modelDatasetNode.data.params }
      : { dataset: 'torchvision.datasets.MNIST' },
    isTraining: true,
    shape: modelDatasetNode?.data.shape,
    dtype: modelDatasetNode?.data.dtype,
  }
});

export const useFlowStore = create<FlowState>((set, get) => ({
  nodes: [],
  edges: [],
  mode: 'model',
  code: '# Click "Generate Code" to generate PyTorch code from your model',
  modelNodes: [],
  trainingNodes: [],
  modelEdges: [],
  trainingEdges: [],
  setNodes: (nodes) => set((state) => {
    const newNodes = typeof nodes === 'function' ? nodes(state.nodes) : nodes;
    
    // Update output information for all nodes based on their connections
    const updatedNodes = newNodes.map(node => {
      const incomingEdges = state.edges.filter(e => e.target === node.id);
      if (incomingEdges.length === 0) return node;

      const sourceNode = newNodes.find(n => n.id === incomingEdges[0].source);
      if (!sourceNode) return node;

      const sourceMeta = getNodeMeta(sourceNode);
      return updateNodeData(node, sourceMeta);
    });

    // Update the appropriate node list based on current mode
    return {
      nodes: updatedNodes,
      ...(state.mode === 'model' 
        ? { modelNodes: updatedNodes }
        : { trainingNodes: updatedNodes }
      )
    };
  }),
  setEdges: (edges) => set((state) => {
    const newEdges = typeof edges === 'function' ? edges(state.edges) : edges;
    
    // Update node output information
    const updatedNodes = state.nodes.map(node => {
      const incomingEdges = newEdges.filter(e => e.target === node.id);
      if (incomingEdges.length === 0) return node;

      const sourceNode = state.nodes.find(n => n.id === incomingEdges[0].source);
      if (!sourceNode) return node;

      const sourceMeta = getNodeMeta(sourceNode);
      return updateNodeData(node, sourceMeta);
    });

    // Update the appropriate edge list based on current mode
    return {
      edges: newEdges,
      nodes: updatedNodes,
      ...(state.mode === 'model'
        ? { modelEdges: newEdges, modelNodes: updatedNodes }
        : { trainingEdges: newEdges, trainingNodes: updatedNodes }
      )
    };
  }),
  setMode: (mode) => set((state) => {
    if (mode === 'training' && state.trainingNodes.length === 0) {
      const modelDatasetNode = state.modelNodes.find(n => n.data.registryKey === 'input.dataset');
      const trainingDatasetNode = createTrainingDatasetNode(modelDatasetNode);
      
      return {
        mode,
        trainingNodes: [trainingDatasetNode],
        nodes: [trainingDatasetNode],
        edges: []  // Only reset edges when first entering training mode
      };
    }

    if (mode === 'code') {
      // Preserve current state when entering code mode
      return { mode };
    }

    // When switching between model and training modes, use the appropriate nodes
    // but preserve the edges for each mode
    return { 
      mode,
      nodes: mode === 'model' ? state.modelNodes : state.trainingNodes,
      edges: mode === 'model' ? state.modelEdges || [] : state.trainingEdges || []
    };
  }),
  setModelNodes: (nodes) => set((state) => ({ 
    modelNodes: typeof nodes === 'function' ? nodes(state.modelNodes) : nodes,
    ...(state.mode === 'model' && { nodes: typeof nodes === 'function' ? nodes(state.modelNodes) : nodes })
  })),
  setTrainingNodes: (nodes) => set((state) => ({ 
    trainingNodes: typeof nodes === 'function' ? nodes(state.trainingNodes) : nodes,
    ...(state.mode === 'training' && { nodes: typeof nodes === 'function' ? nodes(state.trainingNodes) : nodes })
  })),
  setCode: (code) => set((state) => ({ code })),
  isValidConnection: (connection) => {
    const state = get();
    return state.mode === 'training' 
      ? isValidTrainingConnection(state.nodes, connection)
      : isValidModelConnection(state.nodes, connection);
  },
  validateConnection: (connection) => {
    const state = get();
    return state.mode === 'training' 
      ? validateTrainingConnection(state.nodes, connection)
      : validateModelConnection(state.nodes, connection);
  },
  validateForCodeGeneration: () => {
    const state = get();
    const errors: string[] = [];
    const warnings: string[] = [];
    const missingComponents: string[] = [];

    // Check for dataset node
    const datasetNodes = state.nodes.filter(n => n.data.registryKey === 'input.dataset');
    if (datasetNodes.length === 0) {
      errors.push("No dataset node found");
      missingComponents.push("Add a Dataset node to provide input data");
    } else if (datasetNodes.length > 1) {
      warnings.push("Multiple dataset nodes found - only the first one will be used");
    }

    // Check for model layers (non-dataset, non-training nodes)
    const modelLayers = state.nodes.filter(n => 
      n.data.registryKey !== 'input.dataset' && !n.data.isTraining
    );
    if (state.mode === 'model' && modelLayers.length === 0) {
      errors.push("No model layers found");
      missingComponents.push("Add neural network layers (Conv2d, Linear, etc.) to build your model");
    }

    // Check for disconnected nodes
    const disconnectedNodes = state.nodes.filter(node => {
      const hasIncoming = state.edges.some(edge => edge.target === node.id);
      const hasOutgoing = state.edges.some(edge => edge.source === node.id);
      
      // Dataset nodes only need outgoing connections
      if (node.data.registryKey === 'input.dataset') {
        return !hasOutgoing;
      }
      
      // Training callbacks only need incoming connections
      if (node.data.isTraining) {
        const meta = getNodeMeta(node);
        if (meta?.category === 'Callbacks') {
          return !hasIncoming;
        }
      }
      
      // All other nodes should have both incoming and outgoing (except final output layers)
      return !hasIncoming;
    });

    if (disconnectedNodes.length > 0) {
      const nodeNames = disconnectedNodes.map(n => n.data.label).join(', ');
      warnings.push(`Disconnected nodes found: ${nodeNames}`);
      missingComponents.push("Connect all nodes in your network - data should flow from dataset through all layers");
    }

    // Check for missing parameters
    const nodesWithMissingParams = state.nodes.filter(node => {
      const meta = getNodeMeta(node);
      if (!meta) return false;
      
      // Check if required parameters are missing or empty
      const params = node.data.params || {};
      
      // Example: Conv2d requires out_channels
      if (node.data.registryKey === 'nn.Conv2d' && (!params.out_channels || params.out_channels <= 0)) {
        return true;
      }
      
      // Example: Linear requires out_features
      if (node.data.registryKey === 'nn.Linear' && (!params.out_features || params.out_features <= 0)) {
        return true;
      }
      
      return false;
    });

    if (nodesWithMissingParams.length > 0) {
      const nodeNames = nodesWithMissingParams.map(n => n.data.label).join(', ');
      errors.push(`Nodes with missing required parameters: ${nodeNames}`);
      missingComponents.push("Configure all required parameters in the property panel (right-click and select 'Properties')");
    }

    // Training mode specific checks
    if (state.mode === 'training') {
      const trainingConfig = state.nodes.find(n => n.data.registryKey === 'training.config');
      if (!trainingConfig) {
        errors.push("No training configuration found");
        missingComponents.push("Add a Training Config node to define loss function and training setup");
      }

      const optimizer = state.nodes.find(n => n.data.isTraining && getNodeMeta(n)?.category === 'Optimization');
      if (!optimizer) {
        warnings.push("No optimizer found");
        missingComponents.push("Add an optimizer (Adam, SGD, etc.) for training");
      }
    }

    // Model mode specific checks
    if (state.mode === 'model') {
      // Check for proper model flow
      const hasOutput = state.nodes.some(node => {
        const outgoingEdges = state.edges.filter(edge => edge.source === node.id);
        return outgoingEdges.length === 0 && node.data.registryKey !== 'input.dataset';
      });
      
      if (!hasOutput) {
        warnings.push("No clear output layer identified");
        missingComponents.push("Ensure your model has a final layer that produces the desired output");
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      missingComponents
    };
  },
  saveProject: () => {
    const state = get();
    saveProject(
      state.modelNodes,
      state.modelEdges,
      state.trainingNodes,
      state.trainingEdges,
      state.code,
      state.mode
    );
  },
  loadProject: async () => {
    const loadedState = await loadProject();
    if (loadedState) {
      set({
        modelNodes: loadedState.modelNodes,
        modelEdges: loadedState.modelEdges,
        trainingNodes: loadedState.trainingNodes,
        trainingEdges: loadedState.trainingEdges,
        code: loadedState.code,
        mode: loadedState.mode,
        nodes: loadedState.mode === 'model' ? loadedState.modelNodes : loadedState.trainingNodes,
        edges: loadedState.mode === 'model' ? loadedState.modelEdges : loadedState.trainingEdges,
      });
    }
  },
  clearProject: () => {
    const clearedState = clearProject();
    set({
      modelNodes: clearedState.modelNodes,
      modelEdges: clearedState.modelEdges,
      trainingNodes: clearedState.trainingNodes,
      trainingEdges: clearedState.trainingEdges,
      code: clearedState.code,
      mode: clearedState.mode,
      nodes: clearedState.modelNodes,
      edges: clearedState.modelEdges,
    });
  },
}));

