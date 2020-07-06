module.exports = {
  roots: [
    "<rootDir>/test"
  ],
  testMatch: ['**/*.test.ts'],
  transform: {
    "^.+\\.tsx?$": "ts-jest"
  },
  collectCoverage: true,
  collectCoverageFrom: [
    "lib/*.ts",
    "!node_modules/**"
  ],
  moduleFileExtensions: [
    "ts",
    "tsx",
    "js",
    "jsx",
    "json",
    "node"
  ],
  globals: {
    "ts-jest": {
      "diagnostics": {
        "warnOnly": true
      }
    },
    "testEnvironment": "node"
  }
}
