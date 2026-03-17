import db from "@/lib/db";

export type AppSettings = {
  routingModel: "haiku" | "sonnet" | "opus";
  generationModel: "haiku" | "sonnet" | "opus";
  promptCaching: boolean;
  monthlySpendLimit: number;
  usersAllowlist: string[];
};

const DEFAULT_SETTINGS: AppSettings = {
  routingModel: "haiku",
  generationModel: "sonnet",
  promptCaching: true,
  monthlySpendLimit: 500,
  usersAllowlist: [],
};

class AppSettingsStore {
  private getSetting(key: keyof Omit<AppSettings, "usersAllowlist">): unknown {
    const row = db.prepare("SELECT value FROM app_settings WHERE key = ?").get(String(key)) as { value: string } | undefined;
    if (!row) return undefined;
    try {
      return JSON.parse(row.value);
    } catch {
      return undefined;
    }
  }

  private setSetting(key: keyof Omit<AppSettings, "usersAllowlist">, value: unknown): void {
    db.prepare(
      "INSERT INTO app_settings(key, value) VALUES(?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value"
    ).run(String(key), JSON.stringify(value));
  }

  private listUsers(): string[] {
    return (db.prepare("SELECT email FROM users ORDER BY email ASC").all() as Array<{ email: string }>).map((row) => row.email);
  }

  private syncUsers(users: string[]): void {
    const normalized = Array.from(new Set(users.map((email) => email.trim().toLowerCase()).filter(Boolean)));
    const tx = db.transaction((items: string[]) => {
      db.prepare("DELETE FROM users").run();
      const insert = db.prepare("INSERT INTO users(email, role, added_at) VALUES(?, 'operator', ?)");
      const now = new Date().toISOString();
      for (const email of items) insert.run(email, now);
    });
    tx(normalized);
  }

  async load(): Promise<AppSettings> {
    return {
      routingModel: (this.getSetting("routingModel") as AppSettings["routingModel"]) || DEFAULT_SETTINGS.routingModel,
      generationModel: (this.getSetting("generationModel") as AppSettings["generationModel"]) || DEFAULT_SETTINGS.generationModel,
      promptCaching: (this.getSetting("promptCaching") as boolean | undefined) ?? DEFAULT_SETTINGS.promptCaching,
      monthlySpendLimit: Number(this.getSetting("monthlySpendLimit") ?? DEFAULT_SETTINGS.monthlySpendLimit),
      usersAllowlist: this.listUsers(),
    };
  }

  async save(settings: AppSettings): Promise<void> {
    this.setSetting("routingModel", settings.routingModel);
    this.setSetting("generationModel", settings.generationModel);
    this.setSetting("promptCaching", settings.promptCaching);
    this.setSetting("monthlySpendLimit", settings.monthlySpendLimit);
    this.syncUsers(settings.usersAllowlist);
  }

  async update(partial: Partial<AppSettings>): Promise<AppSettings> {
    const current = await this.load();
    const next = { ...current, ...partial };

    this.setSetting("routingModel", next.routingModel);
    this.setSetting("generationModel", next.generationModel);
    this.setSetting("promptCaching", next.promptCaching);
    this.setSetting("monthlySpendLimit", next.monthlySpendLimit);

    if (partial.usersAllowlist) {
      this.syncUsers(partial.usersAllowlist);
    }

    return this.load();
  }
}

export const appSettingsStore = new AppSettingsStore();
