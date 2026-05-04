## Context

当前 Trace 窗口的 `traceStore` 是一个纯内存 Zustand Store（无 `persist` 中间件）。Trace 数据通过 `useTraceIpc()` hook 监听 Rust 后端事件实时写入。切换对话时，`trace-conversation-changed` 事件触发 `reset()`，所有 turns 被清空。

`chatStore` 使用 Zustand `persist` 中间件持久化到 localStorage（key: `code-agent-chat-history`），仅序列化 `conversations` 和 `activeConversationId`。Conversation 类型当前只包含 `id`、`title`、`messages`、`createdAt`、`updatedAt`、`workDir`、`traceEnabled`。

Trace 窗口使用 `.hide()` / `.show()` 模式，切换对话时 StatusBar 的 sync 逻辑仅在 `activeTraceEnabled` 变化时处理窗口显隐，不会自动关闭窗口。

## Goals / Non-Goals

**Goals:**
- Trace 数据按对话 ID 绑定，持久化到 localStorage（随 chatStore）
- 切换对话时，Trace 窗口自动 hide（非 pin 模式），`traceEnabled` 重置
- Pin 按钮允许跨对话保持 Trace 窗口打开
- PromptView、ThinkingView、ResponseView 各有一个复制按钮
- TurnCard 展示 startTime、endTime、耗时
- 用户可手动清除当前对话的 trace 数据

**Non-Goals:**
- Token 用量展示（依赖另一个变更 `fix-streaming-scroll-and-token-usage` 的数据链路）
- Trace 数据导出/导入
- 多 Trace 窗口

## Decisions

### Decision 1: Trace 数据存在 Conversation 上

**选择**: 在 `Conversation` 类型新增 `turns: TurnTrace[]` 字段，随 chatStore 的 persist 序列化到 localStorage。

**备选**: 独立 `traceStore` 加 `persist` 中间件，按 conversationId 分区存储。
**淘汰理由**: 方案 A 更简单——trace 生命周期与 conversation 完全一致（删除对话时 trace 自动清除）；不需要管理两个独立持久化 key 的数据一致性；chatStore 已有成熟的 persist 基础设施（partialize/merge/normalize）。

**数据模型变更**:
```typescript
interface Conversation {
  id: string;
  title: string;
  messages: Message[];
  createdAt: number;
  updatedAt: number;
  workDir?: string;
  traceEnabled?: boolean;
  turns: TurnTrace[];  // NEW
}
```

**persist 适配**: `partialize` 已经序列化 `conversations`，新增的 `turns` 字段会自动包含在内。`normalizePersistedConversations()` 需添加 `turns` 默认值 `[]`。

### Decision 2: traceStore 重构为读写 chatStore 的代理

**选择**: `traceStore` 不再持有独立的 `turns` 数组，改为从 `chatStore` 中读写当前对话的 `turns`。

**理由**: 单一数据源原则。traceStore 的 actions（`startTurn`、`appendThinking` 等）通过 `chatStore.getState()` 定位当前对话并更新其 `turns` 字段。

**traceStore 新架构**:
```typescript
// traceStore 变为轻量代理
interface TraceState {
  conversationId: string | null;
  agentStatus: 'idle' | 'running' | 'complete' | 'error';

  // Actions — 内部读取/写入 chatStore 当前对话的 turns
  startTurn(event): void;
  addPrompt(event): void;
  appendThinking(event): void;
  ...
  clearTurns(conversationId): void;  // NEW: 用户手动清除
}
```

### Decision 3: Pin 按钮在 Trace 窗口标题栏

**选择**: 在自定义标题栏最小化按钮左侧添加 pin 按钮。Pin 状态存入 `chatStore` 当前对话（或全局设置），跨对话保持。

**UI 布局**:
```
┌────────────────────────────────────────────────────────┐
│  Agent Trace                        [📌] [─] [□] [✕]  │
│  (拖拽区域)                          (Pin)(Min)(Max)(Close) │
└────────────────────────────────────────────────────────┘
```

**Pin 状态管理**: Pin 状态是 Trace 窗口级别的设置，不是 per-conversation。有两种选择：
- **A) 全局变量**: 在 traceStore 或独立 store 中维护 `isPinned: boolean`
- **B) 每个对话独立**: 存在 Conversation 上（不合理——pin 是窗口行为）

选择 A，使用 traceStore 的一个字段 `isPinned`。

### Decision 4: 切换对话时的 Trace 行为

**选择**:

```
activeConversationId 变化
  ├── isPinned?
  │   ├── true:  emit new conversationId → 加载新对话的 turns
  │   └── false: hide trace window + 重置 traceEnabled
  └── traceStore 切换到新对话的 turns
```

**实现**: 在 StatusBar 的 `useEffect([activeConversationId])` 中增加 pin 检查。

### Decision 5: 复制按钮实现

**选择**: 每个模块（Prompt/Thinking/Response）的复制按钮使用 `navigator.clipboard.writeText()`，复制模块的完整文本内容。复用 MessageList 中已有的 `copyState` 模式（success/error/idle 三态 + 1.6s 自动重置）。

**具体内容**:
- PromptView 复制: 系统提示 + 所有消息的 role:content 拼接
- ThinkingView 复制: thinking.content 完整文本
- ResponseView 复制: response.content 完整文本

### Decision 6: Turn 时间展示格式

**选择**: 使用已有的 `formatThinkingDuration()` 工具函数（MessageList.tsx:411-425）的模式：
- < 1s: "XXXms"
- < 60s: "X.Xs"
- >= 60s: "XmXs"

**展示位置**: TurnCard 头部 Meta 区域，在状态标记旁：
```
Turn 1 · 完成 · 2.3s
Turn 2 · 完成 · 0.8s
Turn 3 · 运行中 · 1.2s...
```

## Risks / Trade-offs

- **localStorage 容量**: 每个 TurnTrace 含完整 prompt（系统提示 + 所有消息），多轮对话可达数百 KB。localStorage 通常限制 5-10MB，单个对话一般不会触达上限，但需在 `normalizePersistedConversations` 中考虑截断策略（暂不实现，留给后续版本）。
- **TraceStore 重构风险**: traceStore 从独立 turns 迁移到 chatStore 读写，涉及多处调用点变更。需要确保 `updateTurn()` 模式在新架构下仍然正确工作。
- **Pin 状态丢失**: Pin 状态在 traceStore 中（非持久化），Trace 窗口 hide 后组件卸载，pin 状态丢失。→ 将 `isPinned` 持久化到 chatStore 或 traceStore 的 persist 中，或使用 Rust 端窗口状态存储。

## Open Questions

无。关键技术决策已在上文确定。
