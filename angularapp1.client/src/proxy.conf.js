const { env } = require('process');

const target = 'http://localhost:5296';

const PROXY_CONFIG = [
  {
    context: ['/api', '/weatherforecast'],
    target,
    secure: false,
    changeOrigin: true,
  },
];

module.exports = PROXY_CONFIG;
