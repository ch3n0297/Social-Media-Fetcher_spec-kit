import crypto from "node:crypto";
import { HttpError } from "../lib/errors.js";
import { sanitizeUser } from "./user-auth-service.js";

function buildOutboxMessage({ clock, to, type, subject, body }) {
  return {
    id: crypto.randomUUID(),
    type,
    to,
    subject,
    body,
    createdAt: clock().toISOString(),
  };
}

export class UserApprovalService {
  constructor({
    store,
    userRepository,
    clock,
  }) {
    this.store = store;
    this.userRepository = userRepository;
    this.clock = clock;
  }

  async listPendingUsers() {
    const users = await this.userRepository.listByStatus("pending");
    return users.map((user) => sanitizeUser(user));
  }

  async approveUser({ targetUserId, adminUser }) {
    const updatedUser = await this.#decideUser({
      targetUserId,
      adminUser,
      nextStatus: "active",
      buildNextFields: (now) => ({
        approvedAt: now,
        approvedBy: adminUser.id,
        rejectedAt: null,
        rejectedBy: null,
      }),
      invalidStatusMessage: "只有待審核帳號可以被核准。",
      outboxMessage: {
        type: "user-approved",
        subject: "社群資料中台帳號已核准",
        body: "你的帳號已由管理員核准，現在可以登入社群資料中台。",
      },
    });
    return sanitizeUser(updatedUser);
  }

  async rejectUser({ targetUserId, adminUser }) {
    const updatedUser = await this.#decideUser({
      targetUserId,
      adminUser,
      nextStatus: "rejected",
      buildNextFields: (now) => ({
        rejectedAt: now,
        rejectedBy: adminUser.id,
      }),
      invalidStatusMessage: "只有待審核帳號可以被拒絕。",
      outboxMessage: {
        type: "user-rejected",
        subject: "社群資料中台註冊申請未通過",
        body: "你的註冊申請目前未通過，若需要存取權限請聯絡管理員。",
      },
    });
    return sanitizeUser(updatedUser);
  }

  async #decideUser({
    targetUserId,
    adminUser,
    nextStatus,
    buildNextFields,
    invalidStatusMessage,
    outboxMessage,
  }) {
    let updatedUser = null;

    await this.store.updateCollections(["users", "outbox-messages"], (collections) => {
      const users = Array.isArray(collections.users) ? collections.users : [];
      const outboxMessages = Array.isArray(collections["outbox-messages"])
        ? collections["outbox-messages"]
        : [];
      const index = users.findIndex((user) => user.id === targetUserId);

      if (index === -1) {
        throw new HttpError(404, "USER_NOT_FOUND", "找不到指定的使用者。");
      }

      const user = users[index];

      if (user.status !== "pending") {
        throw new HttpError(409, "USER_STATUS_INVALID", invalidStatusMessage);
      }

      const now = this.clock().toISOString();
      updatedUser = {
        ...user,
        status: nextStatus,
        ...buildNextFields(now),
        updatedAt: now,
      };
      users[index] = updatedUser;
      outboxMessages.push(
        buildOutboxMessage({
          clock: this.clock,
          to: user.email,
          ...outboxMessage,
        }),
      );

      return {
        users,
        "outbox-messages": outboxMessages,
      };
    });

    return updatedUser;
  }
}
