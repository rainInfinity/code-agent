## 1. Chat Scroll Follow

- [ ] 1.1 更新 `MessageList` 的发送后滚动触发逻辑，确保用户消息追加后即使 assistant streaming placeholder 紧随其后也立即滚动到底部。
- [ ] 1.2 为聊天滚动容器增加内容容器和滚动容器 resize 监听，覆盖内容增长、窗口高度变化和从无滚动条到有滚动条的情况。
- [ ] 1.3 实现流式生成期间的持续贴底循环，仅在 auto-follow 开启且用户未主动滚动时执行。
- [ ] 1.4 区分程序化 scroll 和用户滚动意图，确保 wheel、touch、键盘滚动和滚动条拖动可暂停 auto-follow。

## 2. Trace Scroll Follow

- [ ] 2.1 为 Trace turn 列表增加 auto-follow 状态、近底部判断、滚动容器和内容容器 resize 监听。
- [ ] 2.2 在 Trace running 期间实现持续贴底循环，保证 Trace 内容高度增长和窗口 resize 时最新输出保持可见。
- [ ] 2.3 确保用户主动滚动 Trace 历史时可暂停跟随，且点击 Trace 内部折叠/复制等控件不会误判为滚动意图。

## 3. Trace Turn Expansion Modes

- [ ] 3.1 将 `TurnCard` 展开状态提升到 `TracePanel` 管理，并通过 props 控制每个 turn 的展开/收起。
- [ ] 3.2 实现“全部打开/全部收起”单按钮状态开关，根据当前 turn 展开状态切换全部展开或全部收起。
- [ ] 3.3 实现“跟随最新”开关：开启时只展开最新 turn，后续新 turn 到来时继续只展开最新并保持滚动跟随。
- [ ] 3.4 用户手动展开或收起某个 turn 时退出“跟随最新”模式，并保留用户指定的展开状态。

## 4. Trace Window Controls

- [ ] 4.1 合并 Trace “切换对话时保持打开”和“置顶”按钮为单个图钉开关，同时同步 pin 状态和 always-on-top 状态。
- [ ] 4.2 为新增/调整后的 Trace 图标按钮提供中文可访问标签、`aria-pressed`、禁用态和主题一致的激活态。
- [ ] 4.3 移除不再需要的独立置顶按钮和重复控制逻辑。

## 5. Verification

- [ ] 5.1 使用 `npm run build` 验证 TypeScript 和 Vite 构建通过。
- [ ] 5.2 手动验证聊天窗口：发送消息后立即到底部，流式输出和窗口高度变化时保持贴底，用户主动滚动后不被拉回。
- [ ] 5.3 手动验证 Trace 窗口：运行中内容增长保持贴底，全部打开/收起开关、跟随最新开关、合并图钉开关行为符合规格。
