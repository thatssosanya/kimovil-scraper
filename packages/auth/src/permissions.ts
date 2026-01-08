import { createAccessControl } from "better-auth/plugins/access";

export const statement = {
  posts: ["create", "read", "update", "delete", "publish"],
  users: ["read", "create", "update", "delete", "ban"],
  settings: ["read", "update"],
  scraper: ["run", "view", "admin"],
  prices: ["read", "update"],
  devices: ["read", "create", "update", "delete"],
} as const;

export const ac = createAccessControl(statement);

export const subscriber = ac.newRole({
  posts: ["read"],
  devices: ["read"],
  prices: ["read"],
});

export const author = ac.newRole({
  posts: ["create", "read", "update"],
  devices: ["read"],
  prices: ["read"],
});

export const editor = ac.newRole({
  posts: ["create", "read", "update", "delete", "publish"],
  devices: ["read", "create", "update"],
  prices: ["read"],
  scraper: ["view"],
});

export const admin = ac.newRole({
  posts: ["create", "read", "update", "delete", "publish"],
  users: ["read", "create", "update", "delete", "ban"],
  settings: ["read", "update"],
  scraper: ["run", "view", "admin"],
  prices: ["read", "update"],
  devices: ["read", "create", "update", "delete"],
});

export const roles = {
  subscriber,
  author,
  editor,
  admin,
};

export type Role = keyof typeof roles;
export type Permission = keyof typeof statement;
