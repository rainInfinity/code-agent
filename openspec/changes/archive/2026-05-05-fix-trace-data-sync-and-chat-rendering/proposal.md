## Why

Trace 窗口打开后没有稳定展示当前对话已有的 Agent Trace 历史。实际根因不止是窗口 ready 时的全量同步被 `activeConversationId` 条件影响，还包括：

- 主窗口原本没有把 Agent Trace 生命周期事件写入 `conversations[].turns`，导致历史 Trace 没有进入主窗口持久化数据。
- Trace 窗口只依赖窗口间事件同步，打开时机或事件顺序异常时会显示 `Turn 0/0`。
- Trace 窗口收到全量 conversations 时可能用空 `turns` 覆盖本地已经监听到的 turns。
- Trace 窗口的清除按钮只清本窗口本地数据，没有清掉主窗口持久化历史。

同时聊天面板还有两个用户可见问题：流式回复生成时底部滚动跟随不稳定，用户消息被 MarkdownRenderer 解析导致输入文本不能原样显示。

## What Changes

- **Trace 数据持久化**：主窗口监听 Agent Trace 相关事件，并把 turn、prompt、thinking、response、usage 等数据写入当前 conversation 的 `turns`，通过 Zustand persist 保存到 `code-agent-chat-history`。
- **Trace 初始加载兜底**：Trace 窗口安装监听器后，先读取主窗口持久化快照 `code-agent-chat-history`，合并其中的 conversations 和 turns，再发 `trace-window-ready` 请求主窗口推送实时快照。
- **Trace 全量同步修复**：主窗口收到 `trace-window-ready` 后无条件推送 `trace-sync-conversations`；只有存在当前对话时才发送 `trace-conversation-changed`。
- **Trace 合并保护**：Trace 窗口合并同步数据时，如果 incoming conversation 没有 turns 而本地已有 turns，则保留本地 turns，避免历史被空快照覆盖。
- **Trace 清除历史**：Trace 清除按钮会清 Trace 窗口本地 turns，同时通过 `trace-clear-conversation` 通知主窗口清掉同一 conversation 的持久化 turns，并回推同步快照。
- **流式滚动跟随**：统一接近底部阈值为 150px，自动滚动时跳过 scroll 事件误判，流式内容增长前后保持底部跟随。
- **用户消息渲染**：用户消息按纯文本渲染并限制最大高度，助手消息继续使用 MarkdownRenderer。

## Capabilities

### Modified Capabilities

- `trace-window-lifecycle`：Trace 窗口数据持久化、初始化加载、全量同步、合并保护和清除历史流程。
- `chat-auto-scroll`：流式生成期间底部自动跟随和接近底部判断。
- `chat-message-rendering`：用户消息纯文本渲染，助手消息保持 Markdown 渲染。

## Impact

- **前端 IPC**：`src/hooks/useIpc.ts` 新增 `trace-clear-conversation` 事件封装。
- **主窗口事件记录**：`src/hooks/useAgent.ts` 持久化 Agent Trace 生命周期到 `conversations[].turns`。
- **Trace 窗口同步**：`src/hooks/useTraceIpc.ts` 从主窗口持久化快照初始化并合并实时同步数据。
- **Trace 控件**：`src/components/Trace/TracePanel.tsx` 清除按钮同时清本地和主窗口历史。
- **主窗口状态栏**：`src/components/Layout/StatusBar.tsx` 处理 ready、clear 和 conversations 回推。
- **聊天消息列表**：`src/components/Chat/MessageList.tsx` 修复滚动跟随和用户消息渲染。
- **聊天 store**：`src/stores/chatStore.ts` 明确主窗口/Trace 窗口持久化 key。
