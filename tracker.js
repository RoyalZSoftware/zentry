const oc = console;
export function fetchAdapter(url) {
  return async (traceId, payload) => {
  try {
    const response = await fetch("/api/logs", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Trace-Id": traceId,
      },
      body: JSON.stringify(payload),
    });
    if (!response.ok) {
      console.warn("ErrorTracker: Log sending failed with status", {
        status: response.status,
      });
    }
  } catch (err) {
    console.warn("ErrorTracker: Network error sending logs:", { err });
  }
}
}

export async function test(traceId, payload) {
  oc.debug(JSON.stringify({traceId, payload}));
}

export async function webTraceIdFunction() {
  const traceId = sessionStorage.getItem("X-Trace-Id");
  if (!!traceId) return traceId;

  const createdTraceId = window.crypto.randomUUID();

  sessionStorage.setItem("X-Trace-Id", createdTraceId);
  return createdTraceId;
}

export class ErrorTracker {
  constructor({ maxLogs = 25, sendFunction, traceIdFunction }) {
    this.maxLogs = maxLogs;
    this.sendFunction = sendFunction; // Funktion, die Logs + Error später sendet
    this.traceIdFunction = traceIdFunction;
    this.logs = [];
    this.originalConsole = {};
    this.init();
  }

  init() {
    this.patchConsole();

    window.addEventListener("error", (event) => {
      this.handleError({
        message: event.message,
        source: event.filename,
        lineno: event.lineno,
        colno: event.colno,
        stack: event.error?.stack,
        type: "js-error",
      });
    });

    window.addEventListener("unhandledrejection", (event) => {
      this.handleError({
        message: event.reason?.message || "Unhandled promise rejection",
        stack: event.reason?.stack,
        type: "promise-rejection",
      });
    });
  }

  patchConsole() {
    ["log", "info", "warn", "error", "debug"].forEach((level) => {
      this.originalConsole[level] = console[level];

      console[level] = (...args) => {
        // Originales Verhalten beibehalten
        this.originalConsole[level](...args);

        const message = args[0];
        const data = args[1];

        // Log in Puffer speichern
        this.addLog({
          level,
          data: data,
          message: message,
          timestamp: new Date().toISOString(),
        });
      };
    })
    const originalTime = console.time;
    const originalTimeEnd = console.timeEnd;;
    const timers = new Map();

    console.time = function(label = 'default') {
      timers.set(label, Date.now());
      originalTime.call(console, label);
    };
  
    console.timeEnd = function(label = 'default') {
      const start = timers.get(label);
      if (!start) {
        originalTimeEnd.call(console, label);
        return;
      }
      const duration = Date.now() - start;
      timers.delete(label);

      console.info("[TIMING] " + label + " finished within " + duration + "ms", {duration: duration});
      
      originalTimeEnd.call(console, label);
    };
  }

  addLog(logEntry) {
    this.logs.push(logEntry);
    if (this.logs.length > this.maxLogs) {
      this.logs.shift(); // Ältesten Log entfernen, damit maxLogs eingehalten wird
    }
  }

  async handleError(errorInfo) {
    // Logs und ErrorInfo zusammen senden
    try {
      await this.sendFunction(await this.traceIdFunction(), {
        error: errorInfo,
        recentLogs: this.logs.slice(undefined, this.logs.length),
        timestamp: new Date().toISOString(),
      });
      this.logs = []; // Logs nach dem Senden leeren
    } catch (e) {
      this.originalConsole.warn("ErrorTracker: Sending logs failed", e);
    }
  }
}

export const WebTracker = (apiUrl, maxLogs = 25) =>
  new ErrorTracker({
    sendFunction: fetchAdapter(apiUrl),
    traceIdFunction: webTraceIdFunction,
  });