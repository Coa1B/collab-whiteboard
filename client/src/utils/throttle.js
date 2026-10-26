// Calls fn at most once per `wait` ms. The first call runs immediately and the
// latest call during the wait window runs when it ends, so the final position
// is never dropped.
export function throttle(fn, wait) {
  let lastRun = 0;
  let timer = null;
  let pendingArgs = null;

  const run = (args) => {
    lastRun = Date.now();
    fn(...args);
  };

  const throttled = (...args) => {
    const remaining = wait - (Date.now() - lastRun);
    if (remaining <= 0 && !timer) {
      run(args);
      return;
    }
    pendingArgs = args;
    if (!timer) {
      timer = setTimeout(() => {
        timer = null;
        run(pendingArgs);
        pendingArgs = null;
      }, remaining);
    }
  };

  throttled.cancel = () => {
    clearTimeout(timer);
    timer = null;
    pendingArgs = null;
  };

  return throttled;
}
