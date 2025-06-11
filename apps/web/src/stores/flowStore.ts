import { create } from 'zustand';
import { Node, Edge, Connection } from 'reactflow';
import { trainingRegistry, TrainingMeta } from '@/lib/trainingRegistry';
import { layerRegistry } from '@/lib/layerRegistry';
import { DATASET_SHAPES } from '@/lib/constants';
import { saveProject, loadProject, SavedState, clearProject } from '@/lib/saveLoad';

type Mode = 'model' | 'training' | 'code';

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

// Helper function to check if a connection is valid in training mode
const isValidTrainingConnection = (nodes: Node[], connection: Connection): boolean => {
  if (!connection.source || !connection.target) {
    return false;
  }

  const sourceNode = nodes.find(n => n.id === connection.source);
  const targetNode = nodes.find(n => n.id === connection.target);

  if (!sourceNode || !targetNode) {
    return false;
  }

  if (!sourceNode.data.isTraining || !targetNode.data.isTraining) {
    return false;
  }

  const sourceMeta = getNodeMeta(sourceNode);
  const targetMeta = getNodeMeta(targetNode);

  if (!sourceMeta || !targetMeta) {
    return false;
  }

  // Get source shape
  const sourceShape = sourceNode.data.registryKey === 'input.dataset'
    ? sourceNode.data.shape || '[N, C, H, W]'
    : sourceMeta.outputShape || '[N, C, H, W]';

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

  // For Training Config connections, check against the dynamically selected output type
  let isValidType = sourceOutputType === targetInputType || sourceOutputTypes.includes(targetInputType || '');

  // Validate type compatibility

  if (!isValidType) {
    return false;
  }

  // Validate workflow order
  const isValidWorkflow = sourceNode.data.registryKey === 'input.dataset'
    ? targetMeta.category === 'DataAugmentation' || targetMeta.category === 'Training'
    : sourceMeta.category === 'DataAugmentation'
    ? targetMeta.category === 'DataAugmentation' || targetMeta.category === 'Training'
    : sourceMeta.category === 'Training'
    ? targetMeta.category === 'Optimization' || targetMeta.category === 'Metrics' || targetMeta.category === 'Callbacks'
    : sourceMeta.category === 'Optimization'
    ? targetMeta.category === 'Training' || targetMeta.category === 'Callbacks'
    : sourceMeta.category === 'Metrics'
    ? targetMeta.category === 'Callbacks'
    : sourceMeta.category === 'Callbacks'
    ? false // Callbacks don't output to anything else
    : false;

  if (!isValidWorkflow) {
    return false;
  }

  return true;
};

// Helper function to check if a connection is valid in model mode
const isValidModelConnection = (nodes: Node[], connection: Connection): boolean => {
  if (!connection.source || !connection.target) return false;

  const sourceNode = nodes.find(n => n.id === connection.source);
  const targetNode = nodes.find(n => n.id === connection.target);

  if (!sourceNode || !targetNode) return false;

  // Only allow connections between model nodes (non-training nodes)
  if (sourceNode.data.isTraining || targetNode.data.isTraining) return false;

  // In model mode, any layer can connect to any other layer
  // except dataset nodes can only be source nodes
  if (targetNode.data.registryKey === 'input.dataset') return false;

  // For sum connections, allow multiple inputs to the same target
  // For residual connections, allow skip connections
  // For default connections, maintain standard validation
  
  return true;
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

