const { defaultsESM } = require('ts-jest/presets');

/** @type {import('jest').Config} */
module.exports = {
  ...defaultsESM,
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
};
