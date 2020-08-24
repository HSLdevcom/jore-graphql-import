import { SLACK_WEBHOOK_URL, ENVIRONMENT, SLACK_MONITOR_MENTION } from "./constants";
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

  const userIds = SLACK_MONITOR_MENTION.split(",");

  const mentionUsers =
    type === messageTypes.ERROR ? userIds.map((id) => `<@${id}> `) : "";

  const fullMessage = `${
    mentionUsers ? `${mentionUsers} ` : ""
  }${type} message from JORE importer [${ENVIRONMENT.toUpperCase()}]:\n
\`\`\`${message}\`\`\``;

  const body = {
    type: "mrkdwn",
    text: fullMessage,
  };
  return fetch(SLACK_WEBHOOK_URL, { method: "POST", body: JSON.stringify(body) });
}
