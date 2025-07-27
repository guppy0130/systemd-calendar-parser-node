import { Parser, type IToken } from '@guppy0130/ebnf';
import { range } from './utils';
import { RULES } from './Grammars/systemd_calendar';
import { findChildrenByType } from '@guppy0130/ebnf/src/SemanticHelpers';

// @ts-ignore: auto-gen doesn't have types
export const systemdCalendarParser: Parser = new Parser(RULES);

// you MUST keep this in sync with systemd_calendar.ebnf
export const SPECIAL_EXPRESSION_EXPANSION_MAP = new Map<string, string>([
  ['minutely', '*-*-* *:*:00'],
  ['hourly', '*-*-* *:00:00'],
  ['daily', '*-*-* 00:00:00'],
  ['weekly', 'Mon *-*-* 00:00:00'],
  ['monthly', '*-*-1 00:00:00'],
  ['quarterly', '*-1,4,7,10-1 00:00:00'],
  ['semiannually', '*-1,7-1 00:00:00'],
  ['yearly', '*-1-1 00:00:00'],
  ['annually', '*-1-1 00:00:00'],
]);

// systemd is monday-indexed!
const SHORT_DAY_NAMES = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];

/**
 * Expected one token type but got another
 */
class UnexpectedTokenTypeError extends TypeError {
  constructor(expectedType: string, receivedType: string) {
    super();
    this.name = 'UnexpectedTokenTypeError';
    this.message = `Expected token type ${expectedType} but got ${receivedType}`;
  }
}

/**
 * Some incorrect number of children
 */
class UnexpectedChildrenError extends Error {
  constructor(tokens: IToken, expected: number | string) {
    super();
    this.name = 'UnexpectedChildrenError';
    this.message = `Expected ${expected} children in ${tokens}, got ${tokens.children.length}`;
  }
}

/**
 * Asserts `tokens` type is `expectedType` (raises if not)
 * @param tokens only checks root token
 * @param expectedType expected type/rule
 */
const assertTokenType = (tokens: IToken, expectedType: string) => {
  if (tokens.type !== expectedType) {
    throw new UnexpectedTokenTypeError(expectedType, tokens.type);
  }
};

/**
 * Assert exactly `expected` number of children
 */
const assertChildrenLengthEQ = (tokens: IToken, expected: number) => {
  if (tokens.children.length !== expected) {
    throw new UnexpectedChildrenError(tokens, expected);
  }
};

/**
 * Assert >= `expected` number of children
 */
const assertChildrenLengthGEQ = (tokens: IToken, minimum: number) => {
  if (tokens.children.length < minimum) {
    throw new UnexpectedChildrenError(tokens, `at least ${minimum}`);
  }
};

/**
 * Assert <= `expected` number of children
 */
const assertChildrenLengthLEQ = (tokens: IToken, maximum: number) => {
  if (tokens.children.length > maximum) {
    throw new UnexpectedChildrenError(tokens, `at most ${maximum}`);
  }
};

/**
 * Walk through a tree of tokens, extracting text if the token type matches.
 * @param tokens tokens to extract text from
 * @param type type to filter by
 * @returns text from tokens whose type matches `type`
 */
const extractTextForType = (tokens: IToken, type: string): string[] => {
  const text: string[] = [];
  if (tokens.type === type) {
    text.push(tokens.text);
  }
  tokens.children.forEach((token) => {
    text.push(...extractTextForType(token, type));
  });
  return text;
};

/**
 * Expand special expressions, e.g., "hourly", "daily", to their full systemd
 * calendar spec
 * @param tokens SpecialExpressions to expand
 * @returns Full grammar specs that need to be parsed again
 */
export const expandSpecialExpression = (tokens: IToken): string => {
  assertTokenType(tokens, 'SpecialExpressions');
  assertChildrenLengthLEQ(tokens, 0);

  // cannot be undefined, enforced by the grammar!
  return SPECIAL_EXPRESSION_EXPANSION_MAP.get(tokens.text)!;
};

/**
 * Parses a `DayOfTheWeek` to its systemd-integer-equivalent; e.g., `mon` to `0`
 * @param tokens DayOfTheWeek tokens to parse
 * @returns systemd-indexed days in the tokens
 */
const parseDayOfTheWeek = (tokens: IToken): number[] => {
  assertTokenType(tokens, 'DayOfTheWeek');
  const days: string[] = extractTextForType(tokens, 'DayOfTheWeek');
  const uniqueDays = new Set(
    days.map((day) => day.toLowerCase().substring(0, 3))
  );

  return [...uniqueDays].map((day) => SHORT_DAY_NAMES.indexOf(day));
};

/**
 * Parses a `RangedWeekDaySpec` into its systemd-integer-equivalent, e.g.,
 * `mon..wed` to `[0,1,2]`
 * @param tokens `RangedWeekDaySpec` tokens to expand
 * @returns systemd-indexed days in the tokens
 */
const parseRangedWeekDaySpec = (tokens: IToken): number[] => {
  assertTokenType(tokens, 'RangedWeekDaySpec');
  assertChildrenLengthEQ(tokens, 2);
  const firstDay = parseDayOfTheWeek(tokens.children[0]!)[0]!;
  const secondDay = parseDayOfTheWeek(tokens.children[1]!)[0]!;
  if (secondDay < firstDay) {
    throw new Error('Systemd starts weeks on Monday');
  }
  return [...range(firstDay, secondDay + 1)];
};

/**
 * Parses a `WeekDaySpecEntry` (i.e., `DayOfTheWeek` or `RangedWeekDaySpec`)
 * into its systemd-integer-equivalent.
 * @param tokens `WeekDaySpecEntry`s to expand into systemd-integer-equivalents
 * @returns systemd-indexed days from each token
 */
const parseWeekDaySpecEntry = (tokens: IToken): number[] => {
  assertTokenType(tokens, 'WeekDaySpecEntry');
  assertChildrenLengthGEQ(tokens, 1);

  const days: number[] = [];
  for (const token of tokens.children) {
    switch (token.type) {
      case 'RangedWeekDaySpec':
        days.push(...parseRangedWeekDaySpec(token));
        break;
      case 'DayOfTheWeek':
        days.push(...parseDayOfTheWeek(token));
        break;
      default:
        throw new UnexpectedTokenTypeError(
          'RangedWeekDaySpec|DayOfTheWeek',
          token.type
        );
    }
  }
  return days;
};

/**
 * Parse a `WeekDaySpec` into a unique, sorted list of ints. Each int is an
 * index in `SHORT_DAY_NAMES`.
 * @param tokens tokens containing `DayOfTheWeek`s
 * @returns ints representing days of the week from the spec
 */
export const expandWeekDaySpec = (tokens: IToken): number[] => {
  assertTokenType(tokens, 'WeekDaySpec');
  assertChildrenLengthGEQ(tokens, 0);

  const days: Set<number> = new Set();
  for (const token of tokens.children) {
    for (const day of parseWeekDaySpecEntry(token)) {
      days.add(day);
    }
  }

  return [...days].sort();
};

/** The maximum value these token types can have */
const tokenTypeToMaximumValue: Map<string, number> = new Map([
  ['Month', 12],
  ['Day', 31],
  ['Hour', 24],
  ['Minute', 60],
  ['Second', 61], // leap seconds...? does systemd handle this?
]);

/**
 * Parse a `TimeUnitSpecEntry` into a unique, sorted list of ints.
 * @param token a TimeUnitSpecEntry to parse
 * @returns list of valid values
 */
const expandTimeUnitSpecEntry = (token: IToken): number[] => {
  assertTokenType(token, 'TimeUnitSpecEntry');
  const values: number[] = [];
  const parentType = token.parent.parent.type;

  // ensure it's a month/day/hour/minute/second and set its max value
  let maxEndValue = tokenTypeToMaximumValue.get(parentType) ?? -Infinity;
  if (maxEndValue === -Infinity) {
    throw TypeError(
      `Unknown ${parentType} not in ${tokenTypeToMaximumValue}`,
      { cause: token.parent.parent }
    );
  }

  for (const child of token.children) {
    switch (child.type) {
      case 'RangedTimeUnit': // either 1..3 or 1..3/2
        assertChildrenLengthEQ(child, 2);
        {
          const start = Number(child.children[0]!.text);
          let end: number = 0;
          let step: number = 1;
          const endToken = child.children[1]!;
          switch (endToken.type) {
            case 'RepeatedTimeUnit':
              end = Number(endToken.children[0]!.text);
              step = Number(endToken.children[1]!.text);
              break;
            case 'TimeUnitNoWildcard':
              end = Number(endToken.text);
              break;
            default:
              throw new RangeError('Invalid end value for RangedTimeUnit', {
                cause: endToken,
              });
          }
          // upper bound this so we can't have 63 seconds
          end = Math.min(end, maxEndValue);
          // TODO: maybe this can move down
          values.push(...range(start, end, step));
        }
        break;

      case 'RepeatedTimeUnit': // 1/2
        const start = Number(child.children[0]!.text);
        const step = Number(child.children[1]!.text);
        values.push(...range(start, maxEndValue, step));
        break;

      case 'TimeUnit':
        const grandchildToken = child.children[0]!;
        switch (grandchildToken.type) {
          case 'TimeUnitNoWildcard':
            values.push(Number(grandchildToken.text));
            break;
          case 'WILDCARD':
            // TODO: handle this
          default:
            throw new Error("TODO");
        }
        break;

      default:
        throw new TypeError('Not a TimeUnitSpecEntry', { cause: child });
    }
  }

  return values;
};

/**
 * expand a `TimeUnitSpec` into a `number[]`
 * @param tokens
 * @returns
 */
const expandTimeUnitSpec = (tokens: IToken[]): number[] => {
  const values: number[] = [];
  for (const token of tokens) {
    // a time unit spec is made up of many time unit spec entries
    assertTokenType(token, 'TimeUnitSpec');
    assertChildrenLengthGEQ(token, 1);
    for (const timeUnitSpecEntryToken of token.children) {
      values.push(...expandTimeUnitSpecEntry(timeUnitSpecEntryToken));
    }
  }
  // make unique + sort values
  return [...(new Set(values))].sort();
};

export type DateIterator = {
  years: Generator<number>;
  months: number[];
  dates: number[];
};

const expandYear = (tokens: IToken[]): Generator<number> => {}

/**
 * Parse a `DateSpec` into a series of generators?
 * @param tokens tokens from the date spec component
 */
export const expandDateSpec = (tokens: IToken): DateIterator => {
  assertTokenType(tokens, 'DateSpec');
  assertChildrenLengthGEQ(tokens, 1);

  console.dir(tokens);

  function* years(start: number, stop: number, step: number) {
    yield* range(start, stop, step);
  }

  const yearTokens = findChildrenByType(tokens, 'Year')[0]!.children;
  const monthTokens = findChildrenByType(tokens, 'Month')[0]!.children;
  const dateTokens = findChildrenByType(tokens, 'Day')[0]!.children;

  return {
    years: years(),
    months: expandTimeUnitSpec(monthTokens),
    dates: expandTimeUnitSpec(dateTokens),
  };
};

/**
 * Get the next elapse
 * @param tokens Return value from systemdCalendarParser.getAST()
 */
export const getNext = (
  tokens: IToken,
  referenceDate: Date = new Date()
): Date => {
  assertTokenType(tokens, 'FullCalendarSpec');
  console.error(tokens, referenceDate);

  return new Date();
};
