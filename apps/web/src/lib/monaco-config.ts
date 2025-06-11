// Monaco Editor configuration for production environments

// Configure Monaco Editor environment for better production support
export const configureMonaco = () => {
  // Set up Monaco environment for worker loading
  if (typeof window !== 'undefined') {
    // Configure Monaco environment with proper worker URLs
    (window as any).MonacoEnvironment = {
      getWorkerUrl: function (_moduleId: string, label: string) {
        // Use CDN workers for better reliability in production
        const baseUrl = process.env.NODE_ENV === 'production' 
          ? 'https://cdn.jsdelivr.net/npm/monaco-editor@0.52.2/min/vs'
          : '/node_modules/monaco-editor/min/vs';
        
        if (label === 'json') {
          return `${baseUrl}/language/json/json.worker.js`;
        }
        if (label === 'css' || label === 'scss' || label === 'less') {
          return `${baseUrl}/language/css/css.worker.js`;
        }
        if (label === 'html' || label === 'handlebars' || label === 'razor') {
          return `${baseUrl}/language/html/html.worker.js`;
        }
        if (label === 'typescript' || label === 'javascript') {
          return `${baseUrl}/language/typescript/ts.worker.js`;
        }
        return `${baseUrl}/editor/editor.worker.js`;
      }
    };

    console.log('Monaco environment configured for production with CDN workers');
  }
};

// Initialize Monaco configuration immediately
configureMonaco(); 