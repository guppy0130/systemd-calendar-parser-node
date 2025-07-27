import { describe, expect, test } from 'bun:test';
import {
  expandSpecialExpression,
  getNext,
  expandWeekDaySpec,
  systemdCalendarParser,
  expandDateSpec,
  DateIterator,
} from '../src/index';
import { range } from '../src/utils';

/**
 * https://www.freedesktop.org/software/systemd/man/latest/systemd.time.html#Calendar%20Events
 */
const upstreamSpecCases: string[][] = [
  ['Sat,Thu,Mon..Wed,Sat..Sun'],
  ['Mon,Sun 12-*-* 2,1:23'],
  ['Wed *-1'],
  ['Wed..Wed,Wed *-1'],
  // ['Wed, 17:48'],  // TODO: implement trailing comma
  ['Wed..Sat,Tue 12-10-15 1:2:3'],
  ['*-*-7 0:0:0'],
  ['10-15'],
  ['monday *-12-* 17:00'],
  ['Mon,Fri *-*-3,1,2 *:30:45'],
  ['12,14,13,12:20,10,30'],
  ['12..14:10,20,30'],
  ['mon,fri *-1/2-1,3 *:30:45'],
  ['03-05 08:05:40'],
  ['08:05:40'],
  ['05:40'],
  ['Sat,Sun 12-05 08:05:40'],
  ['Sat,Sun 08:05:40'],
  ['2003-03-05 05:40'],
  ['05:40:23.4200004/3.1700005'],
  ['2003-02..04-05'],
  ['2003-03-05 05:40 UTC'],
  ['2003-03-05'],
  ['03-05'],
  ['hourly'],
  ['daily'],
  ['daily UTC'],
  ['monthly'],
  ['weekly'],
  ['weekly Pacific/Auckland'],
  ['yearly'],
  ['annually'],
  ['*:2/3'],
];

/**
 * these ones are provided by us
 */
const ourCases: string[][] = [
  ['*-*-*'],
  ['*:*:*'],
  ['*-*-* *:*:*'],
  ['*-*-* *:*:* America/Chicago'],
  ['*-02~03'],
  ['Mon *-05~07/1'],
];

test.each([...upstreamSpecCases, ...ourCases])('parse %p', (inputStr) => {
  let tokens = systemdCalendarParser.getAST(inputStr);

  expect(tokens).toBeObject();
  expect(tokens.children).toBeArray();
  expect(tokens.children.length).toBeGreaterThan(0);
  expect(tokens.errors.length).toBe(0);
});

describe('expandSpecialExpression', () => {
  test.each([['hourly'], ['daily']])('parses %p', (inputStr) => {
    const tokens = systemdCalendarParser.getAST(inputStr);
    const specialExpression = tokens.children[0]!;
    const result = expandSpecialExpression(specialExpression);
    expect(result).toBeString();
  });

  test.each([['*-*-*']])('throws parsing %p', (inputStr) => {
    const tokens = systemdCalendarParser.getAST(inputStr);
    const specialExpression = tokens.children[0]!;
    expect(() => expandSpecialExpression(specialExpression)).toThrow();
  });
});

const weekDayInputs: [string, number[]][] = [
  ['sunday', [6]],
  ['SUN', [6]],
  ['SunDAY', [6]],
  ['sun,SUN,sUN', [6]],
  ['mon,tue,wedNESDay', [0, 1, 2]],
  ['mon..wed', [0, 1, 2]],
  ['Sat,Thu,Mon..Wed,Sat..Sun', [0, 1, 2, 3, 5, 6]],
];
const badWeekDayInputs: string[][] = [['sun..tue'], ['mon..wed,sun..tue']];

describe('expandWeekDaySpec', () => {
  test.each([...weekDayInputs])('parse %p', (inputStr, expected) => {
    const tokens = systemdCalendarParser.getAST(inputStr).children[0]!;
    const result = expandWeekDaySpec(tokens);
    expect(result).toEqual(expected);
  });

  test.each([...badWeekDayInputs])('throws %p', (inputStr) => {
    expect(() =>
      expandWeekDaySpec(systemdCalendarParser.getAST(inputStr).children[0]!)
    ).toThrow('Systemd starts weeks on Monday');
  });
});

const dateSpecCases: [string, DateIterator][] = [
  ['2025-12-25', { years: range(2025, 2026), months: [12], dates: [25] }]
]
describe('expandDateSpec', () => {
  test.each([...dateSpecCases])('parse %p', (inputStr, expected) => {
    const tokens = systemdCalendarParser.getAST(inputStr).children[0]!;
    const result = expandDateSpec(tokens);
    expect(result).toEqual(expected)
  })
})

describe('getNext', () => {
  test.todo('parse', () => {
    let tokens = systemdCalendarParser.getAST('hourly America/Chicago');
    let referenceDate = new Date("2025-12-25 16:00:00-05:00");
    let nextDate = getNext(tokens, referenceDate);
    expect(nextDate).toEqual(new Date("2025-12-25 17:00:00-05:00"))
  });
});
