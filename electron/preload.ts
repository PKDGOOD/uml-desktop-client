import { contextBridge, ipcRenderer } from 'electron';

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

contextBridge.exposeInMainWorld('electronAPI', {
  // File I/O
  saveProject(filePath: string, data: string): Promise<void> {
    return ipcRenderer.invoke('ipc:save-project', filePath, data);
  },
  loadProject(filePath: string): Promise<string> {
    return ipcRenderer.invoke('ipc:load-project', filePath);
  },
  saveDiagram(filePath: string, data: string): Promise<void> {
    return ipcRenderer.invoke('ipc:save-diagram', filePath, data);
  },
  loadDiagram(filePath: string): Promise<string> {
    return ipcRenderer.invoke('ipc:load-diagram', filePath);
  },

  // Dialogs
  showSaveDialog(options: SaveDialogOptions): Promise<string | null> {
    return ipcRenderer.invoke('ipc:show-save-dialog', options);
  },
  showOpenDialog(options: OpenDialogOptions): Promise<string | null> {
    return ipcRenderer.invoke('ipc:show-open-dialog', options);
  },

  // Recent Projects
  getRecentProjects(): Promise<string[]> {
    return ipcRenderer.invoke('ipc:get-recent-projects');
  },
  addRecentProject(projectPath: string): Promise<void> {
    return ipcRenderer.invoke('ipc:add-recent-project', projectPath);
  },
});
