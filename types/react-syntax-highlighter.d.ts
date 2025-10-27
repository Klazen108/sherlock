declare module 'react-syntax-highlighter' {
  import type { ComponentType, CSSProperties } from 'react';

  export interface SyntaxHighlighterProps {
    language?: string;
    style?: Record<string, unknown>;
    children?: string;
    PreTag?: string | ComponentType<Record<string, unknown>>;
    CodeTag?: string | ComponentType<Record<string, unknown>>;
    customStyle?: CSSProperties;
    wrapLongLines?: boolean;
    codeTagProps?: Record<string, unknown>;
  }

  export const Prism: ComponentType<SyntaxHighlighterProps>;
  export const PrismLight: ComponentType<SyntaxHighlighterProps> & {
    registerLanguage(language: string, definition: unknown): void;
  };
}

declare module 'react-syntax-highlighter/dist/esm/styles/prism' {
  export const oneDark: Record<string, unknown>;
}

declare module 'react-syntax-highlighter/dist/esm/languages/prism/sql' {
  const sql: unknown;
  export default sql;
}
