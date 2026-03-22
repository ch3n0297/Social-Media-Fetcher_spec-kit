import { HttpError } from "../lib/errors.js";

const SUPPORTED_PLATFORMS = new Set(["instagram", "facebook", "tiktok"]);

function assertNonEmptyString(value, fieldName) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new HttpError(400, "VALIDATION_ERROR", `欄位 ${fieldName} 為必填。`);
  }
}

export function validateManualRefreshPayload(payload) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new HttpError(400, "VALIDATION_ERROR", "請求內容必須是 JSON 物件。");
  }

  assertNonEmptyString(payload.platform, "platform");
  assertNonEmptyString(payload.account_id, "account_id");
  assertNonEmptyString(payload.request_source, "request_source");

  if (!SUPPORTED_PLATFORMS.has(payload.platform)) {
    throw new HttpError(
      400,
      "VALIDATION_ERROR",
      "platform 必須是 instagram、facebook 或 tiktok 其中之一。",
    );
  }

  if (!Number.isInteger(payload.refresh_days)) {
    throw new HttpError(400, "VALIDATION_ERROR", "refresh_days 必須是整數。");
  }

  if (payload.refresh_days < 1 || payload.refresh_days > 365) {
    throw new HttpError(
      400,
      "VALIDATION_ERROR",
      "refresh_days 必須是 1 到 365 之間的整數。",
    );
  }

  return {
    platform: payload.platform,
    accountId: payload.account_id,
    refreshDays: payload.refresh_days,
    requestSource: payload.request_source,
  };
}

export function validateScheduledSyncPayload(payload) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new HttpError(400, "VALIDATION_ERROR", "請求內容必須是 JSON 物件。");
  }

  assertNonEmptyString(payload.requested_by, "requested_by");

  return {
    requestedBy: payload.requested_by,
  };
}
