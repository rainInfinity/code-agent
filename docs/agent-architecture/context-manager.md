# Context Manager — 上下文管理

> 返回 [总览](./agent-architecture-design.md) | 上一模块：[Prompt System](./prompt-system.md) | 下一模块：[Prompt Cache](./prompt-cache.md)

---

## 概述

Context Manager 负责管理 LLM 的上下文窗口。随着 Agent 循环进行，对话历史、工具调用和结果不断增长，需要在不超过模型上下文限制的前提下，尽可能保留关键信息。

## 核心职责

1. **Token 计数** — 精确计算每条消息的 token 数量
2. **预算管理** — 跟踪上下文窗口的剩余空间
3. **智能裁剪** — 当超出预算时，决定哪些内容保留、压缩或丢弃
4. **关键信息保留** — 确保错误信息、重要决策不被裁剪

## 架构

```
┌───────────────────────────────────────────────┐
│              Context Manager                    │
│                                                 │
│  ┌──────────────┐   ┌───────────────────────┐  │
│  │   Token       │   │   Window Policy       │  │
│  │   Counter     │   │                       │  │
│  │  (tiktoken)  │   │  budget: 180K tokens  │  │
│  └──────────────┘   │  reserve: 4K  output  │  │
│                      └───────────────────────┘  │
│                                                 │
│  ┌──────────────────────────────────────────┐  │
│  │           消息优先级策略                   │  │
│  │                                           │  │
│  │  Layer 0: System Prompt     [永驻]        │  │
│  │  Layer 1: Tool Definitions  [永驻]        │  │
│  │  Layer 2: Recent Messages   [优先保留]    │  │
│  │  Layer 3: Older Messages    [可裁剪/摘要] │  │
│  │  Layer 4: Old Tool Results  [优先丢弃]    │  │
│  └──────────────────────────────────────────┘  │
└───────────────────────────────────────────────┘
```

## 核心数据结构

```rust
/// 上下文窗口管理器
struct ContextManager {
    /// Token 计数器
    token_counter: TokenCounter,
    /// 总 token 预算（根据模型动态设置）
    budget: usize,
    /// 预留给模型输出的空间
    reserve_for_output: usize,
}

/// 裁剪后的上下文窗口
struct WindowedContext {
    /// 系统提示块（始终保留）
    system_blocks: Vec<ContentBlock>,
    /// 工具定义
    tool_definitions: Vec<ToolDefinition>,
    /// 裁剪后的消息列表
    messages: Vec<ContentBlock>,
    /// 当前使用的 token 数
    token_count: usize,
    /// 剩余可用 token
    remaining: usize,
}

/// Token 计数策略
enum TokenCountStrategy {
    /// 使用 tiktoken-rs 精确计数
    Tiktoken,
    /// 基于字符数的粗略估算（×0.25 = token 数，中文 ×0.6）
    Estimate,
}
```

## Token 计数

### 实现方案

```rust
struct TokenCounter {
    strategy: TokenCountStrategy,
}

impl TokenCounter {
    /// 计算单个 ContentBlock 的 token 数
    fn count_block(&self, block: &ContentBlock) -> usize {
        match &block.content {
            ContentBlockType::Text(text) => self.count_text(text),
            ContentBlockType::ToolUse(tool_use) => {
                // 工具调用的 JSON 序列化的 token 数
                let json = serde_json::to_string(tool_use).unwrap_or_default();
                self.count_text(&json)
            }
            ContentBlockType::ToolResult(tool_result) => {
                self.count_text(&tool_result.content)
            }
        }
    }

    /// 计算文本的 token 数
    fn count_text(&self, text: &str) -> usize {
        match self.strategy {
            TokenCountStrategy::Tiktoken => {
                // 使用 tiktoken-rs 精确计数
                // bpe.encode_ordinary(text).len()
                text.len() / 4 // 占位，实际使用 tiktoken-rs
            }
            TokenCountStrategy::Estimate => {
                // 中文字符 ≈ 1.5 token，英文 ≈ 0.25 token
                let chinese_chars = text.chars().filter(|c| is_chinese(*c)).count();
                let other_chars = text.chars().count() - chinese_chars;
                (chinese_chars as f64 * 0.6 + other_chars as f64 * 0.25) as usize
            }
        }
    }
}
```

### 模型默认预算

| 模型 | 上下文窗口 | 默认 Budget | 预留 Output |
|------|-----------|------------|-------------|
| Claude Sonnet 4.6 | 200K | 180K | 20K |
| Claude Haiku 4.5 | 200K | 180K | 20K |
| Claude Opus 4.7 | 200K | 180K | 20K |
| GPT-4.1 | 128K | 112K | 16K |
| DeepSeek Chat | 128K | 112K | 16K |

## 裁剪策略

### 优先级规则

```rust
impl ContextManager {
    /// 根据预算裁剪消息列表
    fn fit(
        &self,
        messages: &[ContentBlock],
        system_blocks: &[ContentBlock],
        tool_definitions: &[ToolDefinition],
    ) -> WindowedContext {
        // 1. 计算固定消耗（永远保留）
        let fixed_tokens = self.count_fixed(system_blocks, tool_definitions);
        let available = self.budget.saturating_sub(fixed_tokens + self.reserve_for_output);

        let mut kept = Vec::new();
        let mut used = 0;

        // 2. 从最新到最旧遍历消息
        for msg in messages.iter().rev() {
            let tokens = self.token_counter.count_block(msg);

            if used + tokens <= available {
                // 预算内 → 直接保留
                kept.push(msg.clone());
                used += tokens;
            } else if self.is_summarizable(msg) {
                // 可摘要 → 用摘要替代
                if let Some(summary) = self.summarize_block(msg) {
                    let summary_tokens = self.token_counter.count_block(&summary);
                    if used + summary_tokens <= available {
                        kept.push(summary);
                        used += summary_tokens;
                    }
                }
                break; // 放弃更旧的消息
            } else {
                break; // 不可摘要 → 放弃它和更旧的消息
            }
        }

        kept.reverse();
        WindowedContext {
            system_blocks: system_blocks.to_vec(),
            tool_definitions: tool_definitions.to_vec(),
            messages: kept,
            token_count: used + fixed_tokens,
            remaining: self.budget - (used + fixed_tokens),
        }
    }
}
```

### 裁剪优先级矩阵

| 消息类型 | 优先级 | 可摘性 | 说明 |
|---------|--------|--------|------|
| 当前轮 User 消息 | 最高 | 否 | 当前任务不能丢 |
| 当前轮 Assistant (含 tool_calls) | 最高 | 否 | 完整保留 |
| 当前轮 Tool Results | 高 | 截断 | 超长输出截断而非删除 |
| 上一轮 User+Assistant | 中 | 是 | 可用摘要替代 |
| 更早轮次 | 低 | 是 | 优先裁剪 |
| Error 结果 | 高 | 否 | 错误信息必须保留 |

### 工具输出截断

```rust
/// 工具输出截断策略
const MAX_TOOL_OUTPUT_CHARS: usize = 8_000;  // 单次工具输出最大字符
const MAX_TOOL_OUTPUT_TOKENS: usize = 2_000; // 单次工具输出最大 token

fn truncate_tool_output(output: &str) -> String {
    if output.len() <= MAX_TOOL_OUTPUT_CHARS {
        return output.to_string();
    }

    let head = &output[..MAX_TOOL_OUTPUT_CHARS / 2];
    let tail = &output[output.len() - MAX_TOOL_OUTPUT_CHARS / 2..];

    format!(
        "{}\n\n... [{} 字符被截断] ...\n\n{}",
        head,
        output.len() - MAX_TOOL_OUTPUT_CHARS,
        tail
    )
}
```

## 摘要压缩

当旧消息需要让出空间时，用 LLM 生成摘要代替原文：

```rust
impl ContextManager {
    /// 对旧的用户-Assistant 轮次生成摘要
    async fn summarize_turn(
        &self,
        user_msg: &ContentBlock,
        assistant_msg: &ContentBlock,
        tool_results: &[ContentBlock],
    ) -> Option<ContentBlock> {
        let summary_prompt = format!(
            "将以下对话轮次压缩为一句话摘要，保留关键信息（文件路径、函数名、决策等）：\n\n用户: {}\n助手: {}",
            user_msg.text(),
            assistant_msg.text()
        );

        // 调用轻量模型做摘要（如 Haiku）
        let summary = self.summary_llm.chat(&summary_prompt).await.ok()?;

        Some(ContentBlock::text(format!("[上轮摘要] {}", summary)))
    }
}
```

## 与 Agent Runtime 的交互

```
AgentRuntime::agent_loop()
    │
    ├─ 每轮循环开始:
    │   context_manager.fit(messages) → WindowedContext
    │   prompt_engine.build(..., windowed_context.messages)
    │
    ├─ 每次工具执行后:
    │   context_manager.truncate_tool_output(result)
    │
    └─ 每轮循环结束:
        context_manager.report() → TokenUsage 统计
```

## 监控指标

```rust
struct ContextMetrics {
    /// 当前 token 使用量
    current_tokens: usize,
    /// 预算使用率
    budget_usage_pct: f64,
    /// 裁剪的轮次数
    truncated_turns: usize,
    /// 摘要生成的轮次数
    summarized_turns: usize,
    /// 工具输出被截断的次数
    truncated_outputs: usize,
}
```

前端 StatusBar 展示 `🟢 45K/180K tokens (25%)` 实时状态。

---

> 上一模块：[Prompt System](./prompt-system.md) | 下一模块：[Prompt Cache](./prompt-cache.md)
> 返回 [总览](./agent-architecture-design.md)
