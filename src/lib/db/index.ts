// Samlet indgang til datalaget. Skærme importerer herfra — aldrig rå SQL.
export { getDb, initDb, newId } from './client';
export * as subjects from './subjects';
export * as deadlines from './deadlines';
export * as sessions from './sessions';
export * as goals from './goals';
export * as settings from './settings';
export * as notificationSchedules from './notificationSchedules';
