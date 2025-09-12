module.exports = {
  apps: [
    {
      name: 'binance-mcp-server',
      script: 'npm',
      args: 'run start:multi-mode',
      log_date_format: 'YYYY-MM-DD HH:mm Z',
      env: {
        PORT: 3010,
      },
    },
  ],
};
