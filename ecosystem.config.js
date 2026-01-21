module.exports = {
  apps: [
    {
      name: "scraper",
      cwd: "./apps/scraper",
      script: "npx",
      args: "tsx src/index.ts",
      env: {
        NODE_ENV: "production",
      },
      // Restart if memory exceeds 1GB
      max_memory_restart: "1G",
      // Exponential backoff restart delay
      exp_backoff_restart_delay: 100,
      // Merge logs into single file per app
      merge_logs: true,
      // Log dates
      time: true,
    },
    {
      name: "analytics",
      cwd: "./apps/analytics",
      script: "npx",
      args: "tsx src/index.ts",
      env: {
        NODE_ENV: "production",
      },
      max_memory_restart: "512M",
      exp_backoff_restart_delay: 100,
      merge_logs: true,
      time: true,
    },
    {
      name: "web",
      cwd: "./apps/ws-web",
      script: "npx",
      args: "vite preview --host 127.0.0.1 --port 5173",
      env: {
        NODE_ENV: "production",
      },
      // Depends on scraper being up (informational, pm2 doesn't enforce order)
      wait_ready: true,
      max_memory_restart: "512M",
      exp_backoff_restart_delay: 100,
      merge_logs: true,
      time: true,
    },
    {
      name: "catalogue",
      cwd: "./apps/catalogue",
      script: "npm",
      args: "start",
      env: {
        NODE_ENV: "production",
      },
      max_memory_restart: "1G",
      exp_backoff_restart_delay: 100,
      merge_logs: true,
      time: true,
    },
  ],
};
