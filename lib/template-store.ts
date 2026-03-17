/**
 * Template Store — loads templates and packs from the filesystem.
 */

import { readdir, readFile } from "fs/promises";
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
    // Try direct file match
    const direct = await loadJsonFile<TemplateDefinition>(join(TEMPLATES_DIR, `${id}.json`));
    if (direct) {
      if (!direct.id) direct.id = id;
      return direct;
    }

    // Fallback: scan all templates
    const all = await this.listTemplates();
    return all.find((t) => t.id === id) ?? null;
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
