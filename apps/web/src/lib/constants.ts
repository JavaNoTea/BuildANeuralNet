// Dataset shapes and metadata
export const DATASET_SHAPES: Record<string, { shape: number[]; type: string }> = {
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

// Dataset options for UI
export const DATASET_OPTIONS = Object.keys(DATASET_SHAPES).map(value => ({
  label: value.split('.').pop()!,
  value
})); 