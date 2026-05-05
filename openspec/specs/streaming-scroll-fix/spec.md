# streaming-scroll-fix Specification

## REMOVED Requirements

### Requirement: Tail/Stable Segmented Rendering

`StreamingMessageContent` 组件及其 tail/stable 分段渲染逻辑（`splitStreamingContent`、`checkOpenCodeFence`）SHALL 被移除。

**理由**: 分段渲染在 tail→stable 迁移时制造渲染模式边界——纯文本突然变为 Markdown DOM（标题、代码块、段落等），高度跳变不伴随 `content.length` 变化，Zustand 滚动签名无法跟踪，直接导致滚动条抖动和底部吸附失效。全量 Markdown 直接渲染消除模式切换，高度随 `content.length` 线性增长，滚动签名自然跟踪。

#### Scenario: 流式消息直接全量 Markdown 渲染

- **GIVEN** 流式消息 content 为 "# Title\n\nSome text\n\n```ts\nconst x = 1;\n```"
- **WHEN** 渲染该流式消息
- **THEN** 整个 content SHALL 通过 `MarkdownRenderer` 渲染（`isStreaming=true`）
- **AND** SHALL NOT 存在 tail/stable 分段逻辑
- **AND** 代码块 SHALL 使用 `PlainCodeBlock`（因为 `isStreaming=true`）

#### Scenario: 未闭合代码块处理

- **GIVEN** 流式消息 content 为 "```ts\nconst x = 1;\n"（代码块未闭合）
- **WHEN** `MarkdownRenderer` 渲染（`isStreaming=true`）
- **THEN** `react-markdown` SHALL 将剩余内容吞入 code block 作为纯文本
- **AND** `CodeBlock` 检测到 `isStreaming=true` SHALL 使用 `PlainCodeBlock` 渲染
- **AND** 视觉上保持连续，无模式切换

### Requirement: StreamingMessageContent 组件移除

`StreamingMessageContent` 组件、`splitStreamingContent()` 函数、`checkOpenCodeFence()` 函数、`STABLE_THRESHOLD_MS` 和 `TAIL_CHARS` 常量、`stableTick` 状态 SHALL 从代码中移除。`MessageBodyContent` SHALL 在流式和非流式状态下统一使用 `MarkdownRenderer`。

## ADDED Requirements

### Requirement: Smooth Scroll Does Not Block Auto-Follow During Streaming

流式输出期间（`isStreaming === true`），`scrollToBottomInstant()` SHALL 忽略 `smoothScrollUntilRef` 阻塞，确保自动跟随不受用户手动触发 smooth scroll 的影响。

#### Scenario: 流式输出中用户点击"回到底部"后继续跟随

- **GIVEN** 流式输出正在进行，`isStreaming === true`
- **WHEN** 用户点击"滚动到底部"按钮（触发 700ms smooth scroll）
- **THEN** 后续 delta 到达时，`scrollToBottomInstant` SHALL 仍然执行滚动（不被 smooth 阻塞）
- **AND** 自动跟随 SHALL 保持吸附在底部

#### Scenario: 非流式时 smooth scroll 阻塞保持

- **GIVEN** 流式输出已结束，`isStreaming === false`
- **WHEN** 用户点击"滚动到底部"按钮触发 smooth scroll
- **THEN** 700ms 内 `scrollToBottomInstant`（非 force）SHALL 被阻塞
- **AND** 现有非流式滚动行为 SHALL 保持不变

### Requirement: Force Scroll on Streaming→Complete Transition

流式结束时（`isStreaming` 从 `true` 变为 `false`），`MessageList` SHALL 在 SyntaxHighlighter 完成 DOM 渲染后执行强制滚动到底部。

#### Scenario: 流式结束后 PlainCodeBlock 切换为 SyntaxHighlighter

- **GIVEN** 流式消息包含代码块，使用 `PlainCodeBlock` 渲染
- **WHEN** 消息 status 变为 'complete'，`MarkdownRenderer` 切换为 `isStreaming=false`
- **THEN** 所有代码块 SHALL 从 `PlainCodeBlock` 切换为 `SyntaxHighlighter`
- **AND** MessageList SHALL 在 DOM 稳定后（50ms delay）执行 `syncScrollInFrame(true)`
- **AND** 页面 SHALL 保持在底部

#### Scenario: 无代码块的流式结束不需要额外滚动

- **GIVEN** 流式消息不包含代码块（纯文本）
- **WHEN** 消息 status 变为 'complete'
- **THEN** `MarkdownRenderer` 渲染结果高度不变（markdown 在流式/非流式下对纯文本一致）
- **AND** 无需额外滚动（但执行也不会有负面影响）

### Requirement: Zustand Scroll Signature Captures Status Transitions

`getStreamingScrollSignature()` SHALL 在不存在 streaming 消息时返回基于最后一条消息 status 的过渡签名，确保 Zustand 订阅能捕获 streaming→complete 的状态变更。

#### Scenario: 订阅捕获完成状态

- **GIVEN** 最后一条消息由 streaming 变为 complete
- **WHEN** Zustand 订阅回调执行
- **THEN** `getStreamingScrollSignature` SHALL 返回 `"completed:<messageId>"` 而非空字符串
- **AND** 订阅 SHALL 触发 `syncScrollInFrame()`

#### Scenario: 无消息时间返回空签名

- **GIVEN** 对话无任何消息
- **WHEN** `getStreamingScrollSignature` 被调用
- **THEN** SHALL 返回空字符串 `""`
