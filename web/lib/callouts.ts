/** Screen positions of labelled things, sent from the 3D scene to the label layer every frame. */
export type Callout = { key: string; x: number; y: number; a: number };

let handler: ((list: Callout[], compact: boolean) => void) | null = null;

export function onCallouts(fn: (list: Callout[], compact: boolean) => void) {
  handler = fn;
  return () => {
    if (handler === fn) handler = null;
  };
}

export function emitCallouts(list: Callout[], compact = false) {
  handler?.(list, compact);
}
