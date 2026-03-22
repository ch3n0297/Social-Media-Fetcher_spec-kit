export class HttpError extends Error {
  constructor(statusCode, code, message, details = undefined) {
    super(message);
    this.name = "HttpError";
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
}

export function toErrorResponse(error) {
  if (error instanceof HttpError) {
    return {
      statusCode: error.statusCode,
      body: {
        error: error.code,
        system_message: error.message,
        details: error.details,
      },
    };
  }

  if (error?.statusCode === 413 || error?.code === "FST_ERR_CTP_BODY_TOO_LARGE") {
    return {
      statusCode: 413,
      body: {
        error: "PAYLOAD_TOO_LARGE",
        system_message: "請求內容不得超過允許的大小。",
      },
    };
  }

  return {
    statusCode: 500,
    body: {
      error: "INTERNAL_ERROR",
      system_message: "伺服器發生內部錯誤。",
    },
  };
}
