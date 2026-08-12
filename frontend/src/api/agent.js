import api from "./http";

export const sendAgentChat = (message, history) =>
  api.post("/api/agent/chat", { message, history }).then((r) => r.data);
