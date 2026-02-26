// Do what you need to set up your test
console.log('setup test: vitest.setup.js');

// Mock chrome API
global.chrome = {
  storage: {
    local: {
      get: () => Promise.resolve({}),
      set: () => Promise.resolve(),
      remove: () => Promise.resolve(),
      clear: () => Promise.resolve(),
      onChanged: {
        addListener: () => {},
        removeListener: () => {},
      },
    },
    sync: {
      get: () => Promise.resolve({}),
      set: () => Promise.resolve(),
      remove: () => Promise.resolve(),
      clear: () => Promise.resolve(),
      onChanged: {
        addListener: () => {},
        removeListener: () => {},
      },
    },
    managed: {
      get: () => Promise.resolve({}),
      set: () => Promise.resolve(),
      remove: () => Promise.resolve(),
      clear: () => Promise.resolve(),
      onChanged: {
        addListener: () => {},
        removeListener: () => {},
      },
    },
    session: {
      get: () => Promise.resolve({}),
      set: () => Promise.resolve(),
      remove: () => Promise.resolve(),
      clear: () => Promise.resolve(),
      onChanged: {
        addListener: () => {},
        removeListener: () => {},
      },
    },
  },
  runtime: {
    lastError: null,
  },
};
