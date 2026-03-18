import crypto from "node:crypto";

function buildRawRecords(job, rawItems, fetchedAt) {
  return rawItems.map((item) => ({
    id: crypto.randomUUID(),
    jobId: job.id,
    accountKey: job.accountKey,
    platform: job.platform,
    accountId: job.accountId,
    fetchedAt,
    payload: item,
  }));
}

function toSystemMessage(error) {
  if (error.code === "TOKEN_EXPIRED") {
    return "更新失敗：平台授權已過期。";
  }

  if (error.code === "RATE_LIMITED") {
    return "更新失敗：平台 API 目前觸發頻率限制。";
  }

  if (error.code === "ENOENT") {
    return "更新失敗：找不到對應的平台測試資料。";
  }

  return `更新失敗：${error.message}`;
}

export class RefreshOrchestrator {
  constructor({
    accountRepository,
    jobRepository,
    rawRecordRepository,
    normalizedRecordRepository,
    platformRegistry,
    normalizationService,
    statusService,
    logger,
    clock,
  }) {
    this.accountRepository = accountRepository;
    this.jobRepository = jobRepository;
    this.rawRecordRepository = rawRecordRepository;
    this.normalizedRecordRepository = normalizedRecordRepository;
    this.platformRegistry = platformRegistry;
    this.normalizationService = normalizationService;
    this.statusService = statusService;
    this.logger = logger;
    this.clock = clock;
  }

  async processJob(job) {
    const accountConfig = await this.accountRepository.findByPlatformAndAccountId(
      job.platform,
      job.accountId,
    );

    if (!accountConfig) {
      await this.jobRepository.updateById(job.id, {
        status: "error",
        finishedAt: this.clock().toISOString(),
        systemMessage: "帳號設定已不存在。",
        errorCode: "ACCOUNT_NOT_FOUND",
      });
      return;
    }

    const startedAt = this.clock().toISOString();
    const runningJob = {
      ...job,
      status: "running",
      startedAt,
      systemMessage: "正在抓取平台資料。",
    };

    await this.jobRepository.updateById(job.id, {
      status: runningJob.status,
      startedAt: runningJob.startedAt,
      systemMessage: runningJob.systemMessage,
    });
    await this.statusService.markRunning(accountConfig, runningJob);

    try {
      const adapter = this.platformRegistry.get(job.platform);
      const rawItems = await adapter.fetchAccountContent({
        accountConfig,
        refreshDays: job.refreshDays,
        now: this.clock(),
      });
      const fetchedAt = this.clock().toISOString();
      const rawRecords = buildRawRecords(job, rawItems, fetchedAt);
      const normalizedRecords = this.normalizationService.normalizeBatch({
        platform: job.platform,
        accountId: job.accountId,
        accountKey: job.accountKey,
        jobId: job.id,
        rawItems,
      });

      await this.#persistFetchedRecords(job.accountKey, rawRecords, normalizedRecords);

      const finishedAt = this.clock().toISOString();
      const successfulJob = {
        ...runningJob,
        status: "success",
        finishedAt,
        systemMessage: `更新完成，共整理 ${normalizedRecords.length} 筆內容資料。`,
        resultSummary: {
          rawRecordCount: rawRecords.length,
          normalizedRecordCount: normalizedRecords.length,
          sheetSync: "success",
        },
      };

      await this.jobRepository.updateById(job.id, {
        status: successfulJob.status,
        finishedAt: successfulJob.finishedAt,
        systemMessage: successfulJob.systemMessage,
        resultSummary: successfulJob.resultSummary,
      });
      await this.statusService.markSuccess(
        accountConfig,
        successfulJob,
        normalizedRecords,
        successfulJob.systemMessage,
      );
      this.logger.info("Job completed", {
        jobId: job.id,
        platform: job.platform,
        accountId: job.accountId,
      });
    } catch (error) {
      const finishedAt = this.clock().toISOString();
      const systemMessage = toSystemMessage(error);
      const failedJob = {
        ...runningJob,
        status: "error",
        finishedAt,
        systemMessage,
        errorCode: error.code ?? "UNKNOWN",
      };

      await this.jobRepository.updateById(job.id, {
        status: failedJob.status,
        finishedAt: failedJob.finishedAt,
        systemMessage: failedJob.systemMessage,
        errorCode: failedJob.errorCode,
      });
      await this.statusService.markError(accountConfig, failedJob, failedJob.systemMessage);
      this.logger.error("Job failed", {
        jobId: job.id,
        platform: job.platform,
        accountId: job.accountId,
        error,
      });
    }
  }

  async #persistFetchedRecords(accountKey, rawRecords, normalizedRecords) {
    const store = this.rawRecordRepository.store;

    if (
      store !== this.normalizedRecordRepository.store ||
      typeof store.updateCollections !== "function"
    ) {
      await this.rawRecordRepository.appendMany(rawRecords);
      await this.normalizedRecordRepository.replaceForAccount(accountKey, normalizedRecords);
      return;
    }

    await store.updateCollections(
      [this.rawRecordRepository.collection, this.normalizedRecordRepository.collection],
      (collections) => {
        const nextRawRecords = collections[this.rawRecordRepository.collection];
        const nextNormalizedRecords = collections[this.normalizedRecordRepository.collection]
          .filter((record) => record.accountKey !== accountKey);

        nextRawRecords.push(...rawRecords);
        nextNormalizedRecords.push(...normalizedRecords);

        return {
          [this.rawRecordRepository.collection]: nextRawRecords,
          [this.normalizedRecordRepository.collection]: nextNormalizedRecords,
        };
      },
    );
  }
}
