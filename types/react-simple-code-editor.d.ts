declare module 'react-simple-code-editor' {
  import type { CSSProperties, ComponentType } from 'react';

  export interface EditorProps {
    value: string;
    onValueChange(value: string): void;
    highlight(code: string): string;
    padding?: number;
    tabSize?: number;
    insertSpaces?: boolean;
    ignoreTabKey?: boolean;
    textareaId?: string;
    textareaClassName?: string;
    preClassName?: string;
    className?: string;
    style?: CSSProperties;
  }

  const Editor: ComponentType<EditorProps>;
  export default Editor;
}
