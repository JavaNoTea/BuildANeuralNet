declare module '@monaco-editor/react' {
  interface EditorProps {
    height: string | number;
    defaultLanguage?: string;
    language?: string;
    value?: string;
    theme?: string;
    options?: any;
    onChange?: (value: string | undefined) => void;
    onMount?: (editor: any, monaco: any) => void;
  }

  export const Editor: React.ComponentType<EditorProps>;
} 