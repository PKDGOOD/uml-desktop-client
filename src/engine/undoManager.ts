import type { Command } from '../types';

export class UndoManager {
  private undoStack: Command[] = [];
  private redoStack: Command[] = [];
  readonly maxHistory: number;

  constructor(maxHistory: number = 50) {
    this.maxHistory = maxHistory;
  }

  execute(command: Command): void {
    command.execute();
    this.undoStack.push(command);
    // Clear redo stack when a new command is executed
    this.redoStack = [];
    // Trim undo stack if it exceeds maxHistory
    if (this.undoStack.length > this.maxHistory) {
      this.undoStack.splice(0, this.undoStack.length - this.maxHistory);
    }
  }

  undo(): void {
    const command = this.undoStack.pop();
    if (!command) return;
    command.undo();
    this.redoStack.push(command);
  }

  redo(): void {
    const command = this.redoStack.pop();
    if (!command) return;
    command.execute();
    this.undoStack.push(command);
  }

  clear(): void {
    this.undoStack = [];
    this.redoStack = [];
  }

  canUndo(): boolean {
    return this.undoStack.length > 0;
  }

  canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  get undoStackSize(): number {
    return this.undoStack.length;
  }

  get redoStackSize(): number {
    return this.redoStack.length;
  }
}
