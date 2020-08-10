module.exports = {
    "env": {
        "mocha": true,
        "browser": true,
        "es2015": true,
        "commonjs": true,
    },
    "extends": "eslint:recommended",
    "parserOptions": {
        "ecmaVersion": 6,
        "sourceType": "module"
    },
    "rules": {
      "semi": ["error", "always"],
      "quotes": ["error", "single"],
      "strict": ["error", "safe"],
      "curly": "error",
      "eqeqeq": "error",
      "no-alert":"error",
      "no-useless-backreference":"error",
      "consistent-return": "error",
      "no-constructor-return": "error",
      "no-eval": "error",
      "no-implied-eval": "error",
      "no-script-url": "error",
      "no-shadow": "error",
      "no-duplicate-imports": "error",
      "no-useless-computed-key": "error",
      "no-useless-constructor": "error",
      "no-useless-rename": "error",
      "no-var": "error",
      "prefer-const": "error",
      "no-useless-concat": "error",
      "no-useless-return": "error",
      "no-throw-literal": "error",
      "no-unused-expressions": "error",
      "indent": ["error", 2],
      "no-tabs": "error",
      "no-unneeded-ternary": "error",

    }
};
