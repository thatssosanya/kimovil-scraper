declare global {
  namespace NodeJS {
    interface ProcessEnv {
      __DEV__: string;
      __FIREFOX__: string;
      EXTENSION_SECRET?: string;
    }
  }
}

export {};
