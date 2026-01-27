(async () => {
  const { parseRobotsTxt } = require('../dist/knowledge/ingest.js');

  const robots = `
User-agent: *
Disallow: /private
Disallow: /secret

User-agent: aiken-devtools-mcp
Disallow: /blocked
Allow: /blocked/allowed
`;

  console.log('Test 1: generic disallow /private for other agent -> expect false');
  console.log(parseRobotsTxt(robots, '/private/foo', 'other-bot') === false ? 'OK' : 'FAIL');

  console.log('Test 2: generic allow / -> expect true');
  console.log(parseRobotsTxt(robots, '/index.html') === true ? 'OK' : 'FAIL');

  console.log('Test 3: agent-specific /blocked -> expect false');
  console.log(parseRobotsTxt(robots, '/blocked', 'aiken-devtools-mcp') === false ? 'OK' : 'FAIL');

  console.log('Test 4: agent-specific allow override -> expect true');
  console.log(parseRobotsTxt(robots, '/blocked/allowed', 'aiken-devtools-mcp') === true ? 'OK' : 'FAIL');

  process.exit(0);
})();
