/**
 * PM2 process config for the LIV8 Command Center.
 *
 * Runs the API + the built UI as background services that stay up after you
 * close Terminal and restart on reboot (with `pm2 startup` + `pm2 save`).
 *
 * Usage:
 *   npm install -g pm2          # one time
 *   npm run build               # build the UI (creates dist/)
 *   pm2 start ecosystem.config.cjs
 *   pm2 save                    # remember these for reboot
 * Open http://localhost:3001
 */
module.exports = {
  apps: [
    {
      name: 'liv8-api',
      cwd: './server',
      script: 'server.js',
      env: { PORT: 3005, DB_DATA_DIR: './data' },
      autorestart: true,
      max_restarts: 10,
    },
    {
      // Serves the built UI from dist/ (run `npm run build` first / after updates)
      name: 'liv8-ui',
      script: './node_modules/vite/bin/vite.js',
      args: 'preview --port 3001 --host',
      autorestart: true,
    },
  ],
};
