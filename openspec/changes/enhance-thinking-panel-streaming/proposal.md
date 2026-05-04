## Why

当前 Thinking Panel 的显示过于粗糙：思考内容是纯 `<pre>` 文本无流式滚动感，三个阶段（等待首 token、思考流式输出、思考完成）之间缺少视觉区分，没有耗时和 token 估算等反馈信息。这导致用户无法感知模型的实时思考进度，体验与 Claude Code CLI 的 loading 显示差距明显。本次优化旨在仅通过前端改动，让思考过程的展示更有"活"的感觉。

## What Changes

- Thinking Panel 新增实时滚动：思考内容流式增长时自动滚动到底部，让用户看到模型"正在思考"
- 新增思考耗时计数器：首个 thinking delta 到达时开始计时，停止后定格显示总耗时
- 新增 token 估算显示：基于字符数粗略估算（`~` 表示近似），展示在面板 header 中
- 新增渐变动画边框：思考进行中面板边框带有流光动画效果，完成后自动消失
- 新增光标闪烁：思考内容末尾渲染闪烁光标动画，仅在 streaming 且未开始正文时显示
- 新增自动收起行为：正文开始生成后面板自动折叠，用户可手动展开回溯
- 状态标签切换：summary 从 "● 正在思考..." 变为 "✓ 思考完成"
- 初始等待状态优化：首 token 到达前的加载提示替换为更细腻的流光条动画

## Capabilities

### New Capabilities

- `thinking-panel-streaming`: Enhanced Thinking Panel with live streaming UX including auto-scroll, duration counter, token estimate, animated border, blinking cursor, and auto-collapse behavior

### Modified Capabilities

无现有 capability 的需求变更。

## Impact

- `src/types/index.ts` — Message 类型新增 `thinkingStartedAt` 可选字段
- `src/stores/chatStore.ts` — `appendThinkingToMessage` 方法增加首 delta 时间标记
- `src/components/Chat/MessageList.tsx` — 重写 ThinkingPanel 相关 styled-components 和 MessageBodyContent 渲染逻辑
- `src/i18n/zh-CN.ts` — 新增思考状态相关文案
