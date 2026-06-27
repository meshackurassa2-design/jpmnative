const fs = require('fs');
const readline = require('readline');

async function extract() {
  const fileStream = fs.createReadStream('C:\\Users\\Joshan\\.gemini\\antigravity-ide\\brain\\768b38e0-cbe5-4551-951f-9746b505d520\\.system_generated\\logs\\transcript.jsonl');
  const rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity });

  for await (const line of rl) {
    if (line.includes('"step_index":2215')) {
      const parsed = JSON.parse(line);
      const code = parsed.tool_calls[0].args.CodeContent;
      fs.writeFileSync('C:\\jpm_app\\scratch\\step2215_code.ts', code);
      console.log('Extracted to C:\\jpm_app\\scratch\\step2215_code.ts');
      return;
    }
  }
}
extract();
