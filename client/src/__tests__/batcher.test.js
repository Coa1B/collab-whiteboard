import { createBatcher } from '../utils/batcher';

beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());

test('groups items pushed within the interval into one flush', () => {
  const onFlush = jest.fn();
  const b = createBatcher(onFlush, 40);
  b.push(1, 2);
  b.push(3, 4);
  expect(onFlush).not.toHaveBeenCalled();
  jest.advanceTimersByTime(40);
  expect(onFlush).toHaveBeenCalledTimes(1);
  expect(onFlush).toHaveBeenCalledWith([1, 2, 3, 4]);
});

test('flush sends immediately and does not send again on the timer', () => {
  const onFlush = jest.fn();
  const b = createBatcher(onFlush, 40);
  b.push(1);
  b.flush();
  jest.advanceTimersByTime(40);
  expect(onFlush).toHaveBeenCalledTimes(1);
});

test('flush with nothing buffered is a no-op', () => {
  const onFlush = jest.fn();
  createBatcher(onFlush, 40).flush();
  expect(onFlush).not.toHaveBeenCalled();
});

test('cancel discards buffered items', () => {
  const onFlush = jest.fn();
  const b = createBatcher(onFlush, 40);
  b.push(1);
  b.cancel();
  jest.advanceTimersByTime(40);
  expect(onFlush).not.toHaveBeenCalled();
});
