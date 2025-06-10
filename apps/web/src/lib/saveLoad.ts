// Use any types to avoid compatibility issues with ReactFlow types
export interface SavedState {
  version: string;
  timestamp: number;
  modelNodes: any[];
  modelEdges: any[];
  trainingNodes: any[];
  trainingEdges: any[];
  code: string;
  mode: 'model' | 'training' | 'code';
}

export const saveProject = (
  modelNodes: any[],
  modelEdges: any[],
  trainingNodes: any[],
  trainingEdges: any[],
  code: string,
  mode: 'model' | 'training' | 'code'
): void => {
  const state: SavedState = {
    version: '1.0.0',
    timestamp: Date.now(),
    modelNodes,
    modelEdges,
    trainingNodes,
    trainingEdges,
    code,
    mode,
  };

  try {
    const stateJson = JSON.stringify(state, null, 2);
    const blob = new Blob([stateJson], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `nn-builder-project-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    // Also save to localStorage as backup
    localStorage.setItem('nn-builder-last-save', stateJson);
    
    console.log('Project saved successfully');
  } catch (error) {
    console.error('Failed to save project:', error);
    alert('Failed to save project. Please try again.');
  }
};

export const loadProject = (): Promise<SavedState | null> => {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) {
        resolve(null);
        return;
      }
      
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const content = e.target?.result as string;
          const state: SavedState = JSON.parse(content);
          
          // Validate the loaded state
          if (!state.version || !state.modelNodes || !state.trainingNodes) {
            throw new Error('Invalid file format');
          }
          
          console.log('Project loaded successfully');
          resolve(state);
        } catch (error) {
          console.error('Failed to load project:', error);
          alert('Failed to load project. Please check the file format.');
          resolve(null);
        }
      };
      
      reader.readAsText(file);
    };
    
    input.oncancel = () => {
      resolve(null);
    };
    
    input.click();
  });
};

export const loadLastSave = (): SavedState | null => {
  try {
    const lastSave = localStorage.getItem('nn-builder-last-save');
    if (!lastSave) return null;
    
    const state: SavedState = JSON.parse(lastSave);
    return state;
  } catch (error) {
    console.error('Failed to load last save:', error);
    return null;
  }
};

export const clearProject = (): SavedState => {
  return {
    version: '1.0.0',
    timestamp: Date.now(),
    modelNodes: [],
    modelEdges: [],
    trainingNodes: [],
    trainingEdges: [],
    code: '# Click "Generate Code" to generate PyTorch code from your model',
    mode: 'model',
  };
}; 