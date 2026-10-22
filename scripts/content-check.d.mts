export const EMPLOYERS: string[];
export function readable(html: string): string;
export function checkSite(files: Map<string, string>, opts: { showCompanies: boolean; email: string }): string[];
export function emailFromContent(source?: string): string;
export const CV_PATH: string;
export function bannedWords(path: string, text: string): string[];
export function cvText(pdfPath: string): string;
