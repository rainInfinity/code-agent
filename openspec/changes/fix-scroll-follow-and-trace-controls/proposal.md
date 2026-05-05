## Why

聊天和 Trace 窗口在 AI 流式输出、内容高度增长或窗口尺寸变化时，滚动条没有稳定保持在最新内容位置，导致用户明明在底部却被新内容“挤上去”。同时 Trace 窗口的控制按钮分散且状态语义不清，需要把常用查看模式做成明确的开关，降低排查长链路输出时的操作成本。

## What Changes

- 修复主聊天列表的自动跟随逻辑：用户发送消息后立即滚动到最新消息；处于底部或近底部时，流式输出和内容高度增长期间持续贴底；用户主动滚动离开时暂停跟随。
- 修复 Trace 窗口自动跟随逻辑：Trace 内容增长、窗口高度变化、新 turn 到来时，在跟随状态下保持滚动到底部。
- 为 Trace 窗口新增“全部打开/全部收起”状态开关，单个按钮根据当前展开状态切换所有 turn。
- 为 Trace 窗口新增“跟随最新”状态开关：开启时只展开最新 turn，收起历史 turn，后续新 turn 到来时继续只展开最新并保持滚动跟随；再次点击关闭该模式。
- 合并 Trace 窗口“切换对话时保持打开”和“置顶”控制为一个状态按钮，点击时同时开启或关闭两项窗口行为。
- 保持所有新增按钮为图标按钮，并具备可访问标签、激活态、禁用态和主题适配。

## Capabilities

### New Capabilities
- `trace-window-controls`: 约束 Trace 窗口的滚动跟随、turn 展开模式、跟随最新模式，以及合并后的窗口保持/置顶控制。

### Modified Capabilities
- `chat-scroll-window`: 强化聊天列表在用户发送消息、流式输出、内容高度增长和滚动容器尺寸变化时的贴底跟随要求。

## Impact

- 影响前端组件：`src/components/Chat/MessageList.tsx`、`src/components/Trace/TracePanel.tsx`、`src/components/Trace/TurnCard.tsx`。
- 影响状态交互：Trace turn 展开状态从单个 `TurnCard` 内部状态提升到 `TracePanel` 统一管理。
- 影响窗口行为：Trace “保持打开”和“置顶”使用同一控制入口，同时同步 trace pin 状态和 Tauri always-on-top 状态。
- 不引入新的后端 API、存储格式或第三方依赖。
