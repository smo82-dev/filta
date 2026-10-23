// esbuild bundles .txt files as plain strings (its default "text" loader).
declare module '*.txt' {
  const content: string;
  export default content;
}
