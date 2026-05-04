# streaming-render-performance Specification

## ADDED Requirements

### Requirement: FrozenTail Message Isolation

已完成的消息（status 不为 'streaming'）在流式输出过程中 SHALL 不参与重渲染。`MessageList` SHALL 只读取消息 ID 列表和元信息，每条消息的内容订阅 SHALL 下沉到独立 `MessageItem` 组件通过 Zustand selector 精确获取。

#### Scenario: 流式输出中已完成消息不重渲染

- **GIVEN** 对话包含 10 条已完成消息和 1 条正在流式输出的消息
- **WHEN** 流式消息收到新的 text delta
- **THEN** 10 条已完成消息的 `MessageItem` 组件 SHALL 不触发重渲染
- **AND** 只有流式消息的 `MessageItem` SHALL 触发重渲染

#### Scenario: 流式消息完成后转为冻结

- **GIVEN** 流式消息收到 stream-end 事件，status 更新为 'complete'
- **WHEN** 下一条消息开始流式输出
- **THEN** 之前完成的消息 SHALL 不再参与重渲染

### Requirement: Delta Batching via requestAnimationFrame

流式 delta 事件处理 SHALL 通过 `requestAnimationFrame` 将同一帧内的多个 delta 合并为单次 Zustand 状态更新，将重渲染频率限制在 60fps 以内。

#### Scenario: 单帧内多个 delta 合并

- **GIVEN** LLM 在 16ms 内输出 3 个 text delta（"Hel", "lo ", "World"）
- **WHEN** 浏览器执行下一个 animation frame
- **THEN** 3 个 delta SHALL 合并为一次 `chatStore.appendToMessage` 调用
- **AND** 合并后的内容 SHALL 为 "Hello World"
- **AND** `MessageList` SHALL 仅触发一次重渲染

#### Scenario: 跨帧 delta 分别提交

- **GIVEN** LLM 在第 1 帧输出 delta "Hel"，第 2 帧输出 delta "lo "
- **WHEN** 每个 animation frame 执行
- **THEN** 每个帧的 delta SHALL 独立提交到 `chatStore`
- **AND** 总渲染次数 SHALL 不超过 2 次

### Requirement: Streaming Content Segmented Rendering

流式消息内容 SHALL 根据稳定性分为稳定区域和变化尾部。稳定区域（200ms 内未变化的部分）SHALL 通过 `ReactMarkdown` 正常渲染，变化尾部（最后约 100 字符）SHALL 以纯文本方式渲染，避免 markdown AST 重新解析。

#### Scenario: 脚本内容分段渲染

- **GIVEN** 流式消息当前内容长度为 500 字符，前 400 字符在 200ms 前已稳定
- **WHEN** 渲染该流式消息
- **THEN** 前 400 字符（在最近的换行符处切割）SHALL 通过 `ReactMarkdown` 渲染
- **AND** 剩余约 100 字符 SHALL 通过纯文本 `<span>` 渲染

#### Scenario: 短消息全作为尾部

- **GIVEN** 流式消息当前内容长度为 50 字符
- **WHEN** 渲染该流式消息
- **THEN** 整个内容 SHALL 作为变化尾部以纯文本渲染
- **AND** 不触发 `ReactMarkdown` 解析

### Requirement: Deferred Syntax Highlighting for Open Code Fences

流式消息（status 为 'streaming'）中的代码块，在代码围栏（```）未闭合时 SHALL 使用纯文本 `<pre><code>` 渲染，SHALL NOT 调用 `SyntaxHighlighter` 执行语法高亮。代码块闭合后，在消息 status 为 'complete' 时 SHALL 启用完整语法高亮。

#### Scenario: 未闭合代码块不高亮

- **GIVEN** 流式消息包含内容 "```typescript\nconst x = 1;\n"（代码块未闭合）
- **WHEN** 渲染该流式消息
- **THEN** 代码块 SHALL 使用 `<pre><code>` 纯文本渲染
- **AND** SHALL NOT 调用 `SyntaxHighlighter` 组件

#### Scenario: 已闭合代码块在完成后高亮

- **GIVEN** 消息 status 为 'complete'，内容包含完整闭合的代码块
- **WHEN** 渲染该消息
- **THEN** 代码块 SHALL 使用 `SyntaxHighlighter` 渲染
- **AND** SHALL 应用 Prism.js 语法高亮

#### Scenario: 流式输出中代码块闭合后仍不高亮

- **GIVEN** 流式消息中的代码块刚完成闭合（``` 数量已为偶数），但 status 仍为 'streaming'
- **WHEN** 渲染该流式消息
- **THEN** 代码块 SHALL 继续使用纯文本 `<pre><code>` 渲染
- **AND** SHALL NOT 调用 `SyntaxHighlighter`（仅在 status 变为 'complete' 后启用）
