import { SLACK_WEBHOOK_URL, ENVIRONMENT } from "./constants";
import fetch from "node-fetch";
import _ from "lodash";
export const messageTypes = {
  ERROR: "error",
  INFO: "info",
};

export async function reportError(err = null) {
  const message =
    typeof err === "string" ? err : typeof err.message === "string" ? err.message : "";

  return onMonitorEvent(message, messageTypes.ERROR);
}

export async function reportInfo(message = "") {
  return onMonitorEvent(message, messageTypes.INFO);
}

export async function onMonitorEvent(
  message = "Something happened.",
  type = messageTypes.ERROR,
) {
  if (!message) {
    return false;
  }

  const fullMessage = `${type} message from hsl-jore-import [${ENVIRONMENT.toUpperCase()}]:\n
  \`\`\`${message}\`\`\``;

  const body = {
    type: "mrkdwn",
    text: fullMessage,
  };

  return fetch(SLACK_WEBHOOK_URL, { method: "POST", body: JSON.stringify(body) });
}
