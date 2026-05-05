# optimize-streaming-render-performance Task List

## 1. Message Isolation Layer - MessageItem extraction and precise subscription

- [x] 1.1 Extract an independent `MessageItem` component from `MessageList.tsx`, including the full rendering logic for Avatar, RoleName, MessageBody, and MessageActions
- [x] 1.2 Reduce `MessageList` to a pure container: subscribe only to `messageIds` metadata (id + role + status) via a Zustand selector, then render the `MessageItem` list with `.map()`
- [x] 1.3 Make `MessageItem` subscribe precisely to a single message via Zustand selector and combine it with `React.memo` default shallow comparison for frozen historical messages
- [ ] 1.4 Verify with React DevTools Profiler during streaming that historical messages rerender 0 times

## 2. Delta Throttling Layer - RAF batched commits

- [x] 2.1 Add delta string accumulation in the `onStreamDelta` handling inside `useAgent.ts`
- [x] 2.2 Add a `requestAnimationFrame` gate so multiple deltas in one frame trigger only one `chatStore.appendToMessage`
- [x] 2.3 Apply the same RAF throttling logic to `onThinkingDelta`
- [x] 2.4 Ensure stream-end and stream-error flush buffered remaining deltas before running follow-up logic
- [ ] 2.5 Verify with console counting that Zustand update frequency stays at or below 60 updates per second

## 3. Segmented Rendering Layer - streaming message content splitting

- [x] 3.1 Implement `splitStreamingContent` to calculate stable content and changing tail based on stable threshold and tail window size
- [x] 3.2 Add segmented rendering in `MessageBodyContent`: stable content through `ReactMarkdown`, tail through plain text `<span>`
- [x] 3.3 Implement `checkOpenCodeFence` to detect whether markdown code fences are open
- [x] 3.4 Extract configuration constants: `STABLE_THRESHOLD_MS` (200ms) and `TAIL_CHARS` (100 chars)

## 4. Deferred Code Highlighting - disable SyntaxHighlighter while streaming

- [x] 4.1 Modify `MarkdownRenderer` / `CodeBlock` so streaming messages render code as plain `<pre><code>` instead of `SyntaxHighlighter`
- [x] 4.2 Add `React.memo` to `MarkdownRenderer`, comparing `content` and `isStreaming`
- [ ] 4.3 Verify with DevTools Performance during streaming code blocks that `Prism.highlight` is not called

## 5. Scroll Behavior Adaptation

- [x] 5.1 Confirm that `ResizeObserver` still triggers auto-scroll correctly after RAF throttling
- [x] 5.2 Confirm `scrollToBottomInstant` timing inside `requestAnimationFrame`
- [x] 5.3 Confirm manual scroll disengage/reengage threshold behavior is unchanged

## 6. Regression Verification

- [ ] 6.1 Full streaming conversation flow: send message, stream response, multi-turn conversation, stop generation
- [ ] 6.2 Code block operations: copy button, expand/collapse if present, language label display
- [ ] 6.3 Thinking Panel: collapse/expand, thinking duration timer, animated gradient border
- [ ] 6.4 Multi-conversation switching: switch away and back, historical messages render correctly
- [ ] 6.5 Error handling: network interruption / stream-error results in message status `error`
- [ ] 6.6 Tool call / Tool result: message updates and rendering during streaming with tool calls