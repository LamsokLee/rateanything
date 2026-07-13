# Test Harness — RateAnything

## Setup
```bash
npm run test:setup-db   # (Re)create rateanything_test DB (run after schema changes)
npm test                # Run all tests
npm run test:coverage   # Run with coverage report
```

## Writing Tests
```typescript
import { describe, it, expect, beforeEach } from "vitest";
import { resetDb, createTestCaller, TEST_USERS } from "@/test/helpers";

beforeEach(resetDb); // truncates all tables, seeds categories + test users

describe("my feature", () => {
  it("authed user", async () => {
    const caller = await createTestCaller(TEST_USERS.regular.clerkId);
    // caller.topics.create(...), caller.ratings.submit(...), etc.
  });
  it("admin", async () => {
    const caller = await createTestCaller(TEST_USERS.admin.clerkId);
  });
  it("guest", async () => {
    const caller = await createTestCaller(null);
  });
});
```

## Seeded Data (after `resetDb()`)
- **9 categories**: Sports(id=1), Movies & TV, Technology, Music, Gaming, Politics & News, Food & Drink, Culture, Other
- **TEST_USERS.regular**: `{ clerkId: "user_test_regular", username: "reguser", isAdmin: false }`
- **TEST_USERS.admin**: `{ clerkId: "user_test_admin", username: "adminuser", isAdmin: true }`

## Notes
- Tests auto-connect to `rateanything_test` (env set in `vitest.config.ts`). No `.env` changes needed.
- Redis unavailable in tests — rate limiting fails open.
- Files run serially (`fileParallelism: false`) since all tests share one DB.
