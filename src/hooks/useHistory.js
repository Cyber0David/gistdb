import { useRef, useState } from 'react';

export function useHistory(initial) {
  const [state, setState] = useState(initial);
  const past = useRef([]);
  const future = useRef([]);

  function set(newState) {
    past.current.push(state);
    if (past.current.length > 100) past.current.shift(); // max 100 steps
    future.current = [];
    setState(newState);
  }

  function undo() {
    if (!past.current.length) return;
    future.current.push(state);
    const prev = past.current.pop();
    setState(prev);
    return prev;
  }

  function redo() {
    if (!future.current.length) return;
    past.current.push(state);
    const next = future.current.pop();
    setState(next);
    return next;
  }

  function canUndo() { return past.current.length > 0; }
  function canRedo() { return future.current.length > 0; }

  return { state, set, undo, redo, canUndo, canRedo };
}
