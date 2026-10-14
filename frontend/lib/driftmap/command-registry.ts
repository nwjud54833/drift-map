import { useEffect, useRef, useState } from "react";

export interface PaletteCommand {
  id: string;
  title: string;
  category: string;
  shortcut?: string;
  /** Extra search terms so "3d graph", "audio" or "breaking" all match. */
  keywords?: readonly string[];
  run: () => void;
}

/**
 * Per-route registry for the global ⌘K command palette.
 *
 * The shell owns one palette for the whole app, but the commands that make
 * sense on `/` (scrub the schema timeline) are different from those on
 * `/workbench` (switch to the 3D graph, export the report). Each page
 * contributes its own commands here and they are released when the page
 * unmounts, so the palette never offers an action that cannot run.
 */
type Registry = Map<string, PaletteCommand>;

const listeners = new Set<(commands: PaletteCommand[]) => void>();
const registry: Registry = new Map();

function emit(): void {
  const snapshot = [...registry.values()];
  for (const listener of listeners) listener(snapshot);
}

/** Registers a set of commands, replacing any previous set with the same source id. */
export function registerCommands(source: string, commands: readonly PaletteCommand[]): () => void {
  for (const key of [...registry.keys()]) {
    if (key.startsWith(`${source}::`)) registry.delete(key);
  }
  for (const command of commands) registry.set(`${source}::${command.id}`, command);
  emit();
  return () => unregisterCommands(source);
}

export function unregisterCommands(source: string): void {
  let changed = false;
  for (const key of [...registry.keys()]) {
    if (key.startsWith(`${source}::`)) {
      registry.delete(key);
      changed = true;
    }
  }
  if (changed) emit();
}

export function useRegisteredCommands(source: string, commands: readonly PaletteCommand[], deps: readonly unknown[] = []): void {
  // `commands` is rebuilt every render by callers; the dependency list is what
  // decides when the registry actually refreshes.
  const latest = useRef(commands);
  latest.current = commands;

  useEffect(() => {
    const release = registerCommands(source, latest.current);
    return release;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [source, ...deps]);
}

export function usePaletteCommands(): PaletteCommand[] {
  const [commands, setCommands] = useState<PaletteCommand[]>(() => [...registry.values()]);
  useEffect(() => {
    const listener = (next: PaletteCommand[]) => setCommands(next);
    listeners.add(listener);
    listener([...registry.values()]);
    return () => {
      listeners.delete(listener);
    };
  }, []);
  return commands;
}
