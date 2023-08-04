import { mapValues, orderBy } from "lodash";
import fs from "fs-extra";

const SECRETS_PATH = "/run/secrets/";

// Check each env var and see if it has a value in the secrets. In that case, use the
// secret value. Otherwise use the env var. Using sync fs methods for the sake of
// simplicity, since this will only run once when staring the app, sync is OK.
const secrets = (fs.existsSync(SECRETS_PATH) && fs.readdirSync(SECRETS_PATH)) || [];

const secretsEnv = mapValues(process.env, (value, key) => {
  const matchingSecrets = secrets.filter((secretFile) => secretFile.startsWith(key));

  const currentSecret =
    orderBy(
      matchingSecrets,
      (secret) => {
        const secretVersion = parseInt(secret[secret.length - 1], 10);
        return isNaN(secretVersion) ? 0 : secretVersion;
      },
      "desc",
    )[0] || null;

  const filepath = SECRETS_PATH + currentSecret;

  if (fs.existsSync(filepath)) {
    return (fs.readFileSync(filepath, { encoding: "utf8" }) || "").trim();
  }

  return value;
});

export const PG_CONNECTION_STRING = secretsEnv.PG_CONNECTION_STRING || "";
export const FTP_USERNAME = secretsEnv.FTP_USERNAME || "";
export const FTP_PASSWORD = secretsEnv.FTP_PASSWORD || "";
export const FTP_HOST = secretsEnv.FTP_HOST || "";
export const FTP_PORT = secretsEnv.FTP_PORT || 21;
export const FTP_PATH = secretsEnv.FTP_PATH || "/";
export const DEFAULT_EXPORT_SOURCE = secretsEnv.DEFAULT_EXPORT_SOURCE || "daily";
export const DAILY_TASK_SCHEDULE = secretsEnv.DAILY_TASK_SCHEDULE || "0 30 0 * * *";
export const DEBUG = secretsEnv.DEBUG || "false";
export const SERVER_PORT = secretsEnv.SERVER_PORT || 3000;
export const ADMIN_PASSWORD = secretsEnv.ADMIN_PASSWORD || "password";
export const PATH_PREFIX = secretsEnv.PATH_PREFIX || "/";
export const SCHEMA = "jore";
export const INTERMEDIATE_SCHEMA = "jore_new";
export const AZURE_UPLOAD_CONTAINER = secretsEnv.AZURE_UPLOAD_CONTAINER || "joredumps";
export const AZURE_STORAGE_ACCOUNT = secretsEnv.AZURE_STORAGE_ACCOUNT || "";
export const AZURE_STORAGE_KEY = secretsEnv.AZURE_STORAGE_KEY || "";
export const SLACK_WEBHOOK_URL = secretsEnv.SLACK_WEBHOOK_URL || "";
export const ENVIRONMENT = secretsEnv.ENVIRONMENT || "unknown";
export const SLACK_MONITOR_MENTION = secretsEnv.SLACK_MONITOR_MENTION || "";
export const MAP_MATCHER_URL = secretsEnv.MAP_MATCHER_URL || "http://localhost:3000/";
