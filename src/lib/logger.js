function createReplacer() {
  const seen = new WeakSet();

  return (key, value) => {
    if (value instanceof Error) {
      return {
        name: value.name,
        message: value.message,
        stack: value.stack,
        code: value.code,
      };
    }

    if (typeof value === "bigint") {
      return value.toString();
    }

    if (value && typeof value === "object") {
      if (seen.has(value)) {
        return "[Circular]";
      }

      seen.add(value);
    }

    return value;
  };
}

function safeStringify(entry) {
  try {
    return JSON.stringify(entry, createReplacer());
  } catch (error) {
    return JSON.stringify({
      timestamp: entry.timestamp,
      level: "error",
      message: "Failed to serialize log entry.",
      context: {
        originalLevel: entry.level,
        originalMessage: entry.message,
        serializationError: error.message,
      },
    });
  }
}

function write(level, message, context = undefined) {
  const entry = {
    timestamp: new Date().toISOString(),
    level,
    message,
  };

  if (context !== undefined) {
    entry.context = context;
  }

  const line = safeStringify(entry);
  if (level === "error") {
    console.error(line);
    return;
  }

  console.log(line);
}

export function createLogger({ silent = false } = {}) {
  if (silent) {
    const noop = () => {};
    return {
      debug: noop,
      info: noop,
      warn: noop,
      error: noop,
    };
  }

  return {
    debug(message, context) {
      write("debug", message, context);
    },
    info(message, context) {
      write("info", message, context);
    },
    warn(message, context) {
      write("warn", message, context);
    },
    error(message, context) {
      write("error", message, context);
    },
  };
}
