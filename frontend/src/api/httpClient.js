export class HttpRequestError extends Error {
  constructor(message, { payload, status }) {
    super(message);
    this.name = "HttpRequestError";
    this.payload = payload;
    this.status = status;
  }
}

function resolveApiUrl(pathname) {
  const configuredBaseUrl = import.meta.env.VITE_API_BASE_URL?.trim();

  if (!configuredBaseUrl) {
    return pathname;
  }

  const normalizedBaseUrl = configuredBaseUrl.endsWith("/")
    ? configuredBaseUrl.slice(0, -1)
    : configuredBaseUrl;

  return `${normalizedBaseUrl}${pathname}`;
}

export async function requestJson(url, { body, headers, method = "GET", signal } = {}) {
  const response = await fetch(resolveApiUrl(url), {
    body: body === undefined ? undefined : JSON.stringify(body),
    credentials: "include",
    headers: {
      accept: "application/json",
      ...(body === undefined ? {} : { "content-type": "application/json" }),
      ...headers,
    },
    method,
    signal,
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new HttpRequestError(payload.system_message ?? `請求失敗，狀態碼 ${response.status}。`, {
      payload,
      status: response.status,
    });
  }

  return payload;
}
