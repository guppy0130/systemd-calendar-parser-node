# systemd-calendar-parser-node

parse systemd calendar spec.

To install dependencies:

```bash
bun install
```

```ts
import { systemdCalendarParser } from "systemd-calendar-parser-node/src";

let tokens = systemdCalendarParser.getAST(calendarInput);

// TODO: getNext(), etc.
```
