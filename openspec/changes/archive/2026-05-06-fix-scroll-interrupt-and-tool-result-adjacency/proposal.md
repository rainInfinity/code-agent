## Why

当前聊天主窗口有两个影响连续使用的回归问题。其一，用户点击“滚动到最新消息”后，如果在短时间内主动上滑，界面仍会再次自动贴底，违背了“用户手动滚动即可打破跟随”的交互预期。其二，Tool 调用失败后，后续发送给模型的 transcript 可能破坏 `tool_use` 与紧随其后的 `tool_result` 邻接关系，导致 Anthropic/DeepSeek 返回 400 请求错误。

这两个问题都发生在最近对内容块顺序与流式渲染行为的调整之后，已经直接影响聊天可用性与多轮工具调用稳定性，因此需要尽快收敛为一个修复变更并补齐回归保护。

## What Changes

- 修正聊天列表在“滚动到最新消息”按钮触发的平滑滚动期间，对用户主动滚动打断意图的处理。
- 调整自动跟随、平滑滚动保护期、流式贴底循环之间的状态优先级，确保用户手动滚动能立即终止自动跟随。
- 修正构建 provider transcript 时 assistant `tool_use`、assistant 文本、user `tool_result` 的输出顺序，保证工具失败与成功场景都满足 provider 的消息邻接约束。
- 为工具失败后的 transcript 构建和滚动打断场景补充前后端测试，防止内容块展示顺序与 provider 请求顺序再次耦合。

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `chat-auto-scroll`: 调整自动跟随恢复与中断规则，要求用户在按钮触发的平滑滚动期间也能立即打破跟随滚动。
- `prompt-engine`: 调整发送给 provider 的消息规范，要求 assistant `tool_use` 后紧邻的下一条 user 消息包含对应 `tool_result`，不得被 assistant 文本打断。

## Impact

- 前端聊天滚动逻辑：`src/components/Chat/MessageList.tsx` 及其测试。
- transcript 构建逻辑：`src/utils/turns.ts` 与相关测试。
- Rust prompt / agent 循环联动验证：`src-tauri/src/agent/session.rs`、`src-tauri/src/prompt/engine.rs`、provider 请求相关测试。
- OpenSpec 规格与任务：`openspec/specs/chat-auto-scroll`、`openspec/specs/prompt-engine`。
