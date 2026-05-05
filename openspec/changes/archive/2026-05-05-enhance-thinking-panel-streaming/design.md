## Context

当前 `MessageList.tsx` 中 `MessageBodyContent` 的思考部分展示为简单的 `<details>` + `<pre>` 结构：
- `ThinkingPanelShell`：`<details>` 包裹，summary 显示 "Thinking" + 一个脉冲圆点
- `ThinkingBody`：`<pre>` 展示原始思考文本，`max-height: 260px`
- 无滚动行为、无耗时显示、无动画边框、无完成状态区分

上游数据链路：Rust 后端通过 `thinking-delta` Tauri 事件逐段发送思考内容 → `useIpc.ts` 监听 → `chatStore.appendThinkingToMessage` 拼接 → `MessageList` 重渲染。

## Goals / Non-Goals

**Goals:**
- 思考面板内容流式增长时自动滚动到底部，让用户感知实时思考过程
- 显示思考耗时和粗略 token 数，提供量化反馈
- 思考中/完成有明确的视觉状态区分（边框动画、标签切换）
- 正文开始生成后面板自动折叠，保持阅读区域整洁
- 初始等待阶段（无思考内容）有更好的过渡动画

**Non-Goals:**
- 不修改后端 Rust 代码
- 不添加精确 token 计数（需要 tokenizer，复杂度超出本次范围）
- 不改动 Thinking 以外的消息展示逻辑
- 不影响现有 scroll-to-bottom 行为和 flex 布局

## Decisions

### 1. 组件结构：保持内联在 MessageList.tsx 中

**选择**：不提取独立文件，仍在 `MessageList.tsx` 内部重构 styled-components 和子组件。

**理由**：ThinkingPanel 是 MessageBodyContent 的紧密耦合部分，共享 theme 和 animation keyframes，提取会导致 props 透传链变长。当前 MessageList.tsx 约 550 行，新增后仍可管理（预计 ~650 行）。

**备选**：提取为 `ThinkingPanel.tsx` 独立组件 → 放弃，因为需要透传 `status`、`thinkingContent`、`thinkingStartedAt`，接口设计收益不抵文件碎片化成本。

### 2. 启动时间标记：在 chatStore 中记录

**选择**：在 `Message` 类型新增 `thinkingStartedAt?: number` 字段，`appendThinkingToMessage` 首次写入思考内容时设置 `thinkingStartedAt = Date.now()`。

**理由**：时间标记属于消息级元数据，放在 Message 中最自然。首次 delta 到达时记录比消息创建时更准确——消息创建后到首个 thinking delta 之间有网络往返延迟。

**备选**：在组件内用 `useRef` 记录首 delta 时刻 → 放弃，组件可能因对话切换而重新挂载，ref 状态会丢失。在 store 中记录可跨渲染保持。

### 3. 动画方案：纯 CSS keyframes

**选择**：所有动画效果（边框流光、脉冲、光标闪烁）使用 CSS `@keyframes`，不引入 JS 动画库。

**理由**：
- 项目中已有 `keyframes` 用法（`pulse`），模式一致
- 不增加依赖
- CSS 动画由合成器线程处理，在流式渲染高频更新场景下性能更优

**边框流光实现**：使用 `border-image` + 移动 `background-position` 的渐变（而非伪元素），兼容性好且不需要绝对定位。

### 4. 自动滚动：useEffect + ref

**选择**：在 ThinkingPanel 子组件内用 `useRef<HTMLPreElement>` 引用 ThinkingBody，`useEffect` 监听 `thinkingContent` 变化后设置 `scrollTop = scrollHeight`。

**理由**：ThinkingBody 的滚动独立于外层 MessageList 滚动逻辑，不需要复用 DISENGAGE/REENGAGE 阈值。思考内容通常较短（几百字符），用户极少需要回看中间状态，简单自动滚到底部即可。

**注意**：不检测用户手动滚动——思考面板的 max-height 仅 260px，内容可见度高，不需要复杂的脱离/重新跟随逻辑。

### 5. 自动收起触发：content 首次非空

**选择**：当 `message.content` 从空字符串变为非空时，将面板的展开状态设为 `false`。之后用户手动展开/收起不受影响。

**理由**：正文开始输出 = 思考阶段结束，折叠面板可为正文腾出视野。使用 `useEffect` 监听 `content` 变化，仅触发一次（通过 `hasAutoCollapsed` ref 标记）。

**备选**：`status === 'complete'` 时折叠 → 放弃，streaming 期间正文已在输出但状态仍为 streaming，时机太晚。

### 6. Token 估算：字符数 × 0.25

**选择**：`Math.round(thinkingContent.length * 0.25)`，显示为 `~{N} tokens`。

**理由**：英文代码/文本大致 4 字符 ≈ 1 token，0.25 系数是业界通用粗略估算。`~` 前缀明确表示近似值，避免用户误解精度。

**备选**：引入 `tiktoken` 库精确计算 → 放弃，增加构建体积和复杂度，且思考内容不需要精确 token 计数。

### 7. 耗时格式化

| 时长 | 显示格式 | 示例 |
|------|---------|------|
| < 1s | `{N}ms` | `340ms` |
| 1s ~ 60s | `{N}.{1}s` | `2.3s` |
| > 60s | `{M}m{N}s` | `1m23s` |

使用 `useEffect` + `setInterval(100ms)` 驱动刷新。仅在 streaming 且 thinkingContent 存在时启动，停止时定格。

### 8. 光标闪烁

**选择**：在 ThinkingBody 末尾追加一个 `<BlinkingCursor />` 组件：`▌` 字符 + CSS `opacity` 脉冲动画（0.6s 周期，比 pulse 快）。

仅在 `status === 'streaming' && !message.content` 时渲染（即思考中、正文还没开始）。

## Risks / Trade-offs

- **[低] 高频状态更新**：`appendThinkingToMessage` 每次 delta 触发一次 zustand set，已是现有行为不变。新增的 duration timer（100ms 间隔）仅更新组件本地 state，不影响全局 store。
- **[低] 边框动画性能**：`border-image` 渐变动画可能在某些 GPU 上触发重绘。→ 使用 `will-change: border-image` 提示浏览器优化，同时 `@media (prefers-reduced-motion)` 关闭动画。
- **[低] i18n 覆盖**：当前仅更新 zh-CN，英文翻译后续补。
