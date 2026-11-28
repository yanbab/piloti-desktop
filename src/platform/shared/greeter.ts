/** The login screen's side of greetd (`engine-native/greeter.ts`). */
export {
  authenticateAndStartGreetdSession,
  computeUserInitials,
  detectGreeterRuntime,
  discoverGreeterSessions,
  discoverGreeterUsers,
  finishGreetdGreeter,
  runGreeterPowerAction,
} from "@/platform/native/greeter";
export type {
  GreeterSessionOption,
  GreeterUserAccount,
} from "@/platform/native/greeter";
