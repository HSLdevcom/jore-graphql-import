import { CronJob } from "cron";
import { invoke } from "lodash";

export const MIDNIGHT = "0 0 0 * * *";
export const EARLY_MORNING = "0 0 3 * * *";

const scheduledImports = {};
const runningTasks = [];

function onTaskCompleted(name) {
  console.log(`Task ${name} completed.`);
  const nameIndex = runningTasks.indexOf(name);

  if (nameIndex !== -1) {
    runningTasks.splice(nameIndex, 1);
  }
}

function onTaskStart(name) {
  if (runningTasks.includes(name)) {
    console.log(`Task ${name} is already running.`);
    return false;
  }

  runningTasks.push(name);
  return true;
}

function runTask(name, task) {
  return (onComplete) => {
    if (onTaskStart(name)) {
      console.log(`Running task ${name}.`);
      task(onComplete);
    }
  };
}

export function createScheduledImport(name, cron, task) {
  scheduledImports[name] = new CronJob(
    cron, // The cron config
    runTask(name, task), // The task to execute
    () => onTaskCompleted(name), // The callback passed to the task
    false, // Start right now (we want to wait until start() is called)
    null, // time zone
    null, // Context
    false, // Run on init
    3, // UTC offset, safer than requiring knowledge about timezones
  );
}

// Start the clock for the task. If "run on init" for the task is true, the task
// will run, otherwise only the clock is started.
export function startScheduledImport(name) {
  invoke(scheduledImports, `${name}.start`);
}

// Trigger a scheduled task. This is exactly the same as the task being triggered by the schedule.
export function runScheduledImportNow(name) {
  invoke(scheduledImports, `${name}.fireOnTick`);
}
