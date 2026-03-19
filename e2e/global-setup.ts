import { test } from './fixtures/auth.fixture';

export { test };
export { expect } from '@playwright/test';

// The auth fixture handles:
// 1. Navigate to login
// 2. Log in as admin
// 3. Save storageState to .auth/admin.json
