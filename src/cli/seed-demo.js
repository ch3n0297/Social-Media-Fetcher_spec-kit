import crypto from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadConfig } from "../config.js";
import { FileStore } from "../lib/fs-store.js";
import { AccountConfigRepository } from "../repositories/account-config-repository.js";

export function createDemoAccounts(clock) {
  const now = clock().toISOString();

  return [
    {
      id: crypto.randomUUID(),
      clientName: "示範客戶",
      platform: "instagram",
      accountId: "acct-instagram-demo",
      refreshDays: 7,
      sheetId: "marketing-sheet",
      sheetRowKey: "row-instagram",
      isActive: true,
      lastRequestTime: null,
      lastSuccessTime: null,
      currentJobId: null,
      refreshStatus: "idle",
      systemMessage: "帳號已就緒，可進行資料更新。",
      updatedAt: now,
    },
    {
      id: crypto.randomUUID(),
      clientName: "示範客戶",
      platform: "facebook",
      accountId: "acct-facebook-demo",
      refreshDays: 7,
      sheetId: "marketing-sheet",
      sheetRowKey: "row-facebook",
      isActive: true,
      lastRequestTime: null,
      lastSuccessTime: null,
      currentJobId: null,
      refreshStatus: "idle",
      systemMessage: "帳號已就緒，可進行資料更新。",
      updatedAt: now,
    },
    {
      id: crypto.randomUUID(),
      clientName: "示範客戶",
      platform: "tiktok",
      accountId: "acct-tiktok-demo",
      refreshDays: 7,
      sheetId: "marketing-sheet",
      sheetRowKey: "row-tiktok",
      isActive: true,
      lastRequestTime: null,
      lastSuccessTime: null,
      currentJobId: null,
      refreshStatus: "idle",
      systemMessage: "帳號已就緒，可進行資料更新。",
      updatedAt: now,
    },
  ];
}

export async function seedDemoData({ accountRepository, clock, overwrite = false }) {
  const existing = await accountRepository.listAll();
  if (existing.length > 0 && !overwrite) {
    return existing;
  }

  const demoAccounts = createDemoAccounts(clock);
  await accountRepository.replaceAll(demoAccounts);
  return demoAccounts;
}

async function main() {
  const config = loadConfig();
  const store = new FileStore(config.dataDir);
  await store.init(["account-configs"]);
  const accountRepository = new AccountConfigRepository(store);
  const accounts = await seedDemoData({
    accountRepository,
    clock: config.clock,
    overwrite: true,
  });

  config.logger.info("Seeded demo accounts", { count: accounts.length });
}

function isDirectExecution() {
  if (!process.argv[1]) {
    return false;
  }

  return fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);
}

if (isDirectExecution()) {
  await main();
}
