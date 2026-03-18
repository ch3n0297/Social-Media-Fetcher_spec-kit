import test from "node:test";
import assert from "node:assert/strict";
import {
  createAccount,
  sendSignedJson,
  setupTestApp,
} from "../../test-support/support.js";

test("manual refresh rejects oversized request bodies with 413", async () => {
  const accounts = [createAccount({ platform: "instagram", accountId: "ig-large-1" })];
  const fixtures = {
    "instagram--ig-large-1.json": { items: [] },
  };
  const { cleanup, baseUrl } = await setupTestApp({
    accounts,
    fixtures,
    overrides: {
      maxRequestBodyBytes: 64,
    },
  });

  try {
    const { response, json } = await sendSignedJson({
      baseUrl,
      pathName: "/api/v1/refresh-jobs/manual",
      body: {
        platform: "instagram",
        account_id: "ig-large-1",
        refresh_days: 7,
        request_source: "apps-script",
        notes: "x".repeat(128),
      },
    });

    assert.equal(response.status, 413);
    assert.equal(json.error, "PAYLOAD_TOO_LARGE");
  } finally {
    await cleanup();
  }
});

test("request handler converts unexpected dispatch errors into 500 responses", async () => {
  const accounts = [createAccount({ platform: "instagram", accountId: "ig-health-1" })];
  const fixtures = {
    "instagram--ig-health-1.json": { items: [] },
  };
  const { app, cleanup, baseUrl } = await setupTestApp({ accounts, fixtures });

  app.services.schedulerService.snapshot = () => {
    throw new Error("boom");
  };

  try {
    const response = await fetch(`${baseUrl}/health`);
    const json = await response.json();

    assert.equal(response.status, 500);
    assert.equal(json.error, "INTERNAL_ERROR");
  } finally {
    await cleanup();
  }
});
