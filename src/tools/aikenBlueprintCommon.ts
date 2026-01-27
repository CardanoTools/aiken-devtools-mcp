export function toBlueprintToolError(message: string): { isError: true; content: Array<{ type: "text"; text: string }> } {
  return {
    isError: true,
    content: [{ type: "text", text: message }]
  };
}

export function toBlueprintToolOk<TStructured>(
  message: string,
  structuredContent: TStructured
): { content: Array<{ type: "text"; text: string }>; structuredContent: TStructured } {
  return {
    content: [{ type: "text", text: message }],
    structuredContent
  };
}

type UnknownRecord = Record<string, unknown>;

export function getOptionalString(obj: unknown, key: string): string | undefined {
  if (!obj || typeof obj !== "object") return undefined;
  const record = obj as UnknownRecord;
  const value = record[key];
  return typeof value === "string" ? value : undefined;
}

export function hasOwn(obj: unknown, key: string): boolean {
  if (!obj || typeof obj !== "object") return false;
  return Object.prototype.hasOwnProperty.call(obj, key);
}
