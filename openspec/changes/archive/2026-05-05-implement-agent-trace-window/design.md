## Context

当前项目是单窗口 Tauri 应用（[App.tsx](../../../src/App.tsx) 渲染 ChatPanel + Sidebar + StatusBar）。需要新增第二个独立窗口来展示 Agent Trace。

两个窗口关系：
```
┌─ 主窗口 (main) ────────────┐  ┌─ Trace 窗口 (trace) ────────┐
│ Sidebar │ Chat             │  │ 📊 Agent Trace             │
│         │                  │  │                            │
│         │ Messages         │  │ ▼ Turn 1 📤 Prompt         │
│         │                  │  │    📥 Thinking             │
│         │ Input            │  │    📥 Response             │
│         │                  │  │ ▶ Turn 2 (running)         │
│ StatusBar [🔍 Trace]       │  │                            │
└────────────────────────────┘  └────────────────────────────┘
```

数据源：两个窗口共享同一个 Rust 后端，都可通过 `listen()` 接收 Tauri 事件。Trace 窗口监听的事件包括：
- `agent-turn` — 新的轮次开始
- `thinking-delta` — thinking 内容流
- `stream-delta` — 响应内容流
- `trace-prompt` — 每轮完整 prompt（提案 1 新增）
- `agent-complete` — Agent 结束

## Goals / Non-Goals

**Goals:**
- 创建独立的 Tauri 窗口，紧贴主窗口右侧
- Trace 窗口实时展示 Agent 工作流程：Prompt → Thinking → Response 三个阶段
- 每轮数据以可展开卡片形式展示
- 窗口跟随主窗口移动（用户也可手动分离）
- Trace 开启状态跟随 conversation 持久化
- 关闭 trace 时不收集数据，重新打开为空

**Non-Goals:**
- 不展示工具调用/结果（tool 系统不完善，后续补齐）
- 不做 Token 精确计数（用字符数估算）
- 不做 Context 窗口可视化（后续提案）
- 不支持多个 Trace 窗口同时打开
- 不修改 Rust agent_loop 核心逻辑（仅在 thinking 阶段前后加事件标记）

## Decisions

### 1. 多窗口架构：同一 SPA、query param 路由

**选择**：Trace 窗口加载相同的 `index.html?window=trace`，在 `main.tsx` 中根据 URL 参数渲染不同根组件。

```typescript
// main.tsx
const params = new URLSearchParams(window.location.search);
if (params.get('window') === 'trace') {
  root.render(<TraceApp />);
} else {
  root.render(<App />);
}
```

**理由**：
- 不需要 Vite 多页配置，单入口保持不变
- 共享同一个 React/theme/styled-components 环境
- Zustand store 天然隔离（不同窗口各自独立内存）
- Tauri 事件在两个窗口中都可以独立 listen

**备选**：Vite 多页应用（`trace.html` 单独入口）→ 放弃，增加构建复杂度，收益不抵成本。

### 2. 窗口创建：Rust 端命令

**选择**：通过 Rust `open_trace_window` 命令创建窗口，计算主窗口右侧位置。

```rust
#[tauri::command]
fn open_trace_window(app: AppHandle) -> Result<(), String> {
    let main = app.get_webview_window("main").ok_or("main window not found")?;
    let main_pos = main.outer_position()?;
    let main_size = main.outer_size()?;

    let trace_width = 420.0;
    let trace_height = main_size.height as f64;
    let trace_x = (main_pos.x + main_size.width as i32) as f64;
    let trace_y = main_pos.y as f64;

    let trace = WebviewWindowBuilder::new(
        &app,
        "trace",
        WebviewUrl::App("index.html?window=trace".into()),
    )
    .title("Agent Trace")
    .inner_size(trace_width, trace_height)
    .position(trace_x, trace_y)
    .resizable(true)
    .min_inner_size(320.0, 400.0)
    .decorations(true)  // Trace 窗口带系统标题栏
    .visible(true)
    .build()?;

    Ok(())
}
```

**理由**：
- 命令方式让前端可以随时打开/关闭
- 位置计算基于主窗口实际位置，自动跟随
- `decorations: true` 让 trace 窗口有独立标题栏，用户可手动拖动分离

### 3. 窗口跟随：监听主窗口 Moved 事件

**选择**：在 `lib.rs` 中为主窗口注册 `Moved` 事件，同步更新 trace 窗口位置。

```rust
// 仅在 trace 窗口可见时同步位置
window.on_window_event(move |event| {
    if let WindowEvent::Moved(position) = event {
        if let Some(trace) = app.get_webview_window("trace") {
            if trace.is_visible().unwrap_or(false) {
                let size = window.outer_size().unwrap();
                let _ = trace.set_position(PhysicalPosition::new(
                    position.x + size.width as i32,
                    position.y,
                ));
            }
        }
    }
});
```

**理由**：
- 主窗口移动时 trace 窗口"吸附"在右侧
- 用户手动拖动 trace 窗口后，位置同步暂时中断（可通过 "重新吸附" 按钮恢复，或持续跟随）
- 简单实现：持续跟随。用户若拖动 trace 到别处，下次主窗口移动时 trace 会跳回右侧

**关于用户提及的"可单独摆放"**：trace 窗口有独立标题栏，用户可拖到任何位置。主窗口移动时会重新吸附到右侧——这是折中方案。如需完全独立的"分离模式"，后续可加"锁定跟随/解除跟随"按钮。

### 4. Trace 数据模型

```typescript
// traceStore.ts
interface TurnTrace {
  turnNumber: number;
  startTime: number;
  endTime?: number;
  status: 'running' | 'complete' | 'error';

  // Prompt 阶段
  prompt?: {
    systemPrompt: string;
    messages: ChatMessage[];
    tools: ToolDefinition[];
  };

  // Thinking 阶段
  thinking: {
    content: string;
    startTime?: number;
    endTime?: number;
  };

  // Response 阶段
  response: {
    content: string;
    startTime?: number;
    endTime?: number;
  };
}

interface ConversationTrace {
  conversationId: string;
  turns: TurnTrace[];
}
```

**理由**：
- 每个 turn 分为 Prompt / Thinking / Response 三个阶段
- 当前不做 Tool 阶段（工具系统不成熟）
- 时间戳用于显示阶段耗时

### 5. Trace 生命周期管理

**选择**：trace 开启状态存储在 `Conversation` 上，与对话数据一起持久化。

```typescript
// types/index.ts
interface Conversation {
  // ... 现有字段
  traceEnabled?: boolean;  // 该对话是否开启 trace
}
```

规则：
1. 用户在对话中点击"打开 Trace"→ `traceEnabled = true`，创建 trace 窗口，开始收集事件
2. 切换对话 → 如果新对话 `traceEnabled`，重新打开 trace 窗口；否则关闭
3. 关闭 trace 窗口 → `traceEnabled = false`，清空该对话的 trace 数据
4. 对话未开启 trace → `useAgent` 中不在 traceStore 写数据（节省内存）
5. 重新打开已关闭 trace 的对话的 trace → 之前关闭期间的数据已丢失，从当前时刻开始累计

**理由**：避免为所有对话无差别收集 trace 数据。用户只为感兴趣的对话开启 trace。

### 6. 前端组件树

```
TraceApp
└── ThemeProvider（复用主题）
    └── TracePanel
        ├── TraceStatusBar     # 顶部状态行
        │   ├── AgentStatus    # idle / running / complete
        │   ├── TurnCount      # Turn N/30
        │   └── ElapsedTime    # 当前轮耗时计时器
        │
        └── TurnList           # 轮次列表（可滚动）
            └── TurnCard[]     # 每个 turn 的可展开卡片
                ├── TurnHeader # Turn N — status icon + 耗时
                ├── PromptView # 📤 Prompt
                │   ├── SystemPromptBlock（可展开）
                │   └── MessageBlock[]（user/assistant 角色标签）
                ├── ThinkingView # 📥 Thinking（可展开）
                └── ResponseView # 📥 Response（可展开）
```

### 7. CSS-in-JS 风格

**选择**：复用项目现有的 styled-components + theme，不引入新的样式方案。

**理由**：Trace 窗口加载同一个 React 应用上下文，ThemeProvider 和 GlobalStyle 都可用。Trace 窗口有独立 theme（跟随主窗口的 dark/light 设置，通过 IPC 或 store 同步）。

### 8. 主题同步

**选择**：Trace 窗口监听 `theme-changed` 事件（或在设置变更时由主窗口通过 IPC 通知）。

**简化方案**：在 `settingsStore` 中，设置变更后 emit 一个事件供 trace 窗口监听。或者 trace 窗口启动时从 localStorage 读取当前主题。

由于 Zustand store 在两个窗口中独立，需要显式同步。最简单的方式是 trace 窗口也读取 localStorage 中的 `code-agent-chat-history`（主题设置存在另一个 key 中）。需要检查 settingsStore 的 persist key。

## Risks / Trade-offs

- **[中] 高频事件压力**：每轮有多个 `thinking-delta` + `stream-delta` 事件。→ Trace 窗口只做数据累积和渲染，计算量小。每个 delta 只是一次字符串拼接 + zustand set。
- **[低] 窗口管理器兼容性**：Windows/macOS/Linux 的窗口行为差异。→ Tauri 封装了跨平台差异，`set_position` 和窗口事件在各平台表现一致。
- **[低] 主窗口注销/恢复时 trace 窗口状态**：主窗口最小化时 trace 仍可见。→ 可接受的行为，用户可能想独立查看 trace。
- **[低] 对话切换时的 trace 数据刷新**：切换对话需清空并重建 trace 数据。→ `traceStore.reset(conversationId)` 处理，简单覆盖。
