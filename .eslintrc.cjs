module.exports = {
  "root": true,
  "parser": "@typescript-eslint/parser",
  "plugins": [
    "@typescript-eslint"
  ],
  "extends": [
    "eslint:recommended",
    "plugin:@typescript-eslint/eslint-recommended",
    "plugin:@typescript-eslint/recommended"
  ],
  "ignorePatterns": ["*.cjs"],
  "rules": {
    "comma-dangle": ["error", "always-multiline"],
    "@typescript-eslint/no-inferrable-types": false,
  },
};
