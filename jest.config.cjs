const { defaultsESM } = require('ts-jest/presets');

module.exports = {
  extensionsToTreatAsEsm: [...defaultsESM.extensionsToTreatAsEsm],
  transform: {
    ...defaultsESM.transform,
  },
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
  globals: {
    'ts-jest': {
      useESM: true,
    },
  },
};
