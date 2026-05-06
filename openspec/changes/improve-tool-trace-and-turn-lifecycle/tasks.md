## 1. Event Model

- [x] 1.1 为工具调用定义统一的结构化追踪事件和前后端共享类型。
- [x] 1.2 为 Turn 增加显式收口事件，覆盖继续下一轮、正常完成、取消、报错和达到最大轮次等退出路径。
- [x] 1.3 在工具执行器与 Agent runtime 中补齐 requested/running/completed/failed 的工具追踪发射逻辑。

## 2. Shared State

- [x] 2.1 把 Turn/Tool 追踪写入逻辑收敛到共享 conversation store，减少主窗口与 Trace 窗口的重复状态机。
- [x] 2.2 调整前端事件监听逻辑，确保 thinking/response flush 与 turn close 的顺序稳定。
- [x] 2.3 保持旧 `tool-call` / `tool-result` 字段在迁移期可用，并为新模型提供兼容映射。

## 3. Trace Window

- [x] 3.1 在 Trace TurnCard 中增加 Tool section，展示工具参数、状态变化、输出和错误。
- [x] 3.2 修复 Trace Turn 状态长期停留在“运行中”的问题，确保每一轮都能正确收口。
- [x] 3.3 重写 PromptView 的消息渲染策略，使其优先展示 `contentBlocks`，避免空的 `user` / `assistant` 条目。

## 4. Main Chat

- [x] 4.1 在主窗口 assistant 消息中实现紧凑的工具调用过程块，呈现类似 Claude Code 的工具过程视图。
- [x] 4.2 确保工具过程块与 thinking、markdown 正文和现有消息滚动行为正确共存。

## 5. Verification

- [x] 5.1 为多轮工具调用场景添加测试，验证前几轮不会错误停留在 running 状态。
- [x] 5.2 为工具失败、参数校验失败和并发工具批次添加测试，验证工具追踪状态和顺序正确。
- [x] 5.3 为 `contentBlocks`-only Prompt 消息添加测试，验证 Trace Prompt 不再出现空白条目。
