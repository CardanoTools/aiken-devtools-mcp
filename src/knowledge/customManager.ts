import fs from "node:fs/promises";
import path from "node:path";
import { KnowledgeSourceSpec } from "./types.js";

export type Category = "documentation" | "library" | "example";

export async function ensureCategoryDir(category: Category): Promise<string> {
  const dir = path.join(process.cwd(), "src", "knowledge", category + (category === "library" ? "ies" : category === "example" ? "s" : ""));
  // The project uses `documentation`, `libraries`, `examples` folders. Map category names to folder names.
  const mapped = category === "documentation" ? "documentation" : category === "library" ? "libraries" : "examples";
  const categoryDir = path.join(process.cwd(), "src", "knowledge", mapped);
  await fs.mkdir(categoryDir, { recursive: true });
  return categoryDir;
}

function renderSpecObject(spec: KnowledgeSourceSpec): string {
  const parts = [] as string[];
  parts.push(`id: \"${spec.id}\"`);
  parts.push(`remoteUrl: \"${spec.remoteUrl}\"`);
  parts.push(`defaultRef: \"${spec.defaultRef}\"`);
  parts.push(`folderName: \"${spec.folderName}\"`);
  if (spec.subPath) parts.push(`subPath: \"${spec.subPath}\"`);
  parts.push(`description: \"${spec.description.replace(/\"/g, '\\\"')}\"`);
  parts.push(`category: \"${spec.category}\"`);
  return `{ ${parts.join(", ")} }`;
}

export async function addCustomSource(category: Category, spec: KnowledgeSourceSpec): Promise<{ ok: true; path: string } | { ok: false; reason: string }> {
  const categoryDir = await ensureCategoryDir(category);
  const filePath = path.join(categoryDir, "customAdded.ts");

  try {
    const exists = await fs.stat(filePath).then(() => true).catch(() => false);
    if (!exists) {
      const content = `import { KnowledgeSourceSpec } from "../types.js";

export const CUSTOM_ADDED_SOURCES: KnowledgeSourceSpec[] = [
  ${renderSpecObject(spec)}
];
`;
      await fs.writeFile(filePath, content, "utf8");
      return { ok: true, path: filePath };
    }

    // file exists - insert into array if not present
    const raw = await fs.readFile(filePath, "utf8");
    if (raw.includes(`id: \"${spec.id}\"`) || raw.includes(`\"${spec.id}\"`)) {
      return { ok: false, reason: "already_exists" };
    }

    // Find the closing bracket of the array: look for last occurrence of "\n];"
    const idx = raw.lastIndexOf("\n];");
    if (idx === -1) {
      return { ok: false, reason: "invalid_file_format" };
    }

    const before = raw.slice(0, idx);
    const after = raw.slice(idx);

    const newItem = `,\n  ${renderSpecObject(spec)}\n`;
    const updated = before + newItem + after;

    await fs.writeFile(filePath, updated, "utf8");
    return { ok: true, path: filePath };
  } catch (err) {
    return { ok: false, reason: (err instanceof Error && err.message) || String(err) };
  }
}

export async function ensureIndexExportsForCategory(category: Category): Promise<{ ok: true; path: string } | { ok: false; reason: string }> {
  const mapped = category === "documentation" ? "documentation" : category === "library" ? "libraries" : "examples";
  const indexPath = path.join(process.cwd(), "src", "knowledge", mapped, "index.ts");

  try {
    const raw = await fs.readFile(indexPath, "utf8");
    if (raw.includes("./customAdded.js") || raw.includes("./customAdded.ts")) {
      return { ok: true, path: indexPath };
    }

    // Insert an export * from "./customAdded.js" after the last export * line (or at top)
    const lines = raw.split(/\r?\n/);
    let insertAt = 0;
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i] ?? "";
      if (line.startsWith("export * from ")) insertAt = i + 1;
    }

    lines.splice(insertAt, 0, "export * from \"./customAdded.js\";");
    const updated = lines.join("\n");
    await fs.writeFile(indexPath, updated, "utf8");
    return { ok: true, path: indexPath };
  } catch (err) {
    return { ok: false, reason: (err instanceof Error && err.message) || String(err) };
  }
}
