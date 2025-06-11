import { useState, useEffect, useRef } from 'react';
import { Editor } from '@monaco-editor/react';
import '../lib/monaco-config'; // Initialize Monaco configuration

interface CodeEditorProps {
  code: string;
  onCodeChange?: (code: string) => void;
}

export default function CodeEditor({ code, onCodeChange }: CodeEditorProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [useTextarea, setUseTextarea] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleCodeChange = (value: string | undefined) => {
    const newCode = value || '';
    onCodeChange?.(newCode);
  };

  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    handleCodeChange(e.target.value);
  };

  const handleEditorDidMount = (editor: any, monaco: any) => {
    console.log('Monaco Editor mounted successfully', { editor, monaco });
    setIsLoading(false);
    setError(null);
  };

  // Timeout fallback to textarea if Monaco fails to load
  useEffect(() => {
    const timeout = setTimeout(() => {
      if (isLoading) {
        console.warn('Monaco Editor taking too long to load, falling back to textarea');
        setUseTextarea(true);
        setIsLoading(false);
        setError('Monaco Editor failed to load - using fallback editor');
      }
    }, 10000); // 10 second timeout for production

    return () => clearTimeout(timeout);
  }, [isLoading]);

  // Try to detect if we're in a problematic environment and use textarea immediately
  useEffect(() => {
    // Check if we're in an environment where Monaco might not work
    const isProblematicEnv = typeof window !== 'undefined' && (
      !window.MonacoEnvironment && 
      !document.querySelector('script[src*="monaco"]') &&
      navigator.userAgent.includes('HeadlessChrome') // Detect some server environments
    );

    if (isProblematicEnv) {
      console.info('Detected environment issues, using fallback editor');
      setUseTextarea(true);
      setIsLoading(false);
      setError(null); // Don't show error for environmental issues
    }
  }, []);

  // Textarea fallback
  if (useTextarea || error) {
    return (
      <div className="w-full h-full relative">
        {error && (
          <div className="absolute top-0 left-0 right-0 bg-blue-50 border-b border-blue-200 px-3 py-2 text-sm text-blue-800 z-10">
            <div className="flex items-center justify-between">
              <span>ℹ️ Using fallback code editor (Monaco Editor not available)</span>
              <button
                onClick={() => window.location.reload()}
                className="px-2 py-1 bg-blue-200 hover:bg-blue-300 rounded text-xs transition-colors"
              >
                Retry
              </button>
            </div>
          </div>
        )}
        <textarea
          ref={textareaRef}
          value={code}
          onChange={handleTextareaChange}
          className={`w-full h-full p-4 font-mono text-sm bg-gray-900 text-green-400 resize-none border-none outline-none ${
            error ? 'mt-12' : ''
          }`}
          style={{
            tabSize: 4,
            lineHeight: '1.5',
          }}
          placeholder="Generated PyTorch code will appear here..."
          spellCheck={false}
        />
      </div>
    );
  }

  return (
    <div className="w-full h-full relative">
      {/* Loading state */}
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-900 text-white z-10">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white mx-auto mb-2"></div>
            <p>Loading code editor...</p>
            <p className="text-xs text-gray-400 mt-1">Falling back to simple editor in 5s...</p>
          </div>
        </div>
      )}

      {/* Monaco Editor */}
      <Editor
        height="100%"
        defaultLanguage="python"
        theme="vs-dark"
        value={code}
        onChange={handleCodeChange}
        onMount={handleEditorDidMount}
        options={{
          minimap: { enabled: true },
          fontSize: 14,
          lineNumbers: 'on',
          rulers: [80],
          wordWrap: 'on',
          automaticLayout: true,
          scrollBeyondLastLine: false,
          renderWhitespace: 'boundary',
          folding: true,
          scrollbar: {
            vertical: 'auto',
            horizontal: 'auto'
          },
          readOnly: false,
          selectOnLineNumbers: true,
          cursorStyle: 'line',
        }}
      />
    </div>
  );
} 