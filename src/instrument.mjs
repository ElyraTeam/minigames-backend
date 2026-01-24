import * as Sentry from "@sentry/node";
import { nodeProfilingIntegration } from "@sentry/profiling-node";

console.log("Sentry initialized");

Sentry.init({
  dsn: "https://9bdafc7f662f41f5bc0c846024ec92f4@o260487.ingest.sentry.io/6179839",
  integrations: [nodeProfilingIntegration(), Sentry.zodErrorsIntegration()],

  // Send structured logs to Sentry
  enableLogs: true,
  // Tracing
  tracesSampleRate: 1.0, //  Capture 100% of the transactions
  // Set sampling rate for profiling - this is evaluated only once per SDK.init call
  profileSessionSampleRate: 0.3,
  // Trace lifecycle automatically enables profiling during active traces
  profileLifecycle: "trace",
  // Setting this option to true will send default PII data to Sentry.
  // For example, automatic IP address collection on events
  sendDefaultPii: true,
});

// Profiling happens automatically after setting it up with `Sentry.init()`.
// All spans (unless those discarded by sampling) will have profiling data attached to them.
Sentry.startSpan(
  {
    name: "Elyra Games Span",
  },
  () => {
    // The code executed here will be profiled
  },
);
