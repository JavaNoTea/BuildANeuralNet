// Parameter help descriptions and advice
export interface ParameterHelp {
  description: string;
  advice: string;
  defaultValue: any;
}

// Helper function to get parameter help with context fallbacks
export function getParameterHelp(paramName: string, torchClass: string): ParameterHelp | null {
  // First try exact match
  if (parameterHelp[paramName]) {
    return parameterHelp[paramName];
  }
  
  // Try context-specific fallbacks
  const contextMappings: Record<string, string[]> = {
    'alpha': ['elu_alpha', 'rmsprop_alpha'],
    'eps': ['norm_eps', 'optim_eps'], 
    'momentum': ['norm_momentum', 'sgd_momentum']
  };
  
  if (contextMappings[paramName]) {
    // Try to determine context from torchClass
    for (const contextParam of contextMappings[paramName]) {
      if (torchClass.includes('ELU') && contextParam === 'elu_alpha') return parameterHelp[contextParam];
      if (torchClass.includes('RMSprop') && contextParam === 'rmsprop_alpha') return parameterHelp[contextParam];
      if (torchClass.includes('BatchNorm') && contextParam === 'norm_eps') return parameterHelp[contextParam];
      if (torchClass.includes('LayerNorm') && contextParam === 'norm_eps') return parameterHelp[contextParam];
      if (torchClass.includes('GroupNorm') && contextParam === 'norm_eps') return parameterHelp[contextParam];
      if (torchClass.includes('InstanceNorm') && contextParam === 'norm_eps') return parameterHelp[contextParam];
      if (torchClass.includes('BatchNorm') && contextParam === 'norm_momentum') return parameterHelp[contextParam];
      if (torchClass.includes('InstanceNorm') && contextParam === 'norm_momentum') return parameterHelp[contextParam];
      if (torchClass.includes('SGD') && contextParam === 'sgd_momentum') return parameterHelp[contextParam];
      if (torchClass.includes('Adam') && contextParam === 'optim_eps') return parameterHelp[contextParam];
      if (torchClass.includes('RMSprop') && contextParam === 'optim_eps') return parameterHelp[contextParam];
    }
    // Fallback to first available context
    return parameterHelp[contextMappings[paramName][0]];
  }
  
  return null;
}

export const parameterHelp: Record<string, ParameterHelp> = {
  // --- Layer Parameters ---
  in_features: {
    description: "Number of input features to the linear layer",
    advice: "Should match the output size of the previous layer. For flattened images: height × width × channels",
    defaultValue: 128
  },
  out_features: {
    description: "Number of output features from the linear layer", 
    advice: "Set to desired output size. For classification, use number of classes. For hidden layers, typically 64-512",
    defaultValue: 64
  },
  bias: {
    description: "Whether to use bias terms in the layer",
    advice: "Keep True unless you have batch normalization immediately after. Bias helps model fit better",
    defaultValue: true
  },
  in_channels: {
    description: "Number of input channels (depth) to the convolution",
    advice: "Must match previous layer output channels. RGB images = 3, grayscale = 1",
    defaultValue: 3
  },
  out_channels: {
    description: "Number of output channels (filters) from the convolution",
    advice: "More channels = more features learned. Start with 32-64, increase in deeper layers (64→128→256)",
    defaultValue: 32
  },
  kernel_size: {
    description: "Size of the convolution kernel (filter)",
    advice: "3×3 or 5×5 are common. Larger kernels capture more spatial context but increase computation",
    defaultValue: 3
  },
  stride: {
    description: "Step size when moving the kernel across the input",
    advice: "1 = no downsampling. 2 = halves spatial dimensions. Use >1 for downsampling instead of pooling",
    defaultValue: 1
  },
  padding: {
    description: "Zero-padding added to input borders",
    advice: "Use (kernel_size-1)/2 to maintain spatial dimensions. 0 = shrink output size",
    defaultValue: 0
  },
  dilation: {
    description: "Spacing between kernel elements (dilated convolution)",
    advice: "1 = standard convolution. >1 = dilated/atrous convolution for larger receptive field",
    defaultValue: 1
  },
  groups: {
    description: "Number of groups for grouped convolution",
    advice: "1 = standard convolution. >1 = grouped/depthwise convolution for efficiency",
    defaultValue: 1
  },
  padding_mode: {
    description: "Type of padding to apply at borders",
    advice: "'zeros' for most cases. 'reflect'/'replicate' for images to avoid border artifacts",
    defaultValue: "zeros"
  },
  
  // --- Activation Parameters ---
  inplace: {
    description: "Whether to modify input tensor in-place to save memory",
    advice: "True saves memory but prevents gradient computation. Use False during training, True for inference",
    defaultValue: false
  },
  negative_slope: {
    description: "Slope for negative values in LeakyReLU",
    advice: "Small values like 0.01 help prevent dying neurons. Larger values (0.1-0.2) for more leakage",
    defaultValue: 0.01
  },
  elu_alpha: {
    description: "Alpha parameter for ELU activation",
    advice: "Controls saturation for negative inputs. 1.0 is standard. Larger values = more negative saturation",
    defaultValue: 1.0
  },
  approximate: {
    description: "Approximation method for GELU",
    advice: "'none' for exact computation. 'tanh' for faster approximation in inference",
    defaultValue: "none"
  },
  dim: {
    description: "Dimension along which to apply softmax",
    advice: "Usually last dimension (-1 or 1). For classification, use dimension with class scores",
    defaultValue: null
  },
  beta: {
    description: "Beta parameter for Softplus activation",
    advice: "Controls steepness. Larger values make it more like ReLU. 1 is standard",
    defaultValue: 1
  },
  threshold: {
    description: "Threshold above which to use linear approximation",
    advice: "For numerical stability. 20 is standard, rarely needs changing",
    defaultValue: 20
  },
  min_val: {
    description: "Minimum output value for Hardtanh",
    advice: "Lower bound for clamping. -1 is standard for tanh-like behavior",
    defaultValue: -1.0
  },
  max_val: {
    description: "Maximum output value for Hardtanh", 
    advice: "Upper bound for clamping. 1 is standard for tanh-like behavior",
    defaultValue: 1.0
  },

  // --- Pooling Parameters ---
  return_indices: {
    description: "Whether to return indices of maximum values",
    advice: "True if you need unpooling later. False for standard pooling to save memory",
    defaultValue: false
  },
  ceil_mode: {
    description: "Whether to use ceiling instead of floor for output size calculation",
    advice: "False for standard behavior. True to include partial windows at borders",
    defaultValue: false
  },
  count_include_pad: {
    description: "Whether to include padding in average calculation",
    advice: "True includes zeros in average (standard). False excludes padding for more accurate averages",
    defaultValue: true
  },
  divisor_override: {
    description: "Override the divisor used in average pooling",
    advice: "Leave null for automatic calculation. Set manually only for special normalization needs",
    defaultValue: null
  },
  output_size: {
    description: "Target output size for adaptive pooling",
    advice: "Common sizes: 1 for global pooling, 7 for classification heads, (H,W) for specific sizes",
    defaultValue: 1
  },

  // --- Normalization Parameters ---
  num_features: {
    description: "Number of features/channels to normalize",
    advice: "Must match input channels. Same as out_channels from previous conv layer",
    defaultValue: 64
  },
  norm_eps: {
    description: "Small value added to denominator for numerical stability",
    advice: "1e-5 is standard. Increase if you get NaN errors, decrease for more precision",
    defaultValue: 1e-5
  },
  norm_momentum: {
    description: "Momentum for running statistics update",
    advice: "0.1 is standard. Lower = smoother updates. Higher = more responsive to recent batches",
    defaultValue: 0.1
  },
  affine: {
    description: "Whether to use learnable scale and shift parameters",
    advice: "True for learnable normalization. False for just normalization without scaling",
    defaultValue: true
  },
  track_running_stats: {
    description: "Whether to track running mean and variance",
    advice: "True for training/inference difference. False for always using batch statistics",
    defaultValue: true
  },
  normalized_shape: {
    description: "Shape of the input to be normalized",
    advice: "Usually the feature dimension size. For transformers, use embedding dimension",
    defaultValue: 128
  },
  elementwise_affine: {
    description: "Whether to use learnable per-element scale and shift",
    advice: "True for learnable normalization. False for standard normalization only",
    defaultValue: true
  },
  num_groups: {
    description: "Number of groups to divide channels into",
    advice: "Lower = more normalization groups. Common: 8, 16, 32. Must divide num_channels evenly",
    defaultValue: 2
  },
  num_channels: {
    description: "Total number of channels in the input",
    advice: "Must match input channels. Should be divisible by num_groups",
    defaultValue: 64
  },

  // --- RNN Parameters ---
  input_size: {
    description: "Number of expected features in input",
    advice: "For embeddings: embedding_dim. For sequences: feature size per timestep",
    defaultValue: 128
  },
  hidden_size: {
    description: "Number of features in hidden state",
    advice: "Larger = more memory/capacity. Common: 64-512 for small tasks, 512-2048 for large",
    defaultValue: 64
  },
  num_layers: {
    description: "Number of recurrent layers stacked",
    advice: "1-3 layers common. More layers = more capacity but harder to train",
    defaultValue: 1
  },
  batch_first: {
    description: "Whether input/output tensors have batch dimension first",
    advice: "False: (seq_len, batch, features). True: (batch, seq_len, features). Match your data format",
    defaultValue: false
  },
  dropout: {
    description: "Dropout probability for regularization",
    advice: "0.0-0.5 typical. Higher for overfitting, lower for underfitting. 0 disables dropout",
    defaultValue: 0.0
  },
  bidirectional: {
    description: "Whether to use bidirectional RNN",
    advice: "True for better context (2x parameters). False for causal/streaming applications",
    defaultValue: false
  },
  nonlinearity: {
    description: "Activation function for RNN",
    advice: "'tanh' for standard RNN (vanishing gradients). 'relu' for better gradients but can explode",
    defaultValue: "tanh"
  },

  // --- Embedding Parameters ---
  num_embeddings: {
    description: "Size of the vocabulary (number of unique tokens)",
    advice: "Set to your vocabulary size. Common: 1000-50000 depending on dataset",
    defaultValue: 1000
  },
  embedding_dim: {
    description: "Dimensionality of embedding vectors",
    advice: "Higher = more expressive. Common: 50-300 for small tasks, 512-1024 for large models",
    defaultValue: 128
  },
  padding_idx: {
    description: "Index used for padding tokens",
    advice: "Usually 0. Embeddings at this index won't be updated during training",
    defaultValue: null
  },
  max_norm: {
    description: "Maximum norm for embedding vectors",
    advice: "Leave null for no constraint. Set to 1-10 to prevent embeddings from growing too large",
    defaultValue: null
  },
  norm_type: {
    description: "Type of norm to use for max_norm constraint",
    advice: "2.0 for L2 norm (standard). 1.0 for L1 norm. Only matters if max_norm is set",
    defaultValue: 2.0
  },
  scale_grad_by_freq: {
    description: "Whether to scale gradients by word frequency",
    advice: "True helps rare words learn better. False for standard training",
    defaultValue: false
  },
  sparse: {
    description: "Whether to use sparse gradients",
    advice: "True for memory efficiency with large vocabularies. False for standard dense updates",
    defaultValue: false
  },

  // --- Utility Parameters ---
  p: {
    description: "Probability of dropout or data augmentation",
    advice: "0.0-1.0. Higher = more regularization/augmentation. Start with 0.5 for dropout, 0.5 for flips",
    defaultValue: 0.5
  },
  start_dim: {
    description: "First dimension to flatten",
    advice: "1 to preserve batch dimension. 0 to flatten everything including batch",
    defaultValue: 1
  },
  end_dim: {
    description: "Last dimension to flatten",
    advice: "-1 to flatten till end. Positive numbers for specific end dimension",
    defaultValue: -1
  },

  // --- Loss Parameters ---
  ignore_index: {
    description: "Class index to ignore in loss calculation",
    advice: "Use for padding tokens or unknown classes. -100 is standard PyTorch ignore value",
    defaultValue: -100
  },
  reduction: {
    description: "Type of reduction to apply to loss",
    advice: "'mean' for average loss. 'sum' for total loss. 'none' for per-sample losses",
    defaultValue: "mean"
  },
  label_smoothing: {
    description: "Amount of label smoothing for regularization",
    advice: "0.0-0.1 typical. Higher = more smoothing = more regularization. 0 disables smoothing",
    defaultValue: 0.0
  },
  pos_weight: {
    description: "Weight for positive class in binary classification",
    advice: "Use for imbalanced datasets. Higher = more weight on positive class. null for balanced",
    defaultValue: null
  },

  // --- Training Parameters ---
  batch_size: {
    description: "Number of samples processed before updating weights",
    advice: "Larger = more stable gradients, more memory. Common: 16-128. GPU memory limited",
    defaultValue: 32
  },
  epochs: {
    description: "Number of complete passes through the dataset",
    advice: "More epochs = more training. Watch for overfitting. Start with 10-100",
    defaultValue: 10
  },
  device: {
    description: "Device to run training on",
    advice: "'auto' detects best. 'cuda' for GPU, 'cpu' for CPU, 'mps' for Apple Silicon",
    defaultValue: "auto"
  },
  num_workers: {
    description: "Number of processes for data loading", 
    advice: "0 for single process. 2-8 for parallel loading. More workers = faster data loading",
    defaultValue: 0
  },
  pin_memory: {
    description: "Whether to pin memory for faster GPU transfer",
    advice: "True for GPU training (faster). False for CPU-only or memory constraints",
    defaultValue: true
  },
  shuffle: {
    description: "Whether to shuffle data each epoch",
    advice: "True for training (better generalization). False for validation/testing",
    defaultValue: true
  },
  drop_last: {
    description: "Whether to drop the last incomplete batch",
    advice: "False to use all data. True for consistent batch sizes (important for some models)",
    defaultValue: false
  },

  // --- Optimizer Parameters ---
  lr: {
    description: "Learning rate for parameter updates",
    advice: "Lower = slower, stable learning. Higher = faster, unstable. Start: 0.001 (Adam), 0.01 (SGD)",
    defaultValue: 0.001
  },
  weight_decay: {
    description: "L2 regularization strength",
    advice: "0 = no regularization. 1e-4 to 1e-2 typical. Higher = more regularization against overfitting",
    defaultValue: 0
  },
  optim_eps: {
    description: "Small constant for numerical stability",
    advice: "1e-8 is standard. Rarely needs changing unless getting numerical issues",
    defaultValue: 1e-8
  },
  amsgrad: {
    description: "Whether to use AMSGrad variant of Adam",
    advice: "False for standard Adam. True for better convergence on some problems",
    defaultValue: false
  },
  sgd_momentum: {
    description: "Momentum factor for SGD",
    advice: "0 = no momentum. 0.9 typical. Higher = more momentum = smoother updates",
    defaultValue: 0
  },
  dampening: {
    description: "Dampening factor for momentum in SGD",
    advice: "0 for standard momentum. >0 to reduce momentum effect",
    defaultValue: 0
  },
  nesterov: {
    description: "Whether to use Nesterov momentum",
    advice: "False for standard momentum. True for Nesterov (often better convergence)",
    defaultValue: false
  },
  rmsprop_alpha: {
    description: "Smoothing constant for RMSprop",
    advice: "0.99 is standard. Lower = more responsive to recent gradients. Higher = smoother",
    defaultValue: 0.99
  },
  centered: {
    description: "Whether to compute centered RMSprop",
    advice: "False for standard RMSprop. True for centered variant (can help convergence)",
    defaultValue: false
  },

  // --- Data Augmentation Parameters ---
  degrees: {
    description: "Range of rotation angles in degrees",
    advice: "Small rotations (10-30°) for natural images. Larger (90°) if rotation invariance needed",
    defaultValue: 30
  },
  interpolation: {
    description: "Interpolation method for transformations",
    advice: "'bilinear' for smooth results. 'nearest' for speed. 'bicubic' for highest quality",
    defaultValue: "bilinear"
  },
  expand: {
    description: "Whether to expand image to fit rotated content",
    advice: "False maintains size (crops). True shows full rotated image (changes dimensions)",
    defaultValue: false
  },
  center: {
    description: "Center point for rotation",
    advice: "null for image center. Set (x,y) for custom rotation point",
    defaultValue: null
  },
  fill: {
    description: "Fill color for areas outside image after rotation",
    advice: "0 for black. 255 for white. Match your data preprocessing",
    defaultValue: 0
  },
  size: {
    description: "Target size after random resized crop",
    advice: "Match your model's expected input size. Common: 224, 256, 512",
    defaultValue: 224
  },
  scale_min: {
    description: "Minimum fraction of image area to crop",
    advice: "0.08 is standard. Lower = more aggressive cropping. Higher = less cropping",
    defaultValue: 0.08
  },
  scale_max: {
    description: "Maximum fraction of image area to crop",
    advice: "1.0 is standard (full image). Lower values force cropping",
    defaultValue: 1.0
  },
  ratio_min: {
    description: "Minimum aspect ratio for cropping",
    advice: "0.75 is standard. Lower allows more extreme aspect ratios",
    defaultValue: 0.75
  },
  ratio_max: {
    description: "Maximum aspect ratio for cropping",
    advice: "1.33 is standard. Higher allows more extreme aspect ratios",
    defaultValue: 1.33
  },
  brightness: {
    description: "Random brightness adjustment factor",
    advice: "0 = no change. 0.2 = ±20% brightness. Higher = more variation",
    defaultValue: 0
  },
  contrast: {
    description: "Random contrast adjustment factor",
    advice: "0 = no change. 0.2 = ±20% contrast. Higher = more variation",
    defaultValue: 0
  },
  saturation: {
    description: "Random saturation adjustment factor", 
    advice: "0 = no change. 0.2 = ±20% saturation. Higher = more color variation",
    defaultValue: 0
  },
  hue: {
    description: "Random hue shift factor",
    advice: "0 = no change. ±0.1 typical. Stay within ±0.5 to avoid unrealistic colors",
    defaultValue: 0
  },
  mean: {
    description: "Mean values for normalization per channel",
    advice: "Use dataset statistics or ImageNet values [0.485, 0.456, 0.406] for transfer learning",
    defaultValue: [0.485, 0.456, 0.406]
  },
  std: {
    description: "Standard deviation values for normalization per channel",
    advice: "Use dataset statistics or ImageNet values [0.229, 0.224, 0.225] for transfer learning",
    defaultValue: [0.229, 0.224, 0.225]
  },

  // --- Metric Parameters ---
  task: {
    description: "Type of classification task",
    advice: "'binary' for 2 classes. 'multiclass' for >2 mutually exclusive classes. 'multilabel' for multiple labels per sample",
    defaultValue: "multiclass"
  },
  num_classes: {
    description: "Number of classes in classification",
    advice: "Must match your dataset. 2 for binary, >2 for multiclass",
    defaultValue: 10
  },
  top_k: {
    description: "Number of top predictions to consider for accuracy",
    advice: "1 for standard accuracy. 5 for top-5 accuracy (common for ImageNet)",
    defaultValue: 1
  },
  average: {
    description: "Averaging method for multi-class metrics",
    advice: "'macro' for equal class weight. 'micro' for sample weight. 'weighted' for class frequency weight",
    defaultValue: "macro"
  },

  // --- Callback Parameters ---
  monitor: {
    description: "Metric to monitor for callbacks",
    advice: "'val_loss' for validation loss. 'val_accuracy' for validation accuracy. Choose based on your goal",
    defaultValue: "val_loss"
  },
  mode: {
    description: "Whether monitored metric should be minimized or maximized",
    advice: "'min' for loss metrics. 'max' for accuracy metrics",
    defaultValue: "min"
  },
  save_last: {
    description: "Whether to always save the last model",
    advice: "True to keep most recent model. False to only keep best",
    defaultValue: false
  },
  verbose: {
    description: "Whether to print callback messages",
    advice: "True for debugging. False for cleaner output",
    defaultValue: false
  },
  save_top_k: {
    description: "Number of best models to keep",
    advice: "1 to keep only best. -1 to keep all. Higher numbers for model ensembling",
    defaultValue: 1
  },
  patience: {
    description: "Number of epochs to wait before stopping",
    advice: "Higher = more patience. 7-10 typical. Lower for quick training, higher for careful optimization",
    defaultValue: 7
  },
  min_delta: {
    description: "Minimum change to qualify as improvement",
    advice: "0.0 for any improvement. Small positive values (0.001) to avoid noise",
    defaultValue: 0.0
  },
  restore_best_weights: {
    description: "Whether to restore best weights when stopping",
    advice: "True to get best model. False to keep final weights",
    defaultValue: false
  },
  logging_interval: {
    description: "How often to log learning rate",
    advice: "'epoch' for per-epoch logging. 'step' for per-batch logging (more detailed)",
    defaultValue: "epoch"
  },
  log_momentum: {
    description: "Whether to also log momentum values",
    advice: "False for cleaner logs. True for detailed optimizer monitoring",
    defaultValue: false
  }
}; 