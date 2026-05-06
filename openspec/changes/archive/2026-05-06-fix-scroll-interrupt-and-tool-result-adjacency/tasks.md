## 1. Scroll interrupt handling

- [x] 1.1 在 `src/components/Chat/MessageList.tsx` 中拆分“程序化平滑滚动”和“用户主动滚动”状态，确保用户输入能立即取消按钮触发的平滑滚动保护期
- [x] 1.2 调整自动跟随更新逻辑与流式贴底循环，确保用户打断后不会因后续 token、resize 或补滚逻辑再次被拉回底部
- [x] 1.3 为“点击滚动到最新消息后立即上滑”的场景补充前端测试

## 2. Provider transcript ordering

- [x] 2.1 调整 `src/utils/turns.ts` 的 transcript 组装逻辑，保证 `tool_use` 后紧邻的下一条 user 消息承载对应 `tool_result`
- [x] 2.2 为工具成功和失败两种场景补充 transcript 测试，验证 assistant 文本不会插入 `tool_use` 与 `tool_result` 之间
- [x] 2.3 检查并补充 Rust/provider 相关测试，确保 provider 请求继续按 `content blocks` 原样序列化且满足新的 transcript 约束

## 3. Verification

- [x] 3.1 运行与滚动、消息渲染、turn transcript 相关的前端测试
- [x] 3.2 运行与 prompt/provider 相关的 Rust 测试
- [x] 3.3 手动验证失败 Tool 调用后不会再出现 `tool_use ids were found without tool_result blocks immediately after` 的 400 错误
