# Research Notes — context7 Queries

Documented queries made via context7 MCP during Agent 2 (code generation) phase.

---

## Query 1: decimal.js for monetary arithmetic in Node.js

- **Search**: "decimal.js Node.js monetary arithmetic rounding"
- **context7 library ID**: `/mikemcl/decimal.js`
- **Key insight**: `new Decimal(String(amount))` — always convert from string, not from
  JS number, to avoid float precision loss at the point of ingestion. Use `.gte()`, `.lte()`,
  `.plus()` for comparisons and accumulation.
- **Applied**: All amount comparisons in `fraud_detector.js` and `compliance_checker.js`
  use `new Decimal(String(transaction.amount)).gte(threshold)` rather than
  `parseFloat(transaction.amount) >= threshold`.

```javascript
// Applied pattern from context7 result:
const { Decimal } = require('decimal.js');
const amount = new Decimal(String(transaction.amount)); // safe string parse
const score = score.plus(RISK_WEIGHTS.HIGH_VALUE);      // exact decimal addition
```

---

## Query 2: Node.js crypto.randomUUID() for message IDs

- **Search**: "Node.js crypto randomUUID built-in UUID generation"
- **context7 library ID**: `/nodejs/node` (crypto module)
- **Key insight**: `crypto.randomUUID()` is available natively in Node.js 14.17+ (stable
  in Node 19+). No need for the `uuid` npm package. Returns a RFC 4122 v4 UUID string.
- **Applied**: Used in `src/utils/message.js` to generate `message_id` for every pipeline
  message envelope without adding an external dependency.

```javascript
// Applied pattern from context7 result:
const { randomUUID } = require('crypto');
const createMessage = (sourceAgent, targetAgent, messageType, data) => ({
  message_id: randomUUID(),
  // ...
});
```

---

## Query 3: Jest coverageThreshold configuration

- **Search**: "Jest coverageThreshold configuration global branches functions lines"
- **context7 library ID**: `/jestjs/jest`
- **Key insight**: `coverageThreshold.global` in `jest.config.js` causes `jest --coverage`
  to exit with a non-zero code if any metric falls below the threshold, making it suitable
  for a CI/push gate. Applies to all files listed in `collectCoverageFrom`.
- **Applied**: `jest.config.js` includes `coverageThreshold: { global: { lines: 80, functions: 80, branches: 80 } }`.
  This means `npm test` fails automatically if coverage drops below 80%, which is the
  trigger condition for the Cursor hook in `.cursor/hooks.json`.

```javascript
// Applied in jest.config.js:
coverageThreshold: {
  global: { lines: 80, functions: 80, branches: 80 },
},
```
