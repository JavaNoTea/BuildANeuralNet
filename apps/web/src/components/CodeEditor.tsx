import { Editor } from '@monaco-editor/react';

interface CodeEditorProps {
  code: string;
  onCodeChange?: (code: string) => void;
}

export default function CodeEditor({ code, onCodeChange }: CodeEditorProps) {
  const handleCodeChange = (value: string | undefined) => {
    const newCode = value || '';
    onCodeChange?.(newCode);
  };

  return (
    <div className="w-full h-full">
      <Editor
        height="100%"
        defaultLanguage="python"
        theme="vs-dark"
        value={code}
        onChange={handleCodeChange}
        options={{
          minimap: { enabled: true },
          fontSize: 14,
          lineNumbers: 'on',
          rulers: [80],
          wordWrap: 'on',
        }}
      />
    </div>
  );
} 