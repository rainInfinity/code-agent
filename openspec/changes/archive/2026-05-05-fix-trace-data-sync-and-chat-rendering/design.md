## Context

本变更集中在前端状态管理、Tauri 前端事件和 React 组件层。Rust 后端继续广播现有 agent/stream/trace 事件，不需要新增命令。

核心数据路径是：

1. Rust 后端广播 `agent-turn`、`trace-prompt`、`thinking-delta`、`stream-delta`、`trace-thinking-end`、`agent-complete` 等事件。
2. 主窗口 `useAgent` 接收事件，更新聊天消息，同时写入 `useChatStore.conversations[].turns`。
3. `useChatStore` 通过 Zustand persist 保存到主窗口 localStorage key `code-agent-chat-history`。
4. Trace 窗口启动后先从 `code-agent-chat-history` 读取持久化快照，再请求主窗口实时同步。
5. Trace 窗口按 `traceStore.conversationId` 从本地 `chatStore.conversations[].turns` 渲染 Trace 面板。

## Decisions

### Decision 1: 主窗口负责持久化 Trace turns

**选择**：在 `useAgent.ts` 中让主窗口监听 Trace 生命周期事件，并写入当前 conversation 的 `turns`。

**理由**：主窗口是聊天历史的权威来源，也是 `code-agent-chat-history` 的写入方。如果只让 Trace 窗口记录 turns，那么“先生成、后打开 Trace”时主窗口没有历史 Trace 可同步。

### Decision 2: Trace 窗口启动时先读主窗口持久化快照

**选择**：Trace 窗口在安装 IPC 监听器后，直接读取 `code-agent-chat-history` 并合并到自己的 `chatStore`，然后再发送 `trace-window-ready`。

**理由**：持久化快照读取不依赖窗口间事件时序。即使 ready 事件丢失、主窗口暂时没有 active conversation，Trace 窗口也能先展示已保存的历史 turns。

### Decision 3: 保留主窗口/Trace 窗口不同 persist key

**选择**：主窗口使用 `code-agent-chat-history`，Trace 窗口使用 `code-agent-trace-chat-history`，并在代码中抽出常量。

**理由**：Trace 窗口需要本地同步副本，但不应覆盖主窗口聊天历史。显式常量也避免 hard-coded key 分散在不同文件。

### Decision 4: 合并同步数据时保护已有 turns

**选择**：Trace 窗口收到 incoming conversations 后，如果某个 incoming conversation 的 `turns` 为空而本地已有 turns，则保留本地 turns。

**理由**：主窗口旧版本或异常快照可能没有 turns。直接覆盖会把 Trace 窗口已经监听到的历史清空。

### Decision 5: 清除 Trace 要同步清除持久化历史

**选择**：Trace 窗口清除按钮先清本地 turns，再 emit `trace-clear-conversation`；主窗口收到后调用 `clearConversationTurns` 并回推 `trace-sync-conversations`。

**理由**：清除按钮语义是清除当前对话 Trace 数据，而不是只清当前窗口展示。主窗口持久化历史必须同步更新，否则重新打开后历史会回来。

### Decision 6: 流式滚动使用统一接近底部阈值

**选择**：使用 `AUTO_FOLLOW_BOTTOM_THRESHOLD_PX = 150` 判断是否接近底部，流式更新时在内容增长前根据当前 DOM 位置重新确认是否应跟随，并禁用浏览器 `overflow-anchor` 干扰。

**理由**：原先离开阈值和重新进入阈值不一致，用户在底部附近时可能不会恢复跟随。统一阈值更符合“底部正负 150px 内跟随”的需求。

### Decision 7: 用户消息纯文本渲染

**选择**：`MessageBodyContent` 接收 `role`，用户消息用 `<pre>` 风格的 `UserMessageText` 渲染，助手消息继续用 MarkdownRenderer。

**理由**：用户输入是自由文本，`*`、`_`、`#` 等字符不应被 Markdown 解释。助手回复保留 Markdown 能力。

## Risks / Trade-offs

- **旧历史不可完全恢复**：在修复之前已经生成但没有持久化 turns 的旧对话，不能从最终聊天文本还原 prompt/tools/thinking 等完整 Trace 结构。
- **Trace 窗口读取主窗口 localStorage key**：两个窗口同源，使用不同 key。Trace 读主窗口 key 是只读初始化兜底，不改变主窗口权威写入。
- **重复事件风险**：主窗口和 Trace 窗口都监听 live events，但分别写各自窗口的 store；跨窗口同步通过合并保护避免空数据覆盖。
- **清除事件是前端事件**：如果主窗口不存在或监听器未安装，Trace 本地会被清掉但主窗口历史不会收到事件。正常应用结构中主窗口始终存在。
