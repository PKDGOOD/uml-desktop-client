import { ipcMain, app } from 'electron';
import fs from 'fs/promises';
import path from 'path';

const MAX_RECENT = 10;
const RECENT_FILE_NAME = 'recent-projects.json';

/**
 * Recent Projects Manager
 *
 * Stores recent project paths in a JSON file inside the app's userData directory.
 * Max 10 entries, reverse chronological order (most recent first).
 */
export class RecentProjectsManager {
  private filePath: string;
  private projects: string[] = [];
  private loaded = false;

  constructor(filePath: string) {
    this.filePath = filePath;
  }

  /** Load recent projects list from disk */
  async load(): Promise<void> {
    try {
      const raw = await fs.readFile(this.filePath, 'utf-8');
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        this.projects = parsed.filter((p): p is string => typeof p === 'string');
      }
    } catch {
      // File doesn't exist or is invalid — start with empty list
      this.projects = [];
    }
    this.loaded = true;
  }

  /** Persist current list to disk */
  private async save(): Promise<void> {
    const dir = path.dirname(this.filePath);
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(this.filePath, JSON.stringify(this.projects), 'utf-8');
  }

  /** Add a project path (or move it to the top if already present). */
  async addRecent(projectPath: string): Promise<void> {
    if (!this.loaded) await this.load();

    // Remove if already exists
    this.projects = this.projects.filter((p) => p !== projectPath);
    // Add to front
    this.projects.unshift(projectPath);
    // Enforce max limit
    if (this.projects.length > MAX_RECENT) {
      this.projects = this.projects.slice(0, MAX_RECENT);
    }
    await this.save();
  }

  /** Get the recent projects list (most recent first). */
  async getRecent(): Promise<string[]> {
    if (!this.loaded) await this.load();
    return [...this.projects];
  }

  /** Remove a specific project path from the list. */
  async removeRecent(projectPath: string): Promise<void> {
    if (!this.loaded) await this.load();
    this.projects = this.projects.filter((p) => p !== projectPath);
    await this.save();
  }
}

let manager: RecentProjectsManager | null = null;

function getManager(): RecentProjectsManager {
  if (!manager) {
    const userDataPath = app.getPath('userData');
    manager = new RecentProjectsManager(path.join(userDataPath, RECENT_FILE_NAME));
  }
  return manager;
}

export function registerRecentProjectsHandlers(): void {
  ipcMain.handle('ipc:get-recent-projects', async () => {
    return getManager().getRecent();
  });

  ipcMain.handle('ipc:add-recent-project', async (_event, projectPath: string) => {
    await getManager().addRecent(projectPath);
  });

  ipcMain.handle('ipc:remove-recent-project', async (_event, projectPath: string) => {
    await getManager().removeRecent(projectPath);
  });
}
