import { expect, test } from 'bun:test';
import { range } from '../src/utils';

const rangeCases: [[number, number?, number?], number[]][] = [
  [[3], [0, 1, 2]],
  [
    [2, 5],
    [2, 3, 4],
  ],
  [
    [0, 5, 2],
    [0, 2, 4],
  ],
  [
    [5, 0, -1],
    [5, 4, 3, 2, 1],
  ],
  [[2025, 2026], [2025]],
];

test.each([...rangeCases])('range(...%p) => %p', (rangeArgs, expected) => {
  expect([...range(...rangeArgs)]).toEqual(expected);
});
