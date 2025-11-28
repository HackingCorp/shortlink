// Déclaration de type pour le module node-cron
declare module 'node-cron' {
  export interface ScheduledTask {
    start(): void;
    stop(): void;
    destroy(): void;
  }

  export interface ScheduleOptions {
    scheduled?: boolean;
    timezone?: string;
    recoverMissedExecutions?: boolean;
    name?: string;
  }

  export function schedule(
    cronExpression: string | Date | (() => void),
    func: () => void,
    options?: ScheduleOptions
  ): ScheduledTask;

  export function validate(cronExpression: string): boolean;
  
  export const scheduledJobs: { [key: string]: ScheduledTask };
  
  export default {
    schedule,
    validate,
    scheduledJobs
  };
}
