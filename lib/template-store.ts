/**
 * Template Store — loads templates and packs from the filesystem.
 */

import { readdir, readFile, writeFile, mkdir } from "fs/promises";
import { join } from "path";
import type { TemplateDefinition, PackDefinition } from "@/lib/template-types";

const PROJECT_ROOT = process.cwd();
const TEMPLATES_DIR = join(PROJECT_ROOT, "templates");
const PACKS_DIR = join(PROJECT_ROOT, "packs");

async function safeReadDir(dir: string): Promise<string[]> {
  try {
    return await readdir(dir);
  } catch {
    return [];
  }
}

async function loadJsonFile<T>(filePath: string): Promise<T | null> {
  try {
    const content = await readFile(filePath, "utf-8");
    return JSON.parse(content) as T;
  } catch {
    return null;
  }
}

export interface TemplateStore {
  listTemplates(): Promise<TemplateDefinition[]>;
  getTemplate(id: string): Promise<TemplateDefinition | null>;
  saveTemplate(template: TemplateDefinition): Promise<void>;
  listPacks(): Promise<PackDefinition[]>;
  getPack(id: string): Promise<PackDefinition | null>;
}

class FileSystemTemplateStore implements TemplateStore {
  async listTemplates(): Promise<TemplateDefinition[]> {
    const files = await safeReadDir(TEMPLATES_DIR);
    const jsonFiles = files.filter((f) => f.endsWith(".json"));
    const templates: TemplateDefinition[] = [];

    for (const file of jsonFiles) {
      const template = await loadJsonFile<TemplateDefinition>(join(TEMPLATES_DIR, file));
      if (template) {
        // Derive id from filename if not set
        if (!template.id) {
          template.id = file.replace(/\.json$/, "");
        }
        templates.push(template);
      }
    }

    return templates;
  }

  async getTemplate(id: string): Promise<TemplateDefinition | null> {
    // Sanitize id to prevent path traversal (allow only alphanumeric, dash, underscore)
    const safeId = id.replace(/[^a-zA-Z0-9_-]/g, "");
    if (!safeId) return null;

    // Try direct file match
    const filePath = join(TEMPLATES_DIR, `${safeId}.json`);
    // Verify path stays within TEMPLATES_DIR
    if (!filePath.startsWith(TEMPLATES_DIR)) return null;

    const direct = await loadJsonFile<TemplateDefinition>(filePath);
    if (direct) {
      if (!direct.id) direct.id = safeId;
      return direct;
    }

    // Fallback: scan all templates
    const all = await this.listTemplates();
    return all.find((t) => t.id === id) ?? null;
  }

  async saveTemplate(template: TemplateDefinition): Promise<void> {
    const safeId = (template.id || "untitled").replace(/[^a-zA-Z0-9_-]/g, "_");
    await mkdir(TEMPLATES_DIR, { recursive: true });
    const filePath = join(TEMPLATES_DIR, `${safeId}.json`);
    // Verify path stays within TEMPLATES_DIR
    if (!filePath.startsWith(TEMPLATES_DIR)) {
      throw new Error("Invalid template ID");
    }
    await writeFile(filePath, JSON.stringify(template, null, 2), "utf-8");
  }

  async listPacks(): Promise<PackDefinition[]> {
    const entries = await safeReadDir(PACKS_DIR);
    const packs: PackDefinition[] = [];

    for (const entry of entries) {
      const packFile = join(PACKS_DIR, entry, "pack.json");
      const pack = await loadJsonFile<PackDefinition>(packFile);
      if (pack) {
        if (!pack.id) pack.id = entry;
        packs.push(pack);
      }
    }

    return packs;
  }

  async getPack(id: string): Promise<PackDefinition | null> {
    const packFile = join(PACKS_DIR, id, "pack.json");
    const pack = await loadJsonFile<PackDefinition>(packFile);
    if (pack && !pack.id) pack.id = id;
    return pack;
  }
}

export const templateStore: TemplateStore = new FileSystemTemplateStore();
