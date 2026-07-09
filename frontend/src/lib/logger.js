const isDev = import.meta.env.DEV;

const logger = {
  debug: (...args) => isDev && console.debug(...args),
  info: (...args) => isDev && console.info(...args),
  warn: (...args) => console.warn(...args),
  error: (...args) => console.error(...args),
};

export default logger;
