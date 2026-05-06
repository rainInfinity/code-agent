## 1. Data layer: sync thinking blocks

- [x] 1.1 Update `chatStore.appendThinkingToMessage` to append or update a `thinking` ContentBlock while updating `thinkingContent`
- [x] 1.2 Update the last `thinking` block in place when it is already the trailing block; otherwise append a new block

## 2. Data layer: sync tool blocks

- [x] 2.1 Update `traceUtils.applyToolTraceToMessage` to append `{ type: 'tool_use', id, name, input }` when `phase === 'requested'`
- [x] 2.2 Append `{ type: 'tool_result', toolUseId, content }` when `phase === 'completed'`
- [x] 2.3 Append `{ type: 'tool_result', toolUseId, content, isError: true }` when `phase === 'failed'`
- [x] 2.4 Update `traceUtils.test.ts` to verify tool events generate the corresponding ContentBlocks

## 3. Rendering layer: unified contentBlocks rendering

- [x] 3.1 Update `MessageBodyContent` to remove the hard-coded `thinkingContent` -> `content` -> `toolTraces` render order
- [x] 3.2 Render by traversing `contentBlocks`: `thinking` -> `ThinkingPanel`, `text` -> `MarkdownRenderer` or `UserMessageText`, `tool_use` -> tool trace card, `tool_result` -> result display
- [x] 3.3 Ensure `tool_use` rendering resolves full state data from `message.toolTraces` including status, output, and error
- [x] 3.4 Update `MessageList.test.tsx` with a unified contentBlocks rendering test that verifies tool blocks render before text blocks

## 4. Backward compatibility: migrate legacy message content

- [x] 4.1 Add migration detection in `normalizePersistedConversations` for legacy messages where `contentBlocks` are empty or text-only but `thinkingContent` or `toolTraces` are populated
- [x] 4.2 Rebuild `thinking`, `tool_use`, `tool_result`, and trailing `text` ContentBlocks in chronological order from legacy fields
- [x] 4.3 Ensure already-migrated messages do not get migrated again

## 5. Rust backend: fix `build_assistant_content_blocks` ordering

- [x] 5.1 Update `session.rs` so `build_assistant_content_blocks` emits `Thinking -> ToolCalls -> Text`
- [x] 5.2 Update `assistant_content_blocks_place_thinking_before_text_and_tools` to assert the new order
- [x] 5.3 Add coverage for `Thinking + ToolCalls` without text and `Thinking + Text` without tool calls

## 6. Verification

- [x] 6.1 Run the frontend test suite with `npm test`
- [x] 6.2 Manual test: start the Agent, trigger a tool call, and verify the main window renders `Thinking -> Tools -> Text`
- [x] 6.3 Manual test: load a legacy persisted conversation and verify migrated render order
- [x] 6.4 Verify the Trace panel remains unaffected
