import { mkdir, readFile, rename, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

const COLLECTION_NAME_PATTERN = /^[a-z0-9-]+$/;

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

export class FileStore {
  #baseDir;
  #lock;

  constructor(baseDir) {
    this.#baseDir = path.resolve(baseDir);
    this.#lock = Promise.resolve();
  }

  async init(collections) {
    await mkdir(this.#baseDir, { recursive: true });
    await Promise.all(collections.map((collection) => this.#ensureFile(collection)));
  }

  async readCollection(collection) {
    return this.#withLock(async () => clone(await this.#readRawCollection(collection)));
  }

  async writeCollection(collection, records) {
    return this.#withLock(async () => {
      await this.#writeRawCollection(collection, records);
      return clone(records);
    });
  }

  async updateCollection(collection, updater) {
    return this.#withLock(async () => {
      const current = await this.#readRawCollection(collection);
      const next = await updater(clone(current));
      await this.#writeRawCollection(collection, next);
      return clone(next);
    });
  }

  async updateCollections(collections, updater) {
    return this.#withLock(async () => {
      const uniqueCollections = [...new Set(collections.map((collection) => this.#normalizeCollection(collection)))];
      const current = {};

      for (const collection of uniqueCollections) {
        current[collection] = await this.#readRawCollection(collection);
      }

      const next = await updater(clone(current));
      const entries = uniqueCollections.map((collection) => ({
        collection,
        records: next?.[collection],
      }));

      for (const entry of entries) {
        if (!Array.isArray(entry.records)) {
          throw new TypeError(
            `Collection updater must return an array for "${entry.collection}".`,
          );
        }
      }

      await this.#writeRawCollections(entries);
      return clone(next);
    });
  }

  async #withLock(task) {
    const result = this.#lock.then(task, task);
    this.#lock = result.catch(() => undefined);
    return result;
  }

  async #ensureFile(collection) {
    const filename = this.#getFilename(collection);

    try {
      await readFile(filename, "utf8");
    } catch (error) {
      if (error?.code !== "ENOENT") {
        throw error;
      }

      await this.#writeRawCollection(collection, []);
    }
  }

  async #readRawCollection(collection) {
    const filename = this.#getFilename(collection);
    const content = await readFile(filename, "utf8");
    return JSON.parse(content || "[]");
  }

  async #writeRawCollection(collection, records) {
    await this.#writeRawCollections([{ collection, records }]);
  }

  #getFilename(collection) {
    const normalizedCollection = this.#normalizeCollection(collection);
    const filename = path.resolve(this.#baseDir, `${normalizedCollection}.json`);
    const relative = path.relative(this.#baseDir, filename);

    if (relative.startsWith("..") || path.isAbsolute(relative)) {
      throw new TypeError(`Collection "${normalizedCollection}" resolves outside the data directory.`);
    }

    return filename;
  }

  #normalizeCollection(collection) {
    if (typeof collection !== "string" || !COLLECTION_NAME_PATTERN.test(collection)) {
      throw new TypeError(
        'Collection names must match /^[a-z0-9-]+$/ and may not include path separators.',
      );
    }

    return collection;
  }

  async #writeRawCollections(entries) {
    const stagedFiles = [];

    try {
      for (const { collection, records } of entries) {
        if (!Array.isArray(records)) {
          throw new TypeError(`Collection "${collection}" must be written as an array.`);
        }

        const filename = this.#getFilename(collection);
        const tempFilename = path.join(
          path.dirname(filename),
          `.${path.basename(filename)}.${process.pid}.${Date.now()}.tmp`,
        );
        const body = JSON.stringify(records, null, 2);

        await writeFile(tempFilename, `${body}\n`, "utf8");
        stagedFiles.push({ filename, tempFilename });
      }

      for (const { filename, tempFilename } of stagedFiles) {
        await rename(tempFilename, filename);
      }
    } catch (error) {
      await Promise.all(
        stagedFiles.map(({ tempFilename }) => unlink(tempFilename).catch(() => undefined)),
      );
      throw error;
    }
  }
}
