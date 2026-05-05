## 1. Trace 数据持久化与同步修复

- [x] 1.1 `src/stores/chatStore.ts`: 抽出 `CHAT_HISTORY_STORAGE_KEY` 和 `TRACE_CHAT_HISTORY_STORAGE_KEY`，明确主窗口与 Trace 窗口 persist key。
- [x] 1.2 `src/hooks/useAgent.ts`: 主窗口在 `agent-turn` 时追加 `TurnTrace` 到当前 conversation。
- [x] 1.3 `src/hooks/useAgent.ts`: 主窗口在 `trace-prompt`、`trace-thinking-start`、`trace-thinking-end` 时更新最新 turn。
- [x] 1.4 `src/hooks/useAgent.ts`: 主窗口在 `thinking-delta` 和 `stream-delta` flush 时同步更新最新 turn 的 thinking/response 内容。
- [x] 1.5 `src/hooks/useAgent.ts`: 主窗口在 `agent-complete` 时补齐 turn status、endTime 和 usage。
- [x] 1.6 `src/components/Layout/StatusBar.tsx`: `onTraceWindowReady` 中无条件发送 `trace-sync-conversations`，仅对 `trace-conversation-changed` 保持 `currentId` 条件。
- [x] 1.7 `src/hooks/useTraceIpc.ts`: Trace 窗口启动后读取主窗口持久化快照 `code-agent-chat-history`，先完成本地 hydrate，再 emit `trace-window-ready`。
- [x] 1.8 `src/hooks/useTraceIpc.ts`: Trace 窗口合并 incoming conversations 时保留本地已有 turns，避免空 turns 覆盖历史。
- [x] 1.9 `src/hooks/useTraceIpc.ts`: `trace-conversation-changed` 和 `trace-sync-conversations` 后同步 Trace 状态栏的 session/status。

## 2. Trace 清除历史修复

- [x] 2.1 `src/hooks/useIpc.ts`: 新增 `emitTraceClearConversation` 和 `onTraceClearConversation`。
- [x] 2.2 `src/components/Trace/TracePanel.tsx`: 清除按钮清空本地 turns 后 emit `trace-clear-conversation`。
- [x] 2.3 `src/components/Layout/StatusBar.tsx`: 主窗口监听 `trace-clear-conversation`，调用 `clearConversationTurns` 清主窗口持久化历史。
- [x] 2.4 `src/components/Layout/StatusBar.tsx`: 主窗口清除后回推 `trace-sync-conversations`，让 Trace 窗口同步空历史。

## 3. 流式滚动跟随修复

- [x] 3.1 `src/components/Chat/MessageList.tsx`: 使用 `AUTO_FOLLOW_BOTTOM_THRESHOLD_PX = 150` 统一接近底部判断。
- [x] 3.2 `src/components/Chat/MessageList.tsx`: 新增 `isNearBottom`，在流式内容更新前根据当前 DOM 位置恢复 auto-follow。
- [x] 3.3 `src/components/Chat/MessageList.tsx`: 新增 `skipScrollEventRef`，程序自动滚动期间跳过 `onScroll` 距离检测。
- [x] 3.4 `src/components/Chat/MessageList.tsx`: `syncScrollInFrame` 中根据 `force || autoFollowRef || isNearBottom` 决定是否滚到底部。
- [x] 3.5 `src/components/Chat/MessageList.tsx`: 滚动容器增加 `overflow-anchor: none`，减少浏览器滚动锚定干扰。

## 4. 用户消息渲染修复

- [x] 4.1 `src/components/Chat/MessageList.tsx`: `MessageBodyContent` 新增 `role` prop。
- [x] 4.2 `src/components/Chat/MessageList.tsx`: 用户消息使用 `UserMessageText` 纯文本渲染，不经过 MarkdownRenderer。
- [x] 4.3 `src/components/Chat/MessageList.tsx`: `UserMessageText` 设置 `max-height: 360px`、`overflow-y: auto`、`white-space: pre-wrap`、`word-break: break-word`。
- [x] 4.4 `src/components/Chat/MessageList.tsx`: 助手消息保持 MarkdownRenderer 渲染。

## 5. 验证

- [x] 5.1 运行 `npm run build`，确认 TypeScript 与 Vite 构建通过。
- [x] 5.2 验证 Trace 数据生成后写入主窗口 `conversations[].turns` 并进入 `code-agent-chat-history`。
- [x] 5.3 验证 Trace 窗口打开时可从持久化快照加载当前 conversation turns。
- [x] 5.4 验证 Trace ready 后主窗口无条件回推全量 conversations。
- [x] 5.5 验证 Trace 清除按钮会清本地 turns，并清主窗口历史 turns。
- [x] 5.6 验证流式生成期间底部或 150px 内保持自动跟随。
- [x] 5.7 验证用户消息中的 Markdown 特殊字符按原文显示，助手消息 Markdown 正常渲染。
