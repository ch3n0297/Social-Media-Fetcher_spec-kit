export class SchedulerService {
  constructor({ scheduledSyncService, intervalMs, logger }) {
    this.scheduledSyncService = scheduledSyncService;
    this.intervalMs = intervalMs;
    this.logger = logger;
    this.timer = null;
    this.started = false;
    this.tickInProgress = false;
  }

  start() {
    if (this.started || this.intervalMs <= 0) {
      return;
    }

    this.started = true;
    this.#scheduleNextTick();
  }

  async #runTick() {
    if (!this.started || this.tickInProgress) {
      return;
    }

    this.tickInProgress = true;

    try {
      await this.scheduledSyncService.enqueueAllActiveAccounts({
        requestedBy: "scheduler",
      });
    } catch (error) {
      this.logger.error("Scheduled sync tick failed", { error });
    } finally {
      this.tickInProgress = false;
      this.#scheduleNextTick();
    }
  }

  #scheduleNextTick() {
    if (!this.started) {
      return;
    }

    this.timer = setTimeout(() => {
      this.timer = null;
      void this.#runTick();
    }, this.intervalMs);

    this.timer.unref?.();
  }

  stop() {
    this.started = false;

    if (!this.timer) {
      return;
    }

    clearTimeout(this.timer);
    this.timer = null;
  }

  snapshot() {
    return {
      running: this.started,
      intervalMs: this.intervalMs,
      tickInProgress: this.tickInProgress,
    };
  }
}
