# Prompt Cache — Prompt 缓存

> 返回 [总览](./agent-architecture-design.md) | 上一模块：[Context Manager](./context-manager.md) | 下一模块：[Tool System](./tool-system.md)

---

## 概述

Prompt Cache 利用 Anthropic 的 Prompt Caching API，将不会频繁变化的内容（System Prompt、Tool Definitions）标记为可缓存。缓存命中时，这些 token 的读取成本降低 90%，延迟也显著减少。

> 注意：Prompt Cache 目前是 Anthropic API 的专有特性。OpenAI 的 Automatic Prompt Caching 无需客户端处理，DeepSeek 暂不支持。

## 缓存原理

```
┌─────────────────────────────────────────────────────────┐
│               Prompt 结构                                │
│                                                          │
│  ┌──────────────────────────────────────┐               │
│  │  System Prompt Block                 │ ← cache_point │
│  │  (角色描述 + 行为准则 + 运行环境)      │   1           │
│  │  最小 1024 tokens                    │               │
│  └──────────────────────────────────────┘               │
│  ┌──────────────────────────────────────┐               │
│  │  Tool Definitions Block              │ ← cache_point │
│  │  (所有工具的 JSON Schema)             │   2           │
│  │  最小 1024 tokens                    │               │
│  └──────────────────────────────────────┘               │
│  ┌──────────────────────────────────────┐               │
│  │  Conversation History                │  NO CACHE     │
│  │  (动态变化，每次请求不同)             │  (每次都新)   │
│  └──────────────────────────────────────┘               │
│                                                          │
│  最多 4 个 cache_control 断点                              │
│  每个缓存块必须 ≥ 1024 tokens                              │
│  缓存 TTL: 5 分钟（每次命中刷新）                           │
└─────────────────────────────────────────────────────────┘
```

## 核心数据结构

```rust
/// Prompt Cache 管理器
struct PromptCacheManager {
    /// 已缓存的块标识 → 创建时间
    cached_blocks: HashMap<String, Instant>,
    /// 缓存 TTL（Anthropic 固定 5 分钟）
    ttl: Duration,
    /// 是否需要刷新（内容变更时）
    dirty: bool,
}

impl PromptCacheManager {
    const TTL_SECS: u64 = 300; // 5 分钟
    const MIN_CACHE_TOKENS: usize = 1024;
    const MAX_CACHE_POINTS: usize = 4;
}
```

## 缓存策略

### 缓存块划分

```rust
impl PromptCacheManager {
    /// 给 ContentBlock 列表标记缓存断点
    fn mark_cache_points(
        &self,
        blocks: &mut Vec<ContentBlock>,
        token_counter: &TokenCounter,
    ) {
        // 遍历 blocks，在合适的位置插入 cache_control
        let mut cache_points = 0;
        let mut current_chunk_tokens = 0;
        let mut last_mark_index = 0;

        for (i, block) in blocks.iter().enumerate() {
            current_chunk_tokens += token_counter.count_block(block);

            // 当累积到足够 token 且还有剩余缓存断点配额
            if current_chunk_tokens >= Self::MIN_CACHE_TOKENS
                && cache_points < Self::MAX_CACHE_POINTS
            {
                // 在当前块标记 cache_control
                if let Some(last_block) = blocks.get_mut(i) {
                    last_block.set_cache_control("ephemeral");
                }
                cache_points += 1;
                current_chunk_tokens = 0;
                last_mark_index = i;
            }
        }
    }
}
```

### 缓存块内容哈希

```rust
/// 通过内容哈希判断缓存是否仍然有效
fn compute_cache_key(blocks: &[ContentBlock]) -> String {
    let mut hasher = Sha256::new();
    for block in blocks {
        hasher.update(serde_json::to_string(block).unwrap_or_default());
    }
    hex::encode(hasher.finalize())
}

impl PromptCacheManager {
    /// 检查缓存是否命中
    fn check_cache(&self, key: &str) -> CacheStatus {
        match self.cached_blocks.get(key) {
            Some(created_at) if created_at.elapsed() < self.ttl => {
                CacheStatus::Hit
            }
            Some(_) => {
                // 已过期
                CacheStatus::Expired
            }
            None => {
                CacheStatus::Miss
            }
        }
    }

    /// 记录新的缓存写入
    fn record_cache_write(&mut self, key: String) {
        self.cached_blocks.insert(key, Instant::now());
    }

    /// 标记缓存失效（System Prompt 变更时）
    fn invalidate(&mut self) {
        self.cached_blocks.clear();
        self.dirty = true;
    }
}

enum CacheStatus {
    Hit,       // 缓存命中
    Miss,      // 缓存未命中，需要写入
    Expired,   // 超时失效
}
```

## 与 Prompt Engine 的集成

```
PromptEngine::build()
    │
    ├─ 1. 组装 System Prompt + Tool Definitions
    │
    ├─ 2. 计算缓存键
    │     let cache_key = compute_cache_key(&system_blocks);
    │     let status = cache_manager.check_cache(&cache_key);
    │
    ├─ 3. 标记缓存点
    │     cache_manager.mark_cache_points(&mut blocks, &token_counter);
    │
    ├─ 4. 发送请求（带 cache_control 标记）
    │
    └─ 5. 处理响应中的缓存信息
          if response.cache_write_tokens > 0 {
              cache_manager.record_cache_write(cache_key);
          }
```

### 在 ContentBlock 中添加 cache_control

```rust
/// 为 Anthropic API 扩展 ContentBlock，支持 cache_control
impl ContentBlock {
    fn set_cache_control(&mut self, cache_type: &str) {
        // 在 JSON 序列化时添加:
        // "cache_control": { "type": "ephemeral" }
        self.extra.insert(
            "cache_control".to_string(),
            json!({ "type": cache_type }),
        );
    }
}
```

### 请求结构示例

```json
{
  "system": [
    {
      "type": "text",
      "text": "你是 AI 编程助手...（至少 1024 tokens 的内容）",
      "cache_control": { "type": "ephemeral" }
    },
    {
      "type": "text",
      "text": "可用工具定义: ...（至少 1024 tokens 的内容）",
      "cache_control": { "type": "ephemeral" }
    }
  ],
  "messages": [
    { "role": "user", "content": "帮我创建一个 React 组件" }
  ]
}
```

## 缓存效果监控

```rust
struct CacheMetrics {
    /// 总请求数
    total_requests: usize,
    /// 缓存命中次数
    cache_hits: usize,
    /// 缓存写入次数
    cache_writes: usize,
    /// 缓存读取 token 数（节省的 token 量）
    total_cache_read_tokens: usize,
    /// 缓存写入 token 数
    total_cache_write_tokens: usize,
}

impl CacheMetrics {
    fn hit_rate(&self) -> f64 {
        if self.total_requests == 0 { 0.0 }
        else { self.cache_hits as f64 / self.total_requests as f64 }
    }

    fn estimated_cost_savings(&self) -> f64 {
        // 缓存读取价格是基础价格的 10%
        let base_price_per_1k = 3.0 / 1_000_000.0; // $3/MTok (Sonnet 输入价)
        let cache_price_per_1k = base_price_per_1k * 0.1;

        self.total_cache_read_tokens as f64 * (base_price_per_1k - cache_price_per_1k)
    }
}
```

## 注意事项

1. **最小缓存块** — Anthropic 要求每个缓存块 ≥ 1024 tokens，小于此值的块即使标记也不会缓存
2. **最大断点数** — 最多 4 个 `cache_control` 标记
3. **缓存位置** — 缓存断点必须在 content block 之间，不能在同一 block 内部
4. **TTL 管理** — 每 5 分钟缓存失效，需在 ~4.5 分钟时预刷新（可选优化）
5. **Tool 定义变更** — 当工具列表变化时（如切换 Agent），必须 invalidate 缓存
6. **Provider 兼容** — OpenAI 的 Automatic Prompt Caching 不需要客户端干预；DeepSeek 需降级跳过

## 缓存块组合策略

由于 System Prompt 可能不够 1024 tokens，需要和 Tool Definitions 合并为一个缓存块：

```rust
/// 智能组合缓存块，确保每个缓存块 ≥ MIN_CACHE_TOKENS
fn optimize_cache_blocks(
    system_text: &str,
    tool_defs_json: &str,
    counter: &TokenCounter,
) -> Vec<CacheBlock> {
    let sys_tokens = counter.count_text(system_text);
    let tool_tokens = counter.count_text(tool_defs_json);

    if sys_tokens + tool_tokens >= MIN_CACHE_TOKENS && sys_tokens + tool_tokens < 4096 {
        // 合并为一个块
        vec![CacheBlock::combined(system_text, tool_defs_json)]
    } else if sys_tokens >= MIN_CACHE_TOKENS && tool_tokens >= MIN_CACHE_TOKENS {
        // 各自独立
        vec![
            CacheBlock::system(system_text),
            CacheBlock::tools(tool_defs_json),
        ]
    } else {
        // 一个就够了，另一个太小无需缓存
        vec![CacheBlock::larger_one(system_text, tool_defs_json)]
    }
}
```

---

> 上一模块：[Context Manager](./context-manager.md) | 下一模块：[Tool System](./tool-system.md)
> 返回 [总览](./agent-architecture-design.md)
