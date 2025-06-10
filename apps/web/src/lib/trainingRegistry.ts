export interface TrainingMeta {
  category: 'DataAugmentation' | 'Training' | 'Optimization' | 'Metrics' | 'Callbacks';
  friendly: string;
  torchClass: string;
  description: string;  // New field for helpful descriptions
  defaults: Record<string, any>;
  params: {
    name: string;
    type: 'int' | 'float' | 'bool' | 'select';
    options?: any[];
    min?: number;
    max?: number;
    required?: boolean;
  }[];
  inputShape?: string;  // Expected input shape description
  outputShape?: string; // Output shape description
  inputType?: string;   // Expected input type (e.g., 'tensor', 'dataset', 'model')
  outputType?: string;  // Output type
  outputTypes?: string[];  // Multiple output types support
}

export const trainingRegistry: TrainingMeta[] = [
  // --- Training Configuration ---
  {
    category: 'Training',
    friendly: 'Training Config',
    torchClass: 'training.config',
    description: 'Core training configuration defining batch size, epochs, device settings. Connects to dataset input and trainable model output. Essential setup node for any training workflow.',
    defaults: { 
      batch_size: 32, 
      epochs: 10, 
      device: 'auto',
      num_workers: 0,
      pin_memory: true,
      shuffle: true,
      drop_last: false
    },
    params: [
      { name: 'batch_size', type: 'int', min: 1, required: true },
      { name: 'epochs', type: 'int', min: 1, required: true },
      { name: 'device', type: 'select', options: ['auto', 'cpu', 'cuda', 'mps'] },
      { name: 'num_workers', type: 'int', min: 0 },
      { name: 'pin_memory', type: 'bool' },
      { name: 'shuffle', type: 'bool' },
      { name: 'drop_last', type: 'bool' },
    ],
    inputType: 'dataset',
    outputTypes: ['trainable', 'prediction'],  // Support both output types
    outputType: 'trainable',  // Default to trainable for backward compatibility
    inputShape: '[N, C, H, W]',
    outputShape: '[N, num_classes]',
  },

  // --- Data Augmentation ---
  {
    category: 'DataAugmentation',
    friendly: 'Random Rotation',
    torchClass: 'torchvision.transforms.RandomRotation',
    description: 'Randomly rotates input images by specified degrees. Improves model robustness to orientation changes. Essential for datasets where object rotation is common (e.g., natural images).',
    defaults: { degrees: 30, interpolation: 'nearest', expand: false, center: null, fill: 0 },
    params: [
      { name: 'degrees', type: 'float', min: 0, max: 360, required: true },
      { name: 'interpolation', type: 'select', options: ['nearest', 'bilinear', 'bicubic'] },
      { name: 'expand', type: 'bool' },
      { name: 'fill', type: 'int', min: 0, max: 255 },
    ],
    inputType: 'dataset',
    outputType: 'dataset',
    inputShape: '[N, C, H, W]',
    outputShape: '[N, C, H, W]',
  },
  {
    category: 'DataAugmentation',
    friendly: 'Horizontal Flip',
    torchClass: 'torchvision.transforms.RandomHorizontalFlip',
    description: 'Randomly flips input images horizontally with given probability. Standard augmentation for natural images where horizontal symmetry is meaningful. Doubles effective dataset size.',
    defaults: { p: 0.5 },
    params: [
      { name: 'p', type: 'float', min: 0, max: 1 },
    ],
    inputType: 'dataset',
    outputType: 'dataset',
    inputShape: '[N, C, H, W]',
    outputShape: '[N, C, H, W]',
  },
  {
    category: 'DataAugmentation',
    friendly: 'Vertical Flip',
    torchClass: 'torchvision.transforms.RandomVerticalFlip',
    description: 'Randomly flips input images vertically with given probability. Use when vertical symmetry is meaningful (e.g., aerial images, microscopy). Less common than horizontal flip.',
    defaults: { p: 0.5 },
    params: [
      { name: 'p', type: 'float', min: 0, max: 1 },
    ],
    inputType: 'dataset',
    outputType: 'dataset',
    inputShape: '[N, C, H, W]',
    outputShape: '[N, C, H, W]',
  },
  {
    category: 'DataAugmentation',
    friendly: 'Random Resize',
    torchClass: 'torchvision.transforms.RandomResizedCrop',
    description: 'Randomly crops and resizes input to target size. Creates scale and aspect ratio invariance. Essential for training robust models on datasets with varying object sizes.',
    defaults: { size: 224, scale_min: 0.08, scale_max: 1.0, ratio_min: 0.75, ratio_max: 1.33, interpolation: 'bilinear' },
    params: [
      { name: 'size', type: 'int', min: 1, required: true },
      { name: 'scale_min', type: 'float', min: 0, max: 1 },
      { name: 'scale_max', type: 'float', min: 0, max: 1 },
      { name: 'ratio_min', type: 'float', min: 0 },
      { name: 'ratio_max', type: 'float', min: 0 },
      { name: 'interpolation', type: 'select', options: ['nearest', 'bilinear', 'bicubic'] },
    ],
    inputType: 'dataset',
    outputType: 'dataset',
    inputShape: '[N, C, H, W]',
    outputShape: '[N, C, H, W]',
  },
  {
    category: 'DataAugmentation',
    friendly: 'Random Crop',
    torchClass: 'transforms.RandomCrop',
    description: 'Randomly crops input image to given size with optional padding. Creates spatial invariance and data augmentation. Use padding to maintain image size after cropping.',
    defaults: { size: 32, padding: 0, pad_if_needed: false, fill: 0, padding_mode: 'constant' },
    params: [
      { name: 'size', type: 'int', min: 1, required: true },
      { name: 'padding', type: 'int', min: 0 },
      { name: 'pad_if_needed', type: 'bool' },
      { name: 'fill', type: 'int', min: 0, max: 255 },
      { name: 'padding_mode', type: 'select', options: ['constant', 'edge', 'reflect', 'symmetric'] },
    ],
    inputType: 'dataset',
    outputType: 'dataset',
    inputShape: '[N, C, H, W]',
    outputShape: '[N, C, H, W]',
  },
  {
    category: 'DataAugmentation',
    friendly: 'Color Jitter',
    torchClass: 'torchvision.transforms.ColorJitter',
    description: 'Randomly changes brightness, contrast, saturation, and hue. Improves model robustness to lighting conditions and color variations. Critical for real-world deployment.',
    defaults: { brightness: 0, contrast: 0, saturation: 0, hue: 0 },
    params: [
      { name: 'brightness', type: 'float', min: 0 },
      { name: 'contrast', type: 'float', min: 0 },
      { name: 'saturation', type: 'float', min: 0 },
      { name: 'hue', type: 'float', min: -0.5, max: 0.5 },
    ],
    inputType: 'dataset',
    outputType: 'dataset',
    inputShape: '[N, C, H, W]',
    outputShape: '[N, C, H, W]',
  },
  {
    category: 'DataAugmentation',
    friendly: 'Normalize',
    torchClass: 'torchvision.transforms.Normalize',
    description: 'Normalizes tensor with given mean and standard deviation. Essential preprocessing step. Use ImageNet statistics for transfer learning: mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225].',
    defaults: { mean: [0.485, 0.456, 0.406], std: [0.229, 0.224, 0.225], inplace: false },
    params: [
      { name: 'inplace', type: 'bool' },
    ],
    inputType: 'dataset',
    outputType: 'dataset',
    inputShape: '[N, C, H, W]',
    outputShape: '[N, C, H, W]',
  },

  // --- Optimizers ---
  {
    category: 'Optimization',
    friendly: 'Adam',
    torchClass: 'torch.optim.Adam',
    description: 'Adam optimizer with adaptive learning rates. Computes individual learning rates for different parameters from estimates of first and second moments of gradients. Best general-purpose optimizer for most tasks.',
    defaults: { lr: 0.001, betas: [0.9, 0.999], eps: 1e-8, weight_decay: 0, amsgrad: false },
    params: [
      { name: 'lr', type: 'float', min: 0, required: true },
      { name: 'weight_decay', type: 'float', min: 0 },
      { name: 'eps', type: 'float', min: 0 },
      { name: 'amsgrad', type: 'bool' },
    ],
    inputType: 'trainable',
    outputType: 'optimized',
    inputShape: 'model_params',
    outputShape: 'model_params',
  },
  {
    category: 'Optimization',
    friendly: 'SGD',
    torchClass: 'torch.optim.SGD',
    description: 'Stochastic Gradient Descent optimizer with optional momentum and weight decay. Classic optimization algorithm. Momentum helps accelerate convergence and reduces oscillations.',
    defaults: { lr: 0.01, momentum: 0, dampening: 0, weight_decay: 0, nesterov: false },
    params: [
      { name: 'lr', type: 'float', min: 0, required: true },
      { name: 'momentum', type: 'float', min: 0 },
      { name: 'dampening', type: 'float', min: 0 },
      { name: 'weight_decay', type: 'float', min: 0 },
      { name: 'nesterov', type: 'bool' },
    ],
    inputType: 'trainable',
    outputType: 'optimized',
    inputShape: 'model_params',
    outputShape: 'model_params',
  },
  {
    category: 'Optimization',
    friendly: 'RMSprop',
    torchClass: 'torch.optim.RMSprop',
    description: 'RMSprop optimizer adapts learning rate based on recent gradient magnitudes. Good for non-stationary objectives and RNNs. Alpha controls moving average of squared gradients.',
    defaults: { lr: 0.01, alpha: 0.99, eps: 1e-8, weight_decay: 0, momentum: 0, centered: false },
    params: [
      { name: 'lr', type: 'float', min: 0, required: true },
      { name: 'alpha', type: 'float', min: 0, max: 1 },
      { name: 'eps', type: 'float', min: 0 },
      { name: 'weight_decay', type: 'float', min: 0 },
      { name: 'momentum', type: 'float', min: 0 },
      { name: 'centered', type: 'bool' },
    ],
    inputType: 'trainable',
    outputType: 'optimized',
    inputShape: 'model_params',
    outputShape: 'model_params',
  },

  // --- Metrics ---
  {
    category: 'Metrics',
    friendly: 'Accuracy',
    torchClass: 'metrics.Accuracy',
    description: 'Classification accuracy metric measuring fraction of correct predictions. Most interpretable metric for balanced datasets. Use alongside other metrics for comprehensive evaluation.',
    defaults: { task: 'multiclass', num_classes: 10, top_k: 1 },
    params: [
      { name: 'task', type: 'select', options: ['binary', 'multiclass', 'multilabel'] },
      { name: 'num_classes', type: 'int', min: 2 },
      { name: 'top_k', type: 'int', min: 1 },
    ],
    inputType: 'prediction',
    outputType: 'metric',
    inputShape: '[N, num_classes]',
    outputShape: 'scalar',
  },
  {
    category: 'Metrics',
    friendly: 'Precision',
    torchClass: 'metrics.precision',
    description: 'Precision metric: TP/(TP+FP). Measures fraction of positive predictions that are correct. Important when false positives are costly. Use with recall for comprehensive evaluation.',
    defaults: { task: 'multiclass', num_classes: 10, average: 'macro' },
    params: [
      { name: 'task', type: 'select', options: ['binary', 'multiclass', 'multilabel'] },
      { name: 'num_classes', type: 'int', min: 2 },
      { name: 'average', type: 'select', options: ['micro', 'macro', 'weighted', 'none'] },
    ],
    inputType: 'prediction',
    outputType: 'metric',
    inputShape: '[N, num_classes]',
    outputShape: 'scalar',
  },
  {
    category: 'Metrics',
    friendly: 'Recall',
    torchClass: 'metrics.recall',
    description: 'Recall metric: TP/(TP+FN). Measures fraction of actual positives correctly identified. Critical when false negatives are costly (e.g., medical diagnosis). Complements precision.',
    defaults: { task: 'multiclass', num_classes: 10, average: 'macro' },
    params: [
      { name: 'task', type: 'select', options: ['binary', 'multiclass', 'multilabel'] },
      { name: 'num_classes', type: 'int', min: 2 },
      { name: 'average', type: 'select', options: ['micro', 'macro', 'weighted', 'none'] },
    ],
    inputType: 'prediction',
    outputType: 'metric',
    inputShape: '[N, num_classes]',
    outputShape: 'scalar',
  },
  {
    category: 'Metrics',
    friendly: 'F1 Score',
    torchClass: 'metrics.f1_score',
    description: 'F1 Score: harmonic mean of precision and recall (2*P*R/(P+R)). Balances precision and recall. Excellent single metric for imbalanced datasets and binary classification.',
    defaults: { task: 'multiclass', num_classes: 10, average: 'macro' },
    params: [
      { name: 'task', type: 'select', options: ['binary', 'multiclass', 'multilabel'] },
      { name: 'num_classes', type: 'int', min: 2 },
      { name: 'average', type: 'select', options: ['micro', 'macro', 'weighted', 'none'] },
    ],
    inputType: 'prediction',
    outputType: 'metric',
    inputShape: '[N, num_classes]',
    outputShape: 'scalar',
  },

  // --- Callbacks ---
  {
    category: 'Callbacks',
    friendly: 'Model Checkpoint',
    torchClass: 'callbacks.ModelCheckpoint',
    description: 'Saves model checkpoints during training based on monitored metric. Prevents loss of progress and enables model recovery. Essential for long training runs and model selection.',
    defaults: { 
      monitor: 'val_loss', 
      mode: 'min', 
      save_top_k: 1,
      save_last: false,
      verbose: false
    },
    params: [
      { name: 'monitor', type: 'select', options: ['val_loss', 'val_accuracy', 'train_loss', 'train_accuracy'] },
      { name: 'mode', type: 'select', options: ['min', 'max'] },
      { name: 'save_top_k', type: 'int', min: -1 },
      { name: 'save_last', type: 'bool' },
      { name: 'verbose', type: 'bool' },
    ],
    inputType: 'metric',
    outputType: 'saved_model',
    inputShape: 'scalar',
    outputShape: 'saved_state',
  },
  {
    category: 'Callbacks',
    friendly: 'Early Stopping',
    torchClass: 'callbacks.EarlyStopping',
    description: 'Stops training when monitored metric stops improving. Prevents overfitting and saves computational resources. Connect after loss/metric nodes for automatic training termination.',
    defaults: { 
      monitor: 'val_loss', 
      patience: 7, 
      mode: 'min', 
      min_delta: 0.0,
      verbose: false,
      restore_best_weights: false
    },
    params: [
      { name: 'monitor', type: 'select', options: ['val_loss', 'val_accuracy', 'train_loss', 'train_accuracy'] },
      { name: 'patience', type: 'int', min: 1 },
      { name: 'mode', type: 'select', options: ['min', 'max'] },
      { name: 'min_delta', type: 'float', min: 0 },
      { name: 'verbose', type: 'bool' },
      { name: 'restore_best_weights', type: 'bool' },
    ],
    inputType: 'metric',
    outputType: 'stop_signal',
    inputShape: 'scalar',
    outputShape: 'boolean',
  },
  {
    category: 'Callbacks',
    friendly: 'Learning Rate Monitor',
    torchClass: 'callbacks.LearningRateMonitor',
    description: 'Monitors and logs learning rate changes during training. Essential for understanding optimizer behavior and diagnosing training issues. Connects to optimizer output.',
    defaults: { 
      logging_interval: 'epoch',
      log_momentum: false 
    },
    params: [
      { name: 'logging_interval', type: 'select', options: ['step', 'epoch'] },
      { name: 'log_momentum', type: 'bool' },
    ],
    inputType: 'optimized',
    outputType: 'log',
    inputShape: 'model_params',
    outputShape: 'log_entry',
  }
]; 