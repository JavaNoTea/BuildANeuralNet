// src/components/PropertyPanel.tsx
import { Dialog } from '@headlessui/react';
import { layerRegistry, LayerMeta } from '@/lib/layerRegistry';
import { trainingRegistry, TrainingMeta } from '@/lib/trainingRegistry';
import { getParameterHelp } from '@/lib/parameterHelp';
import { useFlowStore } from '@/stores/flowStore';
import { FaTrash, FaUndo, FaInfoCircle } from 'react-icons/fa';
import { useState } from 'react';
import React from 'react';

type Meta = LayerMeta | TrainingMeta;

function isMeta(value: Meta | undefined): value is Meta {
  return value !== undefined;
}

// Tooltip component for parameter help
function ParameterTooltip({ paramName, torchClass, children }: { 
  paramName: string; 
  torchClass: string; 
  children: React.ReactNode;
}) {
  const [showTooltip, setShowTooltip] = useState(false);
  const [tooltipStyle, setTooltipStyle] = useState<React.CSSProperties>({});
  const triggerRef = React.useRef<HTMLDivElement>(null);
  const help = getParameterHelp(paramName, torchClass);
  
  if (!help) {
    return <>{children}</>;
  }

  const handleMouseEnter = () => {
    setShowTooltip(true);
    
    // Calculate position relative to the trigger element
    if (triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      setTooltipStyle({
        right: '320px', // Position to the left of the property panel
        top: rect.top + window.scrollY, // Align with the parameter element
        transform: 'none'
      });
    }
  };
  
  return (
    <div className="relative">
      <div
        ref={triggerRef}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={() => setShowTooltip(false)}
        className="flex items-center gap-1 cursor-help"
      >
        {children}
        <FaInfoCircle className="text-xs text-gray-400" />
      </div>
      
      {showTooltip && (
        <div className="fixed z-[10000] w-80 p-3 bg-gray-900 text-white text-xs rounded-lg shadow-lg" 
             style={tooltipStyle}>
          <div className="font-semibold mb-1">{paramName}</div>
          <div className="mb-2 text-gray-200">{help.description}</div>
          <div className="mb-2 text-blue-200">
            <span className="font-medium">Advice:</span> {help.advice}
          </div>
          <div className="text-green-200">
            <span className="font-medium">Default:</span> {
              Array.isArray(help.defaultValue) ? 
                `[${help.defaultValue.join(', ')}]` : 
                String(help.defaultValue)
            }
          </div>
          {/* Triangle pointer - pointing right towards the property panel */}
          <div className="absolute top-3 -right-1 w-2 h-2 bg-gray-900 transform rotate-45"></div>
        </div>
      )}
    </div>
  );
}

export default function PropertyPanel({ nodeId, onClose }: { nodeId: string; onClose: () => void }) {
  const { nodes, edges, setNodes, setEdges } = useFlowStore();
  const node = nodes.find((n) => n.id === nodeId);
  if (!node) return null;

  // Get metadata from the appropriate registry based on whether it's a training node
  const meta: Meta | undefined = node.data.isTraining
    ? trainingRegistry.find((l) => l.torchClass === node.data.registryKey)
    : layerRegistry.find((l) => l.torchClass === node.data.registryKey);

  const updateParam = (key: string, value: any) =>
    setNodes((nds) =>
      nds.map((n) =>
        n.id === nodeId ? { ...n, data: { ...n.data, params: { ...n.data.params, [key]: value } } } : n
      )
    );

  const updateLabel = (value: string) =>
    setNodes((nds) =>
      nds.map((n) =>
        n.id === nodeId ? { ...n, data: { ...n.data, label: value } } : n
      )
    );

  const restoreDefaults = () => {
    if (isMeta(meta)) {
      setNodes((nds) =>
        nds.map((n) =>
          n.id === nodeId ? { ...n, data: { ...n.data, params: { ...meta.defaults } } } : n
        )
      );
    }
  };

  const handleDelete = () => {
    setNodes((nds) => nds.filter((n) => n.id !== nodeId));
    setEdges((eds) => eds.filter((e) => e.source !== nodeId && e.target !== nodeId));
    onClose();
  };

  // If it's not a dataset node and we don't have metadata, return null
  if (!isMeta(meta) && node.data.registryKey !== 'input.dataset') return null;

  // Special handling for dataset node
  if (node.data.registryKey === 'input.dataset') {
    return (
      <Dialog open onClose={onClose} className="fixed inset-0 z-50 flex">
        <Dialog.Panel className="ml-auto w-80 bg-white shadow-xl p-4 space-y-4 overflow-y-auto text-gray-800">
          <div className="flex justify-between items-center">
            <Dialog.Title className="text-lg font-bold text-gray-900">Dataset</Dialog.Title>
            <button 
              onClick={handleDelete}
              className="p-2 text-red-600 hover:text-red-700 hover:bg-red-50 rounded-full transition-colors"
              title="Delete Node"
            >
              <FaTrash />
            </button>
          </div>

          {/* Description */}
          <div className="bg-blue-50 p-3 rounded-lg border-l-4 border-blue-200">
            <p className="text-sm text-blue-800">
              Input dataset node that provides training data. Select from popular computer vision datasets like MNIST, CIFAR10, or ImageNet. This is typically the first node in your model graph.
            </p>
          </div>

          {/* Name field */}
          <div className="space-y-1">
            <label className="text-sm font-semibold text-gray-900">Name</label>
            <input
              type="text"
              value={node.data.label || ''}
              onChange={(e) => updateLabel(e.target.value)}
              placeholder="Dataset"
              className="w-full rounded border px-2 py-1 text-gray-900"
            />
          </div>

          {/* Dataset selection */}
          <div className="space-y-1">
            <label className="text-sm font-semibold text-gray-900">Dataset</label>
            <select
              value={node.data.params.dataset}
              onChange={(e) => updateParam('dataset', e.target.value)}
              className="w-full rounded border px-2 py-1 text-gray-900"
            >
              <option value="torchvision.datasets.MNIST">MNIST</option>
              <option value="torchvision.datasets.FashionMNIST">Fashion MNIST</option>
              <option value="torchvision.datasets.CIFAR10">CIFAR10</option>
              <option value="torchvision.datasets.CIFAR100">CIFAR100</option>
              <option value="torchvision.datasets.ImageNet">ImageNet</option>
              <option value="torchvision.datasets.SVHN">SVHN</option>
              <option value="torchvision.datasets.EMNIST">EMNIST</option>
              <option value="torchvision.datasets.KMNIST">KMNIST</option>
              <option value="torchvision.datasets.QMNIST">QMNIST</option>
              <option value="torchvision.datasets.STL10">STL10</option>
              <option value="torchvision.datasets.CelebA">CelebA</option>
            </select>
          </div>

          <button onClick={onClose} className="w-full bg-blue-600 text-white py-2 rounded">
            Close
          </button>
        </Dialog.Panel>
      </Dialog>
    );
  }

  // At this point, we know we have meta since we're not a dataset node and we passed the earlier check
  if (!isMeta(meta)) return null;

  return (
    <Dialog open onClose={onClose} className="fixed inset-0 z-50 flex">
      <Dialog.Panel className="ml-auto w-80 bg-white shadow-xl p-4 space-y-4 overflow-y-auto text-gray-800">
        <div className="flex justify-between items-center">
          <Dialog.Title className="text-lg font-bold text-gray-900">{meta.friendly}</Dialog.Title>
          <div className="flex gap-2">
            <button 
              onClick={restoreDefaults}
              className="p-2 text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-full transition-colors"
              title="Restore Default Parameters"
            >
              <FaUndo />
            </button>
            <button 
              onClick={handleDelete}
              className="p-2 text-red-600 hover:text-red-700 hover:bg-red-50 rounded-full transition-colors"
              title="Delete Node"
            >
              <FaTrash />
            </button>
          </div>
        </div>

        {/* Description */}
        <div className="bg-blue-50 p-3 rounded-lg border-l-4 border-blue-200">
          <p className="text-sm text-blue-800">
            {meta.description}
          </p>
        </div>

        {/* Name field */}
        <div className="space-y-1">
          <label className="text-sm font-semibold text-gray-900">Name</label>
          <input
            type="text"
            value={node.data.label || ''}
            onChange={(e) => updateLabel(e.target.value)}
            placeholder={meta.friendly}
            className="w-full rounded border px-2 py-1 text-gray-900"
          />
        </div>

        {meta.params.map((p) => (
          <div key={p.name} className="space-y-1">
            <ParameterTooltip paramName={p.name} torchClass={meta.torchClass}>
              <label className="text-sm font-semibold text-gray-900">{p.name}</label>
            </ParameterTooltip>
            {p.type === 'int' || p.type === 'float' ? (
              <input
                type="number"
                min={p.min}
                max={p.max}
                step={p.type === 'float' ? 0.1 : 1}
                value={node.data.params[p.name]}
                onChange={(e) => updateParam(p.name, p.type === 'float' ? parseFloat(e.target.value) : parseInt(e.target.value))}
                className="w-full rounded border px-2 py-1 text-gray-900"
              />
            ) : p.type === 'bool' ? (
              <input
                type="checkbox"
                checked={node.data.params[p.name]}
                onChange={(e) => updateParam(p.name, e.target.checked)}
              />
            ) : p.type === 'select' ? (
              <select
                value={node.data.params[p.name]}
                onChange={(e) => updateParam(p.name, e.target.value)}
                className="w-full rounded border px-2 py-1 text-gray-900"
              >
                {p.options!.map((opt) => (
                  <option key={opt}>{opt}</option>
                ))}
              </select>
            ) : null}
          </div>
        ))}
        <button onClick={onClose} className="w-full bg-blue-600 text-white py-2 rounded">
          Close
        </button>
      </Dialog.Panel>
    </Dialog>
  );
}

