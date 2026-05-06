# prompt-engine Delta Spec

## ADDED Requirements

### Requirement: Provider-compatible transcript shall preserve tool adjacency across turns

系统在构建 provider 请求历史时 SHALL 保留合法的 `assistant(tool_use) -> user(tool_result)` 邻接关系，即使主窗口将多个 turn 投影到单条 assistant 回复中展示。

#### Scenario: Continue conversation after one tool turn

- **GIVEN** 上一轮 assistant 回复中包含一个 tool turn，并且工具结果已返回
- **WHEN** 用户继续发起下一轮对话
- **THEN** provider history SHALL 包含带有 `tool_use` 的 assistant transcript entry
- **AND** 紧随其后 SHALL 包含对应 `tool_result` blocks 的 user transcript entry

#### Scenario: Continue conversation after multiple tool turns

- **GIVEN** 上一轮 assistant 回复中连续经历多个 turns，且至少两个 turns 包含工具调用
- **WHEN** 系统构建 provider history
- **THEN** 每个 tool turn 的 `tool_use` 和 `tool_result` SHALL 保持各自合法邻接
- **AND** 后续 turn 的文本或 thinking SHALL NOT 插入到前一个 tool turn 的 `tool_use` 和 `tool_result` 之间

### Requirement: Prompt sanitization shall not drop required tool_result blocks from canonical transcript

任何 prompt sanitization 或 UI filtering 逻辑 SHALL 只作用于渲染投影层，不得删除 canonical transcript 中为 provider 协议所必需的 `tool_result` blocks。

#### Scenario: Main-window filtering differs from provider history

- **GIVEN** 主窗口选择隐藏或折叠某些可视 blocks
- **WHEN** 系统构建 provider history
- **THEN** sanitization SHALL 以 canonical transcript 的协议正确性为准
- **AND** SHALL NOT 因为 assistant UI blocks 的过滤规则而遗漏必需的 `tool_result`
