import { throttle } from '../utils/throttle';

beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());

test('runs the first call immediately', () => {
  const fn = jest.fn();
  throttle(fn, 50)(1);
  expect(fn).toHaveBeenCalledWith(1);
});

test('collapses calls within the window and sends the latest one at the end', () => {
  const fn = jest.fn();
  const t = throttle(fn, 50);
  t(1);
  t(2);
  t(3);
  expect(fn).toHaveBeenCalledTimes(1);
  jest.advanceTimersByTime(50);
  expect(fn).toHaveBeenCalledTimes(2);
  expect(fn).toHaveBeenLastCalledWith(3);
});

test('cancel drops the pending call', () => {
  const fn = jest.fn();
  const t = throttle(fn, 50);
  t(1);
  t(2);
  t.cancel();
  jest.advanceTimersByTime(50);
  expect(fn).toHaveBeenCalledTimes(1);
});
