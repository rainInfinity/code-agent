## 1. Deny Rules 鏈哄埗

- [x] 1.1 鍦?`tools/mod.rs` 涓畾涔?`DenyRule` 缁撴瀯浣擄紙tool_pattern, reason锛?- [x] 1.2 `ToolRegistry` 鏂板 `deny_rules: Vec<DenyRule>` 瀛楁
- [x] 1.3 瀹炵幇 `set_deny_rules(&mut self, rules: Vec<DenyRule>)` 鏂规硶
- [x] 1.4 瀹炵幇 `apply_deny_rules(&self, tool: &Arc<dyn Tool>) -> bool` 閫氶厤绗﹀尮閰?
## 2. 涓夊眰杩囨护

- [x] 2.1 瀹炵幇 `get_enabled_tools(&self) -> Vec<Arc<dyn Tool>>`
- [x] 2.2 闆嗘垚 `tool.is_enabled()` 绗笁灞傝繍琛屾椂杩囨护
- [x] 2.3 闆嗘垚 deny rules 杩囨护

## 3. 宸ュ叿姹犵粍瑁?
- [x] 3.1 瀹炵幇 `assemble_tool_pool(built_in, mcp_tools) -> Vec<Arc<dyn Tool>>` 闈欐€佹柟娉?- [x] 3.2 纭繚 built-in 鍦ㄥ墠銆丮CP 鍦ㄥ悗锛屽悇鑷唴閮ㄦ寜 name 鎺掑簭

## 4. definitions() 鏇存柊

- [x] 4.1 灏?`definitions()` 鍐呴儴鏀逛负璋冪敤 `get_enabled_tools()` 鑰岄潪鐩存帴閬嶅巻 `self.tools`

## 5. 娴嬭瘯

- [x] 5.1 娴嬭瘯 `get_enabled_tools` 灏婇噸 `is_enabled()` 杩斿洖鍊?- [x] 5.2 娴嬭瘯 deny rules 閫氶厤绗﹀尮閰嶆纭繃婊?- [x] 5.3 娴嬭瘯 deny rules 娓呯┖鍚庢墍鏈夊伐鍏锋仮澶嶅彲瑙?- [x] 5.4 娴嬭瘯 `assemble_tool_pool` 鎺掑簭姝ｇ‘锛坆uilt-in 鍦ㄥ墠锛屽悇鑷寜鍚嶅瓧姣嶅簭锛?- [x] 5.5 娴嬭瘯 `definitions()` 杩斿洖杩囨护鍚庣殑缁撴灉
- [x] 5.6 `cargo test` 鍏ㄩ儴閫氳繃
