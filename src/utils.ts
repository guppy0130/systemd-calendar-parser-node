/**
 * similar to python's `range` function.
 *
 * @see {@link https://github.com/gebrkn/bits/blob/master/range.js} og source
 * @param a stop if only arg (start = 0)
 * @param b stop if `a` is defined; `a` becomes `start`.
 * @param step how many to step by
 * @returns integers between `a` and `b`, stepping by `step`
 */
export function* range(a: number, b?: number, step?: number): Generator<number> {
  let start = 0;
  let stop = 0;
  let _step = 1;
  switch (arguments.length) {
    case 1:
      start = 0;
      stop = Number(a);
      break;
    case 2:
      start = Number(a);
      stop = Number(b);
      _step = start < stop ? 1 : -1;
      break;
    case 3:
      start = Number(a);
      stop = Number(b);
      _step = Number(step);
      break;
    default:
      throw new Error('Invalid arguments to range');
  }

  if (isNaN(start) || isNaN(stop) || isNaN(_step)) {
    return;
  }

  if (start === stop || !_step) {
    return;
  }

  if (start < stop) {
    if (_step < 0) return;
    while (start < stop) {
      yield start;
      start += _step;
    }
  }

  if (start > stop) {
    if (_step > 0) return;
    while (start > stop) {
      yield start;
      start += _step;
    }
  }
}
