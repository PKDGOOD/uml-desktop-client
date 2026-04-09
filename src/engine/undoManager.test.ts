import { describe, it, expect } from 'vitest';
import { UndoManager } from './undoManager';
import type { Command } from '../types';

/** Helper: creates a Command that increments/decrements a shared counter */
function makeCounterCommand(counter: { value: number }, delta: number, desc: string): Command {
  return {
    description: desc,
    execute() { counter.value += delta; },
    undo() { counter.value -= delta; },
  };
}

describe('UndoManager', () => {
  // --- Basic execute / undo / redo ---

  it('executes a command and updates state', () => {
    const mgr = new UndoManager();
    const counter = { value: 0 };
    mgr.execute(makeCounterCommand(counter, 5, 'add 5'));
    expect(counter.value).toBe(5);
  });

  it('undo reverses the last command', () => {
    const mgr = new UndoManager();
    const counter = { value: 0 };
    mgr.execute(makeCounterCommand(counter, 3, 'add 3'));
    mgr.undo();
    expect(counter.value).toBe(0);
  });

  it('redo re-applies the undone command', () => {
    const mgr = new UndoManager();
    const counter = { value: 0 };
    mgr.execute(makeCounterCommand(counter, 7, 'add 7'));
    mgr.undo();
    mgr.redo();
    expect(counter.value).toBe(7);
  });

  it('supports multiple execute → undo → redo steps', () => {
    const mgr = new UndoManager();
    const counter = { value: 0 };
    mgr.execute(makeCounterCommand(counter, 1, 'a'));
    mgr.execute(makeCounterCommand(counter, 2, 'b'));
    mgr.execute(makeCounterCommand(counter, 3, 'c'));
    expect(counter.value).toBe(6);

    mgr.undo(); // undo c
    expect(counter.value).toBe(3);
    mgr.undo(); // undo b
    expect(counter.value).toBe(1);
    mgr.redo(); // redo b
    expect(counter.value).toBe(3);
    mgr.redo(); // redo c
    expect(counter.value).toBe(6);
  });

  // --- canUndo / canRedo state tracking ---

  it('canUndo is false on fresh manager', () => {
    expect(new UndoManager().canUndo()).toBe(false);
  });

  it('canRedo is false on fresh manager', () => {
    expect(new UndoManager().canRedo()).toBe(false);
  });

  it('canUndo becomes true after execute', () => {
    const mgr = new UndoManager();
    mgr.execute(makeCounterCommand({ value: 0 }, 1, 'x'));
    expect(mgr.canUndo()).toBe(true);
  });

  it('canRedo becomes true after undo', () => {
    const mgr = new UndoManager();
    mgr.execute(makeCounterCommand({ value: 0 }, 1, 'x'));
    mgr.undo();
    expect(mgr.canRedo()).toBe(true);
  });

  it('canUndo becomes false after undoing all commands', () => {
    const mgr = new UndoManager();
    mgr.execute(makeCounterCommand({ value: 0 }, 1, 'x'));
    mgr.undo();
    expect(mgr.canUndo()).toBe(false);
  });

  it('canRedo becomes false after redoing all commands', () => {
    const mgr = new UndoManager();
    mgr.execute(makeCounterCommand({ value: 0 }, 1, 'x'));
    mgr.undo();
    mgr.redo();
    expect(mgr.canRedo()).toBe(false);
  });

  // --- Redo stack cleared after new execute ---

  it('clears redo stack when a new command is executed after undo', () => {
    const mgr = new UndoManager();
    const counter = { value: 0 };
    mgr.execute(makeCounterCommand(counter, 1, 'a'));
    mgr.execute(makeCounterCommand(counter, 2, 'b'));
    mgr.undo(); // undo b → redo has b
    expect(mgr.canRedo()).toBe(true);

    mgr.execute(makeCounterCommand(counter, 10, 'c')); // new command
    expect(mgr.canRedo()).toBe(false);
    expect(mgr.redoStackSize).toBe(0);
  });

  // --- maxHistory limit enforcement ---

  it('defaults maxHistory to 50', () => {
    expect(new UndoManager().maxHistory).toBe(50);
  });

  it('accepts custom maxHistory', () => {
    expect(new UndoManager(100).maxHistory).toBe(100);
  });

  it('trims undo stack when exceeding maxHistory', () => {
    const mgr = new UndoManager(5);
    const counter = { value: 0 };
    for (let i = 1; i <= 8; i++) {
      mgr.execute(makeCounterCommand(counter, 1, `cmd-${i}`));
    }
    expect(mgr.undoStackSize).toBe(5);
    // counter should still reflect all 8 executions
    expect(counter.value).toBe(8);
  });

  it('oldest entries are removed when maxHistory exceeded', () => {
    const mgr = new UndoManager(3);
    const counter = { value: 0 };
    mgr.execute(makeCounterCommand(counter, 1, 'a'));
    mgr.execute(makeCounterCommand(counter, 2, 'b'));
    mgr.execute(makeCounterCommand(counter, 3, 'c'));
    mgr.execute(makeCounterCommand(counter, 4, 'd'));
    // stack should be [b, c, d] (a trimmed)
    expect(mgr.undoStackSize).toBe(3);

    mgr.undo(); // undo d
    mgr.undo(); // undo c
    mgr.undo(); // undo b
    expect(counter.value).toBe(1); // only 'a' remains applied (can't undo it)
    expect(mgr.canUndo()).toBe(false);
  });

  // --- Edge cases ---

  it('undo on empty stack is a no-op', () => {
    const mgr = new UndoManager();
    mgr.undo(); // should not throw
    expect(mgr.canUndo()).toBe(false);
    expect(mgr.canRedo()).toBe(false);
  });

  it('redo on empty stack is a no-op', () => {
    const mgr = new UndoManager();
    mgr.redo(); // should not throw
    expect(mgr.canUndo()).toBe(false);
    expect(mgr.canRedo()).toBe(false);
  });

  it('redo after redo stack is exhausted is a no-op', () => {
    const mgr = new UndoManager();
    const counter = { value: 0 };
    mgr.execute(makeCounterCommand(counter, 1, 'a'));
    mgr.undo();
    mgr.redo();
    mgr.redo(); // extra redo — no-op
    expect(counter.value).toBe(1);
  });

  it('interleaved undo/redo/execute maintains correct state', () => {
    const mgr = new UndoManager();
    const counter = { value: 0 };

    mgr.execute(makeCounterCommand(counter, 10, 'a'));  // 10
    mgr.execute(makeCounterCommand(counter, 20, 'b'));  // 30
    mgr.undo();                                          // 10
    mgr.execute(makeCounterCommand(counter, 5, 'c'));   // 15, redo cleared
    expect(counter.value).toBe(15);
    expect(mgr.canRedo()).toBe(false);

    mgr.undo(); // undo c → 10
    expect(counter.value).toBe(10);
    mgr.undo(); // undo a → 0
    expect(counter.value).toBe(0);
    expect(mgr.canUndo()).toBe(false);
  });
});
