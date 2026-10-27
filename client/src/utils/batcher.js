// Collects items and hands them to onFlush in one batch every `interval` ms,
// so a burst of mouse events becomes a single network message.
export function createBatcher(onFlush, interval) {
  let buffer = [];
  let timer = null;

  const flush = () => {
    clearTimeout(timer);
    timer = null;
    if (buffer.length === 0) return;
    const batch = buffer;
    buffer = [];
    onFlush(batch);
  };

  const push = (...items) => {
    buffer.push(...items);
    if (!timer) timer = setTimeout(flush, interval);
  };

  const cancel = () => {
    clearTimeout(timer);
    timer = null;
    buffer = [];
  };

  return { push, flush, cancel };
}
