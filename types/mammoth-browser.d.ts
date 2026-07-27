declare module "mammoth/mammoth.browser" {
  export function extractRawText(input: { arrayBuffer: ArrayBuffer }): Promise<{ value: string }>;
}

declare module "mammoth" {
  export function extractRawText(input: { path: string }): Promise<{ value: string }>;
}
