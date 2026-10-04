export function element<T extends HTMLElement>(id: string): T {
  const result = document.getElementById(id);
  if (!result) throw new Error(`Missing UI element: ${id}`);
  return result as T;
}
export function lines(value: string): string[] { return [...new Set(value.split('\n').map(x => x.trim()).filter(Boolean))]; }
export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'The change could not be saved. Please reload the extension and try again.';
}
