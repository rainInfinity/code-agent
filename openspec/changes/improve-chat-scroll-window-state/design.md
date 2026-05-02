# Design

## Current Shape

### Streaming → Markdown Jitter

当前流式响应期间，每条消息的 `MessageBody` 始终使用 `MarkdownRenderer` 渲染内容（[MessageList.tsx:286](src/components/Chat/MessageList.tsx#L286)）。`react-markdown` 在每次 token 到达时重新解析不完整的 markdown 文本：

```
流式文本片段                  渲染结果高度
"这是一个示例"              → ~20px (纯文本)
"这是一个示例\n```js"       → ~20px (代码块未闭合，当作文本)
"这是一个示例\n```js\nconst" → ~20px (同上)
"这是一个示例\n```js\nconst x = 1;\n```" → ~70px (完整代码块，包含 header + syntax highlight)
                                                                      ↑
                                                              瞬时高度跳变 ~50px
```

类似的跳变还发生在：
- `**bold**` 标记闭合时（粗体 vs 显示 `**` 文本）
- 表格行完成时（带边框和 padding 的表格 vs 纯文本）
- 标题 `#` 标记被解析时（大字号 vs 普通文本）

### Auto-scroll Behavior

当前逻辑（[MessageList.tsx:231-243](src/components/Chat/MessageList.tsx#L231-L243)）：

```typescript
useEffect(() => {
  const el = listRef.current;
  if (!el) return;
  const isNearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 100;
  if (isNearBottom) {
    el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }
  updateScrollAffordance();
}, [messages, messages[messages.length - 1]?.content, ...]);
```

问题：
1. 每次 token 都触发 `behavior: "smooth"` —— 快速流式时产生动画队列堆积
2. 单一阈值 100px，无迟滞（hysteresis），用户轻微上滚即失去跟随，且容易意外触发
3. 依赖 `useEffect` 在渲染后执行，存在一帧延迟

### Window State

当前 `tauri.conf.json` 硬编码窗口默认值 1200×800，无持久化。窗口关闭后所有位置/尺寸信息丢失。

## Proposed Design

### 1. Raw Text During Streaming

**核心思路**：流式期间显示原始 markdown 文本，完成后再渲染。

```
status === "streaming"  →  <StreamingText>{content}</StreamingText>
status === "complete"   →  <MarkdownRenderer content={content} />
```

`StreamingText` 组件：
- `white-space: pre-wrap` 保留换行和空格
- `font-family: $fontFamilyMono`（等宽字体，与 markdown 代码块一致）
- 字号与渲染后的 markdown 正文一致 (`fontSize.base`)
- 行高与渲染后一致 (`lineHeight.relaxed`)

**过渡动画**：流式完成时，添加 200ms opacity crossfade：
```
StreamingText (opacity: 1 → 0)
     ↓
MarkdownRenderer (opacity: 0 → 1)
```
使用 CSS `transition` 实现，不引入额外动画库。

### 2. Intelligent Auto-Scroll

**双模式滚动策略**：

```
┌──────────────────────────────────────────────┐
│              Scrolling Strategy               │
│                                              │
│  STREAMING (isStreaming === true)            │
│  ┌────────────────────────────────────┐      │
│  │ 用户未上滚 (autoFollow = true)      │      │
│  │ → instant scroll:                  │      │
│  │   el.scrollTop = el.scrollHeight   │      │
│  │   (无动画，避免队列堆积)            │      │
│  │                                    │      │
│  │ 用户已上滚 (autoFollow = false)    │      │
│  │ → 不滚动，显示 ↓ 按钮              │      │
│  └────────────────────────────────────┘      │
│                                              │
│  IDLE (isStreaming === false)                │
│  ┌────────────────────────────────────┐      │
│  │ CSS scroll-behavior: smooth        │      │
│  │ 仅在用户点击 ↓ 按钮时触发动画      │      │
│  └────────────────────────────────────┘      │
└──────────────────────────────────────────────┘
```

**迟滞阈值（Hysteresis）**：

```
用户向上滚动超过 150px  →  autoFollow = false (显示 ↓ 按钮)
用户滚回底部 50px 以内   →  autoFollow = true  (隐藏 ↓ 按钮)
用户点击 ↓ 按钮          →  autoFollow = true  (滚动到底部)
```

**实现方式**：
- 在 `ListContainer` 的 `onScroll` 事件中追踪用户的滚动意图
- 使用 `useRef` 存储 `autoFollow` 状态（无需触发 re-render）
- `ResizeObserver` 监听消息列表高度变化，在 `autoFollow` 为 true 时 stick to bottom
- 区分"用户主动上滚"和"内容增长导致的被动滚动"

### 3. Scrolling During Content Transitions

当流式完成、从 `StreamingText` 切换到 `MarkdownRenderer` 时，内容高度可能变化。处理策略：

- 如果 `autoFollow === true`：在 markdown 渲染完成后，使用 `ResizeObserver` 检测高度变化，用 instant scroll 跟随
- 如果 `autoFollow === false`：保持当前滚动位置不变，用户的视口不受影响

### 4. Window State Persistence

**方案：使用 Tauri v2 的 Window API 手动实现**

不使用第三方插件，直接通过 Tauri v2 的 `Window` API 实现：

**保存**：
- 在 `lib.rs` 的 `setup` 中监听窗口的 move/resize 事件
- debounce 500ms 后，将 `{ x, y, width, height, maximized }` 写入 `app_data_dir/window-state.json`
- 窗口关闭时也保存一次（在 `on_window_event` 中处理 `CloseRequested`）

**恢复**：
- 在 `setup` 阶段，先读取 `window-state.json`
- 如文件存在，调用 `window.set_position()` 和 `window.set_size()`
- 如果上次是最大化状态，调用 `window.maximize()`
- 验证位置在当前显示器范围内（防止保存的位置在已断开的外部显示器上）

**权限**：需要在 capabilities 中添加窗口位置/尺寸相关的权限。

```
┌─────────────────────────────────────────────┐
│         Window State Flow                    │
│                                              │
│  App Start                                   │
│     │                                        │
│     ▼                                        │
│  Read window-state.json                      │
│     │                                        │
│     ├─ 存在 ──▶ 恢复 position/size/maximized │
│     │                                        │
│     └─ 不存在 ──▶ 使用 tauri.conf.json 默认值 │
│                                              │
│  Window Created                              │
│     │                                        │
│     ▼                                        │
│  Listen move/resize (debounced 500ms)        │
│     │                                        │
│     ▼                                        │
│  Save to window-state.json                   │
│                                              │
│  Window CloseRequested                       │
│     │                                        │
│     ▼                                        │
│  Save final state (no debounce)              │
└─────────────────────────────────────────────┘
```

## Component Changes

### MessageList.tsx

新增 hooks 和逻辑：
- `useRef<boolean> autoFollow` — 追踪是否应跟随底部
- `onScroll` handler — 检测用户滚动方向，更新 `autoFollow`
- `ResizeObserver` — 替代 `useEffect` 进行高度变化检测
- `useEffect` — 监听 `isStreaming` 变化，管理滚动模式切换

### MessageBody 渲染逻辑

```tsx
<MessageBody>
  {msg.status === "error" ? (
    <ErrorMessage>...</ErrorMessage>
  ) : msg.status === "streaming" && !msg.content ? (
    <ThinkingIndicator>...</ThinkingIndicator>
  ) : msg.status === "streaming" ? (
    <StreamingText>{msg.content}</StreamingText>
  ) : (
    <MarkdownRenderer content={msg.content} />
  )}
</MessageBody>
```

### src-tauri/lib.rs

新增：
- `use tauri::WindowEvent;` 
- `use std::fs;`
- `use serde::{Serialize, Deserialize};`
- 窗口状态结构体 `WindowState`
- `save_window_state()` 和 `load_window_state()` 函数
- 在 `setup` 中注册事件监听和状态恢复

## Risks

- Raw text during streaming 改变了用户看到的中间状态（不再有格式化预览），但这是 ChatGPT/Claude 等主流产品的做法
- Window state 文件损坏可能导致窗口显示在屏幕外 —— 需要验证 saved position 在有效显示器范围内
- `ResizeObserver` 在某些边缘情况下可能有性能影响 —— 只观察消息列表容器，而非单个消息
