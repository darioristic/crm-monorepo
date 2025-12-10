export const logger = {
  info: (..._args: unknown[]) => {
    if (process.env.NODE_ENV !== "test") {
    }
  },
  error: (...args: unknown[]) => {
    // eslint-disable-next-line no-console
    console.error(...args);
  },
};
