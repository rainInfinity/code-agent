## 1. Data Layer

- [x] 1.1 在 `Message` 类型中新增 `thinkingStartedAt?: number` 可选字段
- [x] 1.2 修改 `chatStore.appendThinkingToMessage`：首 delta 到达时写入 `thinkingStartedAt: Date.now()`

## 2. Internationalization

- [x] 2.1 在 `zh-CN.ts` 的 `messages` 模块中新增 thinking 相关文案：`thinkingInProgress`（正在思考...）、`thinkingComplete`（思考完成）、`tokens`（tokens）、`durationMs`/`durationS`/`durationMS` 格式化函数

## 3. Styled Components & Animations

- [x] 3.1 新增 `shimmer` keyframes：渐变色从左到右流动动画（用于边框和等待条）
- [x] 3.2 新增 `blink` keyframes：快速透明度闪烁（用于光标，0.6s 周期）
- [x] 3.3 重写 `ThinkingPanelShell`：移除 `<details>` 基础，改为自定义可折叠面板，支持 `$isThinking` prop 控制渐变动画边框
- [x] 3.4 新增 `ThinkingPanelHeader` styled-component：整合脉冲点/对勾 + 状态文案 + 耗时 + token 估算
- [x] 3.5 重写 `ThinkingBody`：增加 `ref` 转发支持，保持 `pre` 语义
- [x] 3.6 新增 `BlinkingCursor` styled-component：闪烁光标 `▌`
- [x] 3.7 重写 `ThinkingIndicator`：替换三圆点为流光条 + "正在思考..." 文案
- [x] 3.8 确保所有新动画在 `@media (prefers-reduced-motion)` 时降级为静态

## 4. ThinkingPanel Component Logic

- [x] 4.1 创建 `ThinkingPanel` 内部子组件：管理展开/折叠状态、auto-scroll、duration 计时器
- [x] 4.2 实现 auto-scroll 逻辑：`useRef` + `useEffect` 监听 `thinkingContent` 变化滚动到底部
- [x] 4.3 实现 duration 计时器：`useEffect` + `setInterval(100ms)`，根据 `thinkingStartedAt` 计算
- [x] 4.4 实现自动收起：`useEffect` 监听 `content` 从空变非空时折叠，用 `hasAutoCollapsed` ref 防止重复触发
- [x] 4.5 实现 token 估算显示：`Math.round(content.length * 0.25)`，`~` 前缀

## 5. Integration

- [x] 5.1 在 `MessageBodyContent` 中用新的 `ThinkingPanel` 替换旧 `<details>` 实现
- [x] 5.2 更新 `ThinkingIndicator` 渲染条件：匹配新组件逻辑

## 6. Verification

- [x] 6.1 验证深色/浅色主题下的动画边框和文本对比度
- [x] 6.2 验证 `prefers-reduced-motion` 时动画降级为静态
- [x] 6.3 验证自动折叠后用户可手动展开并保持展开状态
- [x] 6.4 验证切换对话时 duration 计时器正确重置
