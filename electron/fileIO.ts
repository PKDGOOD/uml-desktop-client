import { ipcMain, dialog, BrowserWindow } from 'electron';
import fs from 'fs/promises';
import path from 'path';

/**
 * File I/O Manager - Handles project and diagram file read/write operations
 * via IPC handlers in the Electron main process.
 */

export interface SaveDialogOptions {
  title?: string;
  defaultPath?: string;
  filters?: { name: string; extensions: string[] }[];
}

export interface OpenDialogOptions {
  title?: string;
  defaultPath?: string;
  filters?: { name: string; extensions: string[] }[];
  properties?: ('openFile' | 'openDirectory' | 'multiSelections')[];
}

export function registerFileIOHandlers(): void {
  // Save project file (project.uml.json)
  ipcMain.handle('ipc:save-project', async (_event, filePath: string, data: string) => {
    try {
      const dir = path.dirname(filePath);
      await fs.mkdir(dir, { recursive: true });
      await fs.writeFile(filePath, data, 'utf-8');
    } catch (err) {
      throw new Error(`Failed to save project: ${(err as Error).message}`);
    }
  });

  // Load project file (project.uml.json)
  ipcMain.handle('ipc:load-project', async (_event, filePath: string) => {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      return content;
    } catch (err) {
      throw new Error(`Failed to load project: ${(err as Error).message}`);
    }
  });

  // Save individual diagram DSL file (.uml)
  ipcMain.handle('ipc:save-diagram', async (_event, filePath: string, data: string) => {
    try {
      const dir = path.dirname(filePath);
      await fs.mkdir(dir, { recursive: true });
      await fs.writeFile(filePath, data, 'utf-8');
    } catch (err) {
      throw new Error(`Failed to save diagram: ${(err as Error).message}`);
    }
  });

  // Load individual diagram DSL file (.uml)
  ipcMain.handle('ipc:load-diagram', async (_event, filePath: string) => {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      return content;
    } catch (err) {
      throw new Error(`Failed to load diagram: ${(err as Error).message}`);
    }
  });

  // Show native save dialog
  ipcMain.handle('ipc:show-save-dialog', async (_event, options: SaveDialogOptions) => {
    const win = BrowserWindow.getFocusedWindow();
    if (!win) return null;

    const result = await dialog.showSaveDialog(win, {
      title: options.title,
      defaultPath: options.defaultPath,
      filters: options.filters,
    });

    if (result.canceled || !result.filePath) return null;
    return result.filePath;
  });

  // Show native open dialog
  ipcMain.handle('ipc:show-open-dialog', async (_event, options: OpenDialogOptions) => {
    const win = BrowserWindow.getFocusedWindow();
    if (!win) return null;

    const result = await dialog.showOpenDialog(win, {
      title: options.title,
      defaultPath: options.defaultPath,
      filters: options.filters,
      properties: options.properties ?? ['openFile'],
    });

    if (result.canceled || result.filePaths.length === 0) return null;
    return result.filePaths[0];
  });
}
