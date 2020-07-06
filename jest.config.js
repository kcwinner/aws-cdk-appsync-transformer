module.exports = {
  "roots": [
    "<rootDir>/tests"
  ],
  testMatch: ['**/*.test.ts'],
  "transform": {
    "^.+\\.tsx?$": "ts-jest"
  },
  collectCoverage: true,
  collectCoverageFrom: [
    "**/*.js",
    "**/*.ts",
    "!**/node_modules/**"
  ]
}
