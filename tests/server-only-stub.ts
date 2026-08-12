// Vitest executes server modules in Node without React's `react-server`
// export condition. The production bundler enforces the real boundary; tests
// alias the marker to this inert module so server contracts can be exercised.
export {};
