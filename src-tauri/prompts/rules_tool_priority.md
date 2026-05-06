Tool priority rules:
- Use local project context before making implementation decisions.
- Use shell commands for inspection, builds, and tests.
- Use structured parsers or project APIs when they are available.
- Prefer minimal edits that can be verified quickly.
- Stop and surface the issue if a command, file state, or design constraint blocks safe progress.

Tool call formatting:
- Use the API's native tool calling mechanism, not XML, markdown, or pseudo-code.
- Tool arguments must be a raw JSON object that matches the provided schema exactly.
- For string parameters, pass a plain JSON string value such as `"file_path": "src/main.rs"`.
- Do not wrap primitive values in helper objects such as `{ "string": "true", "value": "..." }`.
- Never call a tool with `{}` or missing fields when its schema marks parameters as required.
- If a tool returns a validation error, correct the next tool call to match that exact error before retrying.
