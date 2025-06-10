// src/components/LayerSidebar.tsx
'use client';
import { layerRegistry, LayerMeta } from '@/lib/layerRegistry';
import { Fragment, useState, useCallback } from 'react';
import React from 'react';
import { DATASET_OPTIONS } from '@/lib/constants';
import { useFlowStore } from '@/stores/flowStore';
import { nanoid } from 'nanoid';

// Color mapping for categories
const categoryColors: Record<string, { header: string; item: string; border: string }> = {
  Input:      { header: 'bg-yellow-100 text-yellow-800', item: 'bg-yellow-500 hover:bg-yellow-600', border: 'border-yellow-300' },
  Layers:      { header: 'bg-blue-100 text-blue-800', item: 'bg-blue-500 hover:bg-blue-600', border: 'border-blue-300' },
  Activations: { header: 'bg-green-100 text-green-800', item: 'bg-green-500 hover:bg-green-600', border: 'border-green-300' },
  Pooling:     { header: 'bg-orange-100 text-orange-800', item: 'bg-orange-500 hover:bg-orange-600', border: 'border-orange-300' },
  Normalization: { header: 'bg-purple-100 text-purple-800', item: 'bg-purple-500 hover:bg-purple-600', border: 'border-purple-300' },
  Loss:        { header: 'bg-red-100 text-red-800', item: 'bg-red-500 hover:bg-red-600', border: 'border-red-300' },
  Utility:     { header: 'bg-gray-100 text-gray-800', item: 'bg-gray-500 hover:bg-gray-600', border: 'border-gray-300' },
};

const DATASETS = [
  { label: 'MNIST', value: 'torchvision.datasets.MNIST' },
  { label: 'FashionMNIST', value: 'torchvision.datasets.FashionMNIST' },
  { label: 'CIFAR10', value: 'torchvision.datasets.CIFAR10' },
  { label: 'CIFAR100', value: 'torchvision.datasets.CIFAR100' },
  { label: 'ImageNet', value: 'torchvision.datasets.ImageNet' },
  { label: 'SVHN', value: 'torchvision.datasets.SVHN' },
  { label: 'EMNIST', value: 'torchvision.datasets.EMNIST' },
  { label: 'KMNIST', value: 'torchvision.datasets.KMNIST' },
  { label: 'QMNIST', value: 'torchvision.datasets.QMNIST' },
  { label: 'STL10', value: 'torchvision.datasets.STL10' },
  { label: 'CelebA', value: 'torchvision.datasets.CelebA' },
];

// Detailed tooltip component for layer information
function LayerTooltip({ layer, position, onClose }: { 
  layer: LayerMeta | null; 
  position: { x: number; y: number } | null;
  onClose: () => void;
}) {
  if (!layer || !position) return null;

  const getMathematicalInfo = (torchClass: string): string | null => {
    const mathInfo: Record<string, string> = {
      'torch.nn.Linear': 'Mathematical Formula: y = xW^T + b\nWhere W is weight matrix, b is bias vector',
      'torch.nn.Conv2d': 'Mathematical Formula: (f * g)(t) = ∫ f(τ)g(t-τ)dτ\nConvolution operation with learnable kernels',
      'torch.nn.ReLU': 'Mathematical Formula: ReLU(x) = max(0, x)\nPiecewise linear function',
      'torch.nn.LeakyReLU': 'Mathematical Formula: LeakyReLU(x) = max(αx, x)\nWhere α is negative slope (typically 0.01)',
      'torch.nn.Sigmoid': 'Mathematical Formula: σ(x) = 1/(1 + e^(-x))\nSquashes values to (0,1) range',
      'torch.nn.Tanh': 'Mathematical Formula: tanh(x) = (e^x - e^(-x))/(e^x + e^(-x))\nSquashes values to (-1,1) range',
      'torch.nn.BatchNorm2d': 'Mathematical Formula: y = (x - μ) / √(σ² + ε) * γ + β\nNormalizes across batch dimension',
      'torch.nn.LSTM': 'Uses forget, input, and output gates with cell state\nLong-term memory through gating mechanisms',
      'torch.nn.MaxPool2d': 'Takes maximum value in each pooling window\nReduces spatial dimensions while preserving features',
    };
    return mathInfo[torchClass] || null;
  };

  const getUseCases = (torchClass: string): string[] => {
    const useCases: Record<string, string[]> = {
      'torch.nn.Linear': ['Classification heads', 'Feature transformation', 'Dense connections', 'Output layers'],
      'torch.nn.Conv2d': ['Image feature extraction', 'Pattern recognition', 'Spatial hierarchy learning', 'CNNs'],
      'torch.nn.ReLU': ['Hidden layer activation', 'Solving vanishing gradients', 'Computational efficiency'],
      'torch.nn.LSTM': ['Sequence modeling', 'NLP tasks', 'Time series prediction', 'Long-term dependencies'],
      'torch.nn.BatchNorm2d': ['Accelerating training', 'Reducing internal covariate shift', 'Regularization'],
      'torch.nn.Dropout': ['Preventing overfitting', 'Model regularization', 'Improving generalization'],
    };
    return useCases[torchClass] || ['General purpose neural network component'];
  };

  const math = getMathematicalInfo(layer.torchClass);
  const useCases = getUseCases(layer.torchClass);

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
          <h3 className="text-lg font-bold text-blue-300">{layer.friendly}</h3>
          <p className="text-xs text-gray-400 font-mono">{layer.torchClass}</p>
        </div>

        {/* Description */}
        <div>
          <h4 className="font-semibold text-green-300 mb-1">Description</h4>
          <p className="text-gray-200 text-xs leading-relaxed">{layer.description}</p>
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

        {/* Parameters */}
        {layer.params.length > 0 && (
          <div>
            <h4 className="font-semibold text-cyan-300 mb-1">Key Parameters</h4>
            <div className="space-y-1">
              {layer.params.slice(0, 4).map((param) => (
                <div key={param.name} className="text-xs">
                  <span className="text-cyan-200 font-medium">{param.name}</span>
                  <span className="text-gray-400"> ({param.type})</span>
                  {param.required && <span className="text-red-400"> *required</span>}
                </div>
              ))}
              {layer.params.length > 4 && (
                <p className="text-gray-500 text-xs">... and {layer.params.length - 4} more parameters</p>
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

export default function LayerSidebar() {
  const { setNodes, setEdges, saveProject, loadProject, clearProject } = useFlowStore();

  // Add template creation functions
  const createResNetTemplate = useCallback(() => {
    // Clear current graph first
    setNodes([]);
    setEdges([]);
    
    const position = { x: 100, y: 100 };
    const spacing = { x: 200, y: 100 };
    const newNodes: any[] = [];
    
    // Input layer
    const inputNode = {
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
    const bnNode = {
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
    
    const reluNode = {
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
    
    const poolNode = {
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
      const resBlock = {
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
    const globalPoolNode = {
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
    
    const flattenNode = {
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
    
    const classifierNode = {
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
    const newEdges: any[] = [
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
    
    setNodes((nds: any[]) => [...nds, ...newNodes]);
    setEdges((eds: any[]) => [...eds, ...newEdges]);
  }, [setNodes, setEdges]);

  const createInceptionTemplate = useCallback(() => {
    // Clear current graph first
    setNodes([]);
    setEdges([]);
    
    const position = { x: 100, y: 100 };
    const spacing = { x: 250, y: 120 };
    const newNodes: any[] = [];
    
    // Initial layers
    const conv1 = {
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
    
    const maxpool1 = {
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
    const inception1 = {
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
    
    const inception2 = {
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
    const globalPool = {
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
    
    const flatten = {
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
    
    const classifier = {
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
    const newEdges: any[] = [
      { id: `${conv1.id}-${maxpool1.id}`, source: conv1.id, target: maxpool1.id, type: 'default' },
      { id: `${maxpool1.id}-${inception1.id}`, source: maxpool1.id, target: inception1.id, type: 'default' },
      { id: `${inception1.id}-${inception2.id}`, source: inception1.id, target: inception2.id, type: 'default' },
      { id: `${inception2.id}-${globalPool.id}`, source: inception2.id, target: globalPool.id, type: 'default' },
      { id: `${globalPool.id}-${flatten.id}`, source: globalPool.id, target: flatten.id, type: 'default' },
      { id: `${flatten.id}-${classifier.id}`, source: flatten.id, target: classifier.id, type: 'default' },
    ];
    
    setNodes((nds: any[]) => [...nds, ...newNodes]);
    setEdges((eds: any[]) => [...eds, ...newEdges]);
  }, [setNodes, setEdges]);

  const [open, setOpen] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    const categories = ['Input', ...new Set(layerRegistry.map((l) => l.category).filter((c) => c !== 'Input'))];
    categories.forEach((cat) => { initial[cat] = true; });
    return initial;
  });

  const [tooltip, setTooltip] = useState<{
    layer: LayerMeta | null;
    position: { x: number; y: number } | null;
  }>({ layer: null, position: null });

  const handleRightClick = (e: React.MouseEvent, layer: LayerMeta) => {
    e.preventDefault();
    setTooltip({
      layer,
      position: { x: e.clientX, y: e.clientY }
    });
  };

  const closeTooltip = () => {
    setTooltip({ layer: null, position: null });
  };

  // Toolbar actions
  const handleNew = () => {
    if (confirm('Clear the current network? This cannot be undone.')) {
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
    setOpen((prev) => {
      const newOpen: Record<string, boolean> = {};
      Object.keys(prev).forEach((key) => {
        newOpen[key] = true;
      });
      return newOpen;
    });
  };

  const handleCollapseAll = () => {
    setOpen((prev) => {
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
                <button onClick={createResNetTemplate} className="w-full text-left px-4 py-2 hover:bg-gray-100 text-gray-900">ResNet Model</button>
                <button onClick={createInceptionTemplate} className="w-full text-left px-4 py-2 hover:bg-gray-100 text-gray-900">Inception Model</button>
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
          {['Input', ...new Set(layerRegistry.map((l) => l.category).filter((c) => c !== 'Input'))].map((cat) => (
            <Fragment key={cat}>
              <button
                className={`w-full flex items-center justify-between px-2 py-1 rounded font-bold uppercase text-xs mb-1 transition-colors duration-150 ${categoryColors[cat]?.header || ''}`}
                onClick={() => setOpen((o) => ({ ...o, [cat]: !o[cat] }))}
                type="button"
              >
                <span>{cat}</span>
                <span className="ml-2">{open[cat] ? '▾' : '▸'}</span>
              </button>
              <div className={`space-y-1 pl-2 border-l-4 ${categoryColors[cat]?.border || ''} transition-all duration-200 ${open[cat] ? 'max-h-[1000px] opacity-100' : 'max-h-0 opacity-0 overflow-hidden'}`}
                style={{ transitionProperty: 'max-height, opacity' }}
              >
                {open[cat] && (
                  cat === 'Input' ? (
                    <div
                      key="Dataset"
                      draggable
                      onDragStart={(e) => {
                        e.dataTransfer.setData(
                          'application/reactflow',
                          JSON.stringify({ registryKey: 'input.dataset' })
                        );
                        e.dataTransfer.effectAllowed = 'move';
                      }}
                      onContextMenu={(e) => {
                        e.preventDefault();
                        // Show dataset info tooltip
                        const datasetInfo: LayerMeta = {
                          category: 'Input',
                          friendly: 'Dataset',
                          torchClass: 'input.dataset',
                          description: 'Input dataset node providing training and validation data to the neural network. Represents the entry point for your machine learning pipeline. Supports popular computer vision datasets like MNIST, CIFAR-10, ImageNet, and more.',
                          defaults: {},
                          params: []
                        };
                        handleRightClick(e, datasetInfo);
                      }}
                      className={`cursor-grab rounded px-2 py-1 text-sm shadow transition-colors duration-100 ${categoryColors[cat]?.item || ''}`}
                    >
                      Dataset
                    </div>
                  ) : (
                    layerRegistry
                      .filter((l) => l.category === cat)
                      .map((l) => (
                        <div
                          key={l.friendly}
                          draggable
                          onDragStart={(e) => {
                            e.dataTransfer.setData(
                              'application/reactflow',
                              JSON.stringify({ registryKey: l.torchClass })
                            );
                            e.dataTransfer.effectAllowed = 'move';
                          }}
                          onContextMenu={(e) => handleRightClick(e, l)}
                          className={`cursor-grab rounded px-2 py-1 text-sm shadow transition-colors duration-100 ${categoryColors[cat]?.item || ''}`}
                        >
                          {l.friendly}
                        </div>
                      ))
                  )
                )}
              </div>
            </Fragment>
          ))}
        </div>
      </aside>

      {/* Tooltip */}
      <LayerTooltip 
        layer={tooltip.layer} 
        position={tooltip.position} 
        onClose={closeTooltip} 
      />
    </>
  );
}

