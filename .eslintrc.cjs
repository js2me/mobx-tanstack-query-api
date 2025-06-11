module.exports = {
  extends: [require.resolve('js2me-eslint-config')],
  rules: {
    "@typescript-eslint/no-unsafe-declaration-merging": 'off', 
    "@typescript-eslint/no-this-alias": 'off', 
    "prefer-spread": 'off', 
    "sonarjs/prefer-spread": 'off', 
    "unicorn/no-this-assignment": 'off', 
    "sonarjs/argument-type": 'off',
    "sonarjs/prefer-function-type": 'off', 
    'unicorn/prefer-spread': 'off',
    'sonarjs/deprecation': 'off',
    'sonarjs/no-commented-code': 'off'
  }
};
