const PREFIX = "[scw]";

function noop(..._args: unknown[]): void {}

const _log = __DEV__ ? (...args: unknown[]) => console.log(PREFIX, ...args) : noop;
const _warn = (...args: unknown[]) => console.warn(PREFIX, ...args);
const _error = (...args: unknown[]) => console.error(PREFIX, ...args);

export { _log as log, _warn as warn, _error as error };
