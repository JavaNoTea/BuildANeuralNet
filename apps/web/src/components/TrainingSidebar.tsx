'use client';
import { trainingRegistry, TrainingMeta } from '@/lib/trainingRegistry';
import { Fragment, useState, useCallback } from 'react';
import React from 'react';
import { useFlowStore } from '@/stores/flowStore';

// Simple random ID generator to replace nanoid
const generateId = () => Math.random().toString(36).substr(2, 6);

// Color mapping for categories
const categoryColors: Record<string, { header: string; item: string; border: string }> = {
  DataAugmentation: { header: 'bg-purple-100 text-purple-800', item: 'bg-purple-500 hover:bg-purple-600', border: 'border-purple-300' },
  Optimization:     { header: 'bg-blue-100 text-blue-800', item: 'bg-blue-500 hover:bg-blue-600', border: 'border-blue-300' },
  Training:        { header: 'bg-green-100 text-green-800', item: 'bg-green-500 hover:bg-green-600', border: 'border-green-300' },
  Metrics:         { header: 'bg-yellow-100 text-yellow-800', item: 'bg-yellow-500 hover:bg-yellow-600', border: 'border-yellow-300' },
  Callbacks:       { header: 'bg-red-100 text-red-800', item: 'bg-red-500 hover:bg-red-600', border: 'border-red-300' },
};

// Detailed tooltip component for training component information
function TrainingTooltip({ component, position, onClose }: { 
  component: TrainingMeta | null; 
  position: { x: number; y: number } | null;
  onClose: () => void;
}) {
  if (!component || !position) return null;

  const getMathematicalInfo = (torchClass: string): string | null => {
    const mathInfo: Record<string, string> = {
      'torch.optim.Adam': 'Adaptive Moment Estimation:\nm₁ = β₁m₁ + (1-β₁)g\nm₂ = β₂m₂ + (1-β₂)g²\nθ = θ - α⋅m̂₁/(√m̂₂ + ε)',
      'torch.optim.SGD': 'Stochastic Gradient Descent:\nθ = θ - α⋅∇L(θ)\nWith momentum: v = γv + α⋅∇L(θ), θ = θ - v',
      'torchvision.transforms.RandomRotation': 'Rotation matrix:\n[cos(θ) -sin(θ)]\n[sin(θ)  cos(θ)]\nApplied to pixel coordinates',
      'torchvision.transforms.Normalize': 'Normalization formula:\noutput = (input - mean) / std\nPer-channel normalization',
      'torch.nn.CrossEntropyLoss': 'Cross-entropy loss:\nL = -log(p_y) = -log(softmax(x)_y)\nCombines LogSoftmax and NLLLoss',
    };
    return mathInfo[torchClass] || null;
  };

  const getUseCases = (torchClass: string): string[] => {
    const useCases: Record<string, string[]> = {
      'torch.optim.Adam': ['Default optimizer choice', 'Deep networks', 'RNNs and Transformers', 'Computer vision'],
      'torch.optim.SGD': ['Classic optimization', 'Fine-tuning', 'Large batch training', 'Simple networks'],
      'torchvision.transforms.RandomRotation': ['Data augmentation', 'Rotation invariance', 'Object detection', 'Medical imaging'],
      'torchvision.transforms.RandomHorizontalFlip': ['Natural image augmentation', 'Doubling dataset size', 'Improving generalization'],
      'torchvision.transforms.Normalize': ['Preprocessing step', 'Transfer learning', 'Stabilizing training', 'ImageNet pretrained models'],
      'torch.nn.CrossEntropyLoss': ['Multi-class classification', 'Neural network training', 'Image classification', 'NLP tasks'],
    };
    return useCases[torchClass] || ['General purpose training component'];
  };

  const getTipsAndTricks = (torchClass: string): string[] => {
    const tips: Record<string, string[]> = {
      'torch.optim.Adam': ['Start with lr=1e-3', 'Reduce LR if loss plateaus', 'Use weight_decay for regularization'],
      'torch.optim.SGD': ['Use momentum=0.9', 'Learning rate scheduling important', 'Good for fine-tuning'],
      'torchvision.transforms.RandomRotation': ['Use moderate angles (±30°)', 'Consider expand=True for full image', 'Chain with other augmentations'],
      'torchvision.transforms.Normalize': ['Use ImageNet stats for transfer learning', 'Calculate dataset stats for custom data', 'Apply after ToTensor()'],
    };
    return tips[torchClass] || [];
  };

  const math = getMathematicalInfo(component.torchClass);
  const useCases = getUseCases(component.torchClass);
  const tips = getTipsAndTricks(component.torchClass);

  return (
    <div 
      className="fixed z-[10000] w-96 bg-gray-900 text-white text-sm rounded-lg shadow-xl border border-gray-700"
      style={{ 
        left: position.x + 10, 
        top: position.y,
        maxHeight: '400px',
        overflowY: 'auto'
      }}
      onMouseLeave={onClose}
    >
      <div className="p-4 space-y-3">
        {/* Header */}
        <div className="border-b border-gray-700 pb-2">
          <h3 className="text-lg font-bold text-blue-300">{component.friendly}</h3>
          <p className="text-xs text-gray-400 font-mono">{component.torchClass}</p>
          <div className="flex gap-2 mt-1">
            <span className="px-2 py-1 bg-gray-800 text-gray-300 text-xs rounded">{component.category}</span>
            {component.inputType && <span className="px-2 py-1 bg-blue-800 text-blue-200 text-xs rounded">Input: {component.inputType}</span>}
            {component.outputType && <span className="px-2 py-1 bg-green-800 text-green-200 text-xs rounded">Output: {component.outputType}</span>}
          </div>
        </div>

        {/* Description */}
        <div>
          <h4 className="font-semibold text-green-300 mb-1">Description</h4>
          <p className="text-gray-200 text-xs leading-relaxed">{component.description}</p>
        </div>

        {/* Mathematical Info */}
        {math && (
          <div>
            <h4 className="font-semibold text-purple-300 mb-1">Mathematics</h4>
            <pre className="text-gray-200 text-xs bg-gray-800 p-2 rounded whitespace-pre-wrap">{math}</pre>
          </div>
        )}

        {/* Use Cases */}
        <div>
          <h4 className="font-semibold text-yellow-300 mb-1">Common Use Cases</h4>
          <ul className="text-gray-200 text-xs space-y-1">
            {useCases.map((useCase, idx) => (
              <li key={idx} className="flex items-start">
                <span className="text-yellow-400 mr-2">•</span>
                <span>{useCase}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Tips and Tricks */}
        {tips.length > 0 && (
          <div>
            <h4 className="font-semibold text-orange-300 mb-1">Tips & Best Practices</h4>
            <ul className="text-gray-200 text-xs space-y-1">
              {tips.map((tip, idx) => (
                <li key={idx} className="flex items-start">
                  <span className="text-orange-400 mr-2">💡</span>
                  <span>{tip}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Parameters */}
        {component.params.length > 0 && (
          <div>
            <h4 className="font-semibold text-cyan-300 mb-1">Key Parameters</h4>
            <div className="space-y-1">
              {component.params.slice(0, 4).map((param) => (
                <div key={param.name} className="text-xs">
                  <span className="text-cyan-200 font-medium">{param.name}</span>
                  <span className="text-gray-400"> ({param.type})</span>
                  {param.required && <span className="text-red-400"> *required</span>}
                </div>
              ))}
              {component.params.length > 4 && (
                <p className="text-gray-500 text-xs">... and {component.params.length - 4} more parameters</p>
              )}
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="border-t border-gray-700 pt-2">
          <p className="text-gray-500 text-xs">Right-click to show • Drag to add to canvas</p>
        </div>
      </div>
      
      {/* Triangle pointer */}
      <div className="absolute top-4 -left-2 w-4 h-4 bg-gray-900 border-l border-t border-gray-700 transform rotate-45"></div>
    </div>
  );
}

export default function TrainingSidebar() {
  const { setNodes, setEdges, saveProject, loadProject, clearProject } = useFlowStore();

  // Add training template creation functions
  const createResNetTrainingTemplate = useCallback(() => {
    // Clear current graph first
    setNodes([]);
    setEdges([]);
    
    const position = { x: 50, y: 50 };
    const spacing = { x: 200, y: 120 };
    const trainingNodes: any[] = [];
    
    // Dataset node
    const dataset = {
      id: generateId(),
      type: 'default',
      position: { x: position.x, y: position.y - spacing.y },
      data: {
        registryKey: 'input.dataset',
        label: 'cifar10_dataset',
        params: { dataset: 'torchvision.datasets.CIFAR10' },
        isTraining: true,
      },
    };
    trainingNodes.push(dataset);
    
    // Data augmentation transforms
    const horizontalFlip = {
      id: generateId(),
      type: 'default',
      position: { x: position.x, y: position.y },
      data: {
        registryKey: 'torchvision.transforms.RandomHorizontalFlip',
        label: 'horizontal_flip',
        params: { p: 0.5 },
        isTraining: true,
      },
    };
    trainingNodes.push(horizontalFlip);
    
    const normalize = {
      id: generateId(),
      type: 'default',
      position: { x: position.x + spacing.x, y: position.y },
      data: {
        registryKey: 'torchvision.transforms.Normalize',
        label: 'normalize',
        params: { mean: [0.485, 0.456, 0.406], std: [0.229, 0.224, 0.225], inplace: false },
        isTraining: true,
      },
    };
    trainingNodes.push(normalize);
    
    // Training configuration
    const trainingConfig = {
      id: generateId(),
      type: 'default',
      position: { x: position.x + spacing.x * 2, y: position.y },
      data: {
        registryKey: 'training.config',
        label: 'training_config',
        params: { 
          batch_size: 64, 
          epochs: 20, 
          device: 'auto',
          num_workers: 4,
          pin_memory: true,
          shuffle: true,
          drop_last: false
        },
        isTraining: true,
      },
    };
    trainingNodes.push(trainingConfig);
    
    // Optimizer
    const optimizer = {
      id: generateId(),
      type: 'default',
      position: { x: position.x, y: position.y + spacing.y },
      data: {
        registryKey: 'torch.optim.Adam',
        label: 'adam_optimizer',
        params: { lr: 0.001, weight_decay: 1e-4, eps: 1e-8, amsgrad: false },
        isTraining: true,
      },
    };
    trainingNodes.push(optimizer);
    
    // Metrics
    const accuracy = {
      id: generateId(),
      type: 'default',
      position: { x: position.x + spacing.x, y: position.y + spacing.y },
      data: {
        registryKey: 'metrics.Accuracy',
        label: 'accuracy_metric',
        params: { task: 'multiclass', num_classes: 10, top_k: 1 },
        isTraining: true,
      },
    };
    trainingNodes.push(accuracy);
    
    // Callbacks
    const modelCheckpoint = {
      id: generateId(),
      type: 'default',
      position: { x: position.x + spacing.x * 2, y: position.y + spacing.y },
      data: {
        registryKey: 'callbacks.ModelCheckpoint',
        label: 'model_checkpoint',
        params: { 
          monitor: 'val_loss', 
          mode: 'min', 
          save_top_k: 1,
          save_last: false,
          verbose: false
        },
        isTraining: true,
      },
    };
    trainingNodes.push(modelCheckpoint);
    
    // Create edges to connect the training pipeline
    const newEdges = [
      { id: `${dataset.id}-${horizontalFlip.id}`, source: dataset.id, target: horizontalFlip.id, type: 'default' },
      { id: `${horizontalFlip.id}-${normalize.id}`, source: horizontalFlip.id, target: normalize.id, type: 'default' },
      { id: `${normalize.id}-${trainingConfig.id}`, source: normalize.id, target: trainingConfig.id, type: 'default' },
      { id: `${trainingConfig.id}-${accuracy.id}`, source: trainingConfig.id, target: accuracy.id, type: 'default' },
      { id: `${trainingConfig.id}-${optimizer.id}`, source: trainingConfig.id, target: optimizer.id, type: 'default' },
      { id: `${accuracy.id}-${modelCheckpoint.id}`, source: accuracy.id, target: modelCheckpoint.id, type: 'default' },
    ];
    
    setNodes((nds: any[]) => [...nds, ...trainingNodes]);
    setEdges((eds: any[]) => [...eds, ...newEdges]);
  }, [setNodes, setEdges]);

  const createInceptionTrainingTemplate = useCallback(() => {
    // Clear current graph first
    setNodes([]);
    setEdges([]);
    
    const position = { x: 50, y: 50 };
    const spacing = { x: 200, y: 120 };
    const trainingNodes: any[] = [];
    
    // Dataset node
    const dataset = {
      id: generateId(),
      type: 'default',
      position: { x: position.x, y: position.y - spacing.y },
      data: {
        registryKey: 'input.dataset',
        label: 'cifar10_dataset',
        params: { dataset: 'torchvision.datasets.CIFAR10' },
        isTraining: true,
      },
    };
    trainingNodes.push(dataset);
    
    // More aggressive data augmentation for Inception-style training
    const randomCrop = {
      id: generateId(),
      type: 'default',
      position: { x: position.x, y: position.y },
      data: {
        registryKey: 'transforms.RandomCrop',
        label: 'random_crop',
        params: { size: 32, padding: 4, pad_if_needed: false, fill: 0, padding_mode: 'constant' },
        isTraining: true,
      },
    };
    trainingNodes.push(randomCrop);
    
    const colorJitter = {
      id: generateId(),
      type: 'default',
      position: { x: position.x + spacing.x, y: position.y },
      data: {
        registryKey: 'torchvision.transforms.ColorJitter',
        label: 'color_jitter',
        params: { brightness: 0.2, contrast: 0.2, saturation: 0.2, hue: 0.1 },
        isTraining: true,
      },
    };
    trainingNodes.push(colorJitter);
    
    const normalize = {
      id: generateId(),
      type: 'default',
      position: { x: position.x + spacing.x * 2, y: position.y },
      data: {
        registryKey: 'torchvision.transforms.Normalize',
        label: 'normalize',
        params: { mean: [0.485, 0.456, 0.406], std: [0.229, 0.224, 0.225], inplace: false },
        isTraining: true,
      },
    };
    trainingNodes.push(normalize);
    
    // Training configuration
    const trainingConfig = {
      id: generateId(),
      type: 'default',
      position: { x: position.x + spacing.x * 3, y: position.y },
      data: {
        registryKey: 'training.config',
        label: 'training_config',
        params: { 
          batch_size: 32, 
          epochs: 30, 
          device: 'auto',
          num_workers: 4,
          pin_memory: true,
          shuffle: true,
          drop_last: false
        },
        isTraining: true,
      },
    };
    trainingNodes.push(trainingConfig);
    
    // SGD optimizer (common for Inception networks)
    const optimizer = {
      id: generateId(),
      type: 'default',
      position: { x: position.x, y: position.y + spacing.y },
      data: {
        registryKey: 'torch.optim.SGD',
        label: 'sgd_optimizer',
        params: { lr: 0.01, momentum: 0.9, dampening: 0, weight_decay: 1e-4, nesterov: false },
        isTraining: true,
      },
    };
    trainingNodes.push(optimizer);
    
    // Multiple metrics for comprehensive evaluation
    const accuracy = {
      id: generateId(),
      type: 'default',
      position: { x: position.x + spacing.x, y: position.y + spacing.y },
      data: {
        registryKey: 'metrics.Accuracy',
        label: 'accuracy_metric',
        params: { task: 'multiclass', num_classes: 10, top_k: 1 },
        isTraining: true,
      },
    };
    trainingNodes.push(accuracy);
    
    const f1Score = {
      id: generateId(),
      type: 'default',
      position: { x: position.x + spacing.x * 2, y: position.y + spacing.y },
      data: {
        registryKey: 'metrics.f1_score',
        label: 'f1_score_metric',
        params: { task: 'multiclass', num_classes: 10, average: 'macro' },
        isTraining: true,
      },
    };
    trainingNodes.push(f1Score);
    
    // Early stopping and model checkpoint
    const earlyStopping = {
      id: generateId(),
      type: 'default',
      position: { x: position.x + spacing.x * 3, y: position.y + spacing.y },
      data: {
        registryKey: 'callbacks.EarlyStopping',
        label: 'early_stopping',
        params: { 
          monitor: 'val_loss', 
          patience: 7, 
          mode: 'min', 
          min_delta: 0.0,
          verbose: false,
          restore_best_weights: false
        },
        isTraining: true,
      },
    };
    trainingNodes.push(earlyStopping);
    
    // Create edges to connect the training pipeline
    const newEdges = [
      { id: `${dataset.id}-${randomCrop.id}`, source: dataset.id, target: randomCrop.id, type: 'default' },
      { id: `${randomCrop.id}-${colorJitter.id}`, source: randomCrop.id, target: colorJitter.id, type: 'default' },
      { id: `${colorJitter.id}-${normalize.id}`, source: colorJitter.id, target: normalize.id, type: 'default' },
      { id: `${normalize.id}-${trainingConfig.id}`, source: normalize.id, target: trainingConfig.id, type: 'default' },
      { id: `${trainingConfig.id}-${optimizer.id}`, source: trainingConfig.id, target: optimizer.id, type: 'default' },
      { id: `${trainingConfig.id}-${accuracy.id}`, source: trainingConfig.id, target: accuracy.id, type: 'default' },
      { id: `${accuracy.id}-${f1Score.id}`, source: accuracy.id, target: f1Score.id, type: 'default' },
      { id: `${f1Score.id}-${earlyStopping.id}`, source: f1Score.id, target: earlyStopping.id, type: 'default' },
    ];
    
    setNodes((nds: any[]) => [...nds, ...trainingNodes]);
    setEdges((eds: any[]) => [...eds, ...newEdges]);
  }, [setNodes, setEdges]);

  const categories = [...new Set(trainingRegistry.map((l) => l.category))];
  const [open, setOpen] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    categories.forEach((cat) => { initial[cat] = true; });
    initial.Dataset = true;
    return initial;
  });

  const [tooltip, setTooltip] = useState<{
    component: TrainingMeta | null;
    position: { x: number; y: number } | null;
  }>({ component: null, position: null });

  const handleRightClick = (e: React.MouseEvent, component: TrainingMeta) => {
    e.preventDefault();
    setTooltip({
      component,
      position: { x: e.clientX, y: e.clientY }
    });
  };

  const closeTooltip = () => {
    setTooltip({ component: null, position: null });
  };

  // Toolbar actions
  const handleNew = () => {
    if (confirm('Clear the current training configuration? This cannot be undone.')) {
      clearProject();
    }
  };

  const handleSave = () => {
    saveProject();
  };

  const handleLoad = async () => {
    await loadProject();
  };

  const handleExpandAll = () => {
    setOpen((prev: Record<string, boolean>) => {
      const newOpen: Record<string, boolean> = {};
      Object.keys(prev).forEach((key) => {
        newOpen[key] = true;
      });
      return newOpen;
    });
  };

  const handleCollapseAll = () => {
    setOpen((prev: Record<string, boolean>) => {
      const newOpen: Record<string, boolean> = {};
      Object.keys(prev).forEach((key) => {
        newOpen[key] = false;
      });
      return newOpen;
    });
  };

  return (
    <>
      <aside className="w-56 overflow-y-auto border-r bg-white" style={{ height: 'calc(100vh - 48px)' }}>
        {/* Toolbar */}
        <div className="sticky top-0 z-10 bg-white border-b mb-2 flex items-center gap-2 px-2 py-2">
          <div className="relative group">
            <button className="px-3 py-1 rounded hover:bg-gray-100 font-semibold text-gray-900">File</button>
            <div className="absolute left-0 top-[calc(100%-2px)] w-48 bg-white border rounded-md shadow-lg hidden group-hover:block">
              <div className="py-1">
                <button onClick={handleNew} className="w-full text-left px-4 py-2 hover:bg-gray-100 text-gray-900">New</button>
                <button onClick={handleSave} className="w-full text-left px-4 py-2 hover:bg-gray-100 text-gray-900">Save</button>
                <button onClick={handleLoad} className="w-full text-left px-4 py-2 hover:bg-gray-100 text-gray-900">Load</button>
                <div className="border-t border-gray-200 my-1"></div>
                <div className="px-4 py-1 text-xs font-semibold text-gray-500 uppercase tracking-wide">Load Templates</div>
                <button onClick={createResNetTrainingTemplate} className="w-full text-left px-4 py-2 hover:bg-gray-100 text-gray-900">ResNet Training</button>
                <button onClick={createInceptionTrainingTemplate} className="w-full text-left px-4 py-2 hover:bg-gray-100 text-gray-900">Inception Training</button>
              </div>
            </div>
          </div>
          <div className="relative group">
            <button className="px-3 py-1 rounded hover:bg-gray-100 font-semibold text-gray-900">View</button>
            <div className="absolute left-0 top-[calc(100%-2px)] w-48 bg-white border rounded-md shadow-lg hidden group-hover:block">
              <div className="py-1">
                <button onClick={handleExpandAll} className="w-full text-left px-4 py-2 hover:bg-gray-100 text-gray-900">Expand All</button>
                <button onClick={handleCollapseAll} className="w-full text-left px-4 py-2 hover:bg-gray-100 text-gray-900">Collapse All</button>
              </div>
            </div>
          </div>
        </div>
        <div className="p-3 space-y-4">
          {/* Dataset section for training mode */}
          <Fragment key="Dataset">
            <button
              className="w-full flex items-center justify-between px-2 py-1 rounded font-bold uppercase text-xs mb-1 transition-colors duration-150 bg-yellow-100 text-yellow-800"
              onClick={() => setOpen((o: Record<string, boolean>) => ({ ...o, Dataset: !o.Dataset }))}
              type="button"
            >
              <span>Dataset</span>
              <span className="ml-2">{open.Dataset ? '▾' : '▸'}</span>
            </button>
            <div className={`space-y-1 pl-2 border-l-4 border-yellow-300 transition-all duration-200 ${open.Dataset ? 'max-h-[1000px] opacity-100' : 'max-h-0 opacity-0 overflow-hidden'}`}
              style={{ transitionProperty: 'max-height, opacity' }}
            >
              {open.Dataset && (
                <div
                  key="Dataset"
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.setData(
                      'application/reactflow',
                      JSON.stringify({ registryKey: 'input.dataset', isTraining: true })
                    );
                    e.dataTransfer.effectAllowed = 'move';
                  }}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    // Show dataset info tooltip
                    const datasetInfo: any = {
                      category: 'Input',
                      friendly: 'Dataset',
                      torchClass: 'input.dataset',
                      description: 'Input dataset node providing training and validation data to the neural network. Represents the entry point for your machine learning pipeline. Supports popular computer vision datasets like MNIST, CIFAR-10, ImageNet, and more.',
                      defaults: {},
                      params: []
                    };
                    handleRightClick(e, datasetInfo);
                  }}
                  className="cursor-grab rounded px-2 py-1 text-sm text-white shadow transition-colors duration-100 bg-yellow-500 hover:bg-yellow-600"
                >
                  Dataset
                </div>
              )}
            </div>
          </Fragment>

          {categories.map((cat) => (
            <Fragment key={cat}>
              <button
                className={`w-full flex items-center justify-between px-2 py-1 rounded font-bold uppercase text-xs mb-1 transition-colors duration-150 ${categoryColors[cat]?.header || ''}`}
                onClick={() => setOpen((o: Record<string, boolean>) => ({ ...o, [cat]: !o[cat] }))}
                type="button"
              >
                <span>{cat}</span>
                <span className="ml-2">{open[cat] ? '▾' : '▸'}</span>
              </button>
              <div className={`space-y-1 pl-2 border-l-4 ${categoryColors[cat]?.border || ''} transition-all duration-200 ${open[cat] ? 'max-h-[1000px] opacity-100' : 'max-h-0 opacity-0 overflow-hidden'}`}
                style={{ transitionProperty: 'max-height, opacity' }}
              >
                {open[cat] && (
                  trainingRegistry
                    .filter((l) => l.category === cat)
                    .map((l) => (
                      <div
                        key={l.friendly}
                        draggable
                        onDragStart={(e: React.DragEvent) => {
                          e.dataTransfer.setData(
                            'application/reactflow',
                            JSON.stringify({ registryKey: l.torchClass, isTraining: true })
                          );
                          e.dataTransfer.effectAllowed = 'move';
                        }}
                        onContextMenu={(e) => handleRightClick(e, l)}
                        className={`cursor-grab rounded px-2 py-1 text-sm text-white shadow transition-colors duration-100 ${categoryColors[cat]?.item || ''}`}
                      >
                        {l.friendly}
                      </div>
                    ))
                )}
              </div>
            </Fragment>
          ))}
        </div>
      </aside>

      {/* Tooltip */}
      <TrainingTooltip 
        component={tooltip.component} 
        position={tooltip.position} 
        onClose={closeTooltip} 
      />
    </>
  );
} 