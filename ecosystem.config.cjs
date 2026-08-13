/**
 * PM2 process config for running LIV8 Command Center as a background service.
 * So you don't need a terminal window open and it restarts on crash/reboot.
 *
 * Usage:
 *   npm install -g pm2
 *   npm run build                 # build the web app once
 *   pm2 start ecosystem.config.cjs
 *   pm2 save                      # remember these processes
 *   pm2 startup                   # (run the line it prints) start on boot
 *
 * Useful: pm2 ls | pm2 logs | pm2 restart all | pm2 stop all
 */
module.exports = {
  apps: [
    {
      name: 'liv8-server',
      cwd: './server',
      script: 'server.js',
      // Keep the around-the-clock worker alive in the background.
      env: { NODE_ENV: 'production' },
      max_restarts: 10,
      restart_delay: 3000,
      time: true
    },
    {
      name: 'liv8-web',
      // Serve the built frontend (run `npm run build` first).
      script: 'node_modules/vite/bin/vite.js',
      args: 'preview --host --port 5173',
      env: { NODE_ENV: 'production' },
      max_restarts: 10,
      restart_delay: 3000,
      time: true
    }
  ]
};
