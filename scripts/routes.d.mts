export interface Route {
  path: string;
  title: string;
  h1: string;
  facts: string[];
  cap: number;
  file?: boolean;
}
export const routes: Route[];
export const pages: Route[];
export function href(base: string, path: string): string;
export function outFile(path: string): string;
