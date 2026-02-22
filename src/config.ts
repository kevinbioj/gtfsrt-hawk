import { Temporal } from "temporal-polyfill";

export const PORT = +(process.env.PORT ?? 3000);
export const SWEEP_THRESHOLD = Temporal.Duration.from({ minutes: 10 }).total("milliseconds");
