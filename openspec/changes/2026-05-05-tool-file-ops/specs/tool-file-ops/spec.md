## read_file — 读取文件

### 元数据

| 属性 | 值 |
|------|-----|
| `name` | `"read_file"` |
| `risk_level` | `Safe` |
| `is_read_only` | `true` |
| `is_concurrency_safe` | `true` |
| `needs_approval` | `false` |
| `timeout_ms` | `30000` |

### 参数

| 参数 | 类型 | 必需 | 说明 |
|------|------|------|------|
| `file_path` | `string` | 是 | 文件绝对路径 |
| `offset` | `integer` | 否 | 起始行号（0-indexed） |
| `limit` | `integer` | 否 | 读取行数 |
| `pages` | `string` | 否 | PDF 页码范围（如 "1-5"） |

### 行为

- 文件不存在 → 返回错误，提示路径无效
- 指定 offset/limit → 只返回对应行范围
- 图片文件（.png/.jpg/.gif/.webp）→ 尝试读取为图片（注：V1 可返回文件信息，图片内容解析后续扩展）
- PDF 文件 → 支持 pages 参数指定页面范围（V1 可返回文件信息，解析后续扩展）

### search_hint

`"read file contents with optional line range and image/pdf support"`

### aliases

`["read", "cat"]`

---

## write_file — 创建/覆盖文件

### 元数据

| 属性 | 值 |
|------|-----|
| `name` | `"write_file"` |
| `risk_level` | `Dangerous` |
| `is_read_only` | `false` |
| `is_concurrency_safe` | `false` |
| `needs_approval` | `true` |
| `is_destructive` | `false`（创建新文件或覆盖，非删除） |
| `timeout_ms` | `60000` |

### 参数

| 参数 | 类型 | 必需 | 说明 |
|------|------|------|------|
| `file_path` | `string` | 是 | 文件绝对路径 |
| `content` | `string` | 是 | 要写入的文件内容 |

### 行为

- 文件不存在 → 创建新文件（含父目录）
- 文件已存在 → 覆盖写入
- 写入失败（权限不足等）→ 返回错误

### search_hint

`"create or overwrite a file at path with content"`

### aliases

`["write", "create_file"]`

---

## edit_file — 精确字符串替换

### 元数据

| 属性 | 值 |
|------|-----|
| `name` | `"edit_file"` |
| `risk_level` | `Dangerous` |
| `is_read_only` | `false` |
| `is_concurrency_safe` | `false` |
| `needs_approval` | `true` |
| `timeout_ms` | `60000` |

### 参数

| 参数 | 类型 | 必需 | 说明 |
|------|------|------|------|
| `file_path` | `string` | 是 | 要编辑的文件绝对路径 |
| `old_string` | `string` | 是 | 要替换的原字符串（必须在文件中唯一匹配） |
| `new_string` | `string` | 是 | 替换后的新字符串 |
| `replace_all` | `boolean` | 否 | 是否替换所有匹配项，默认 false |

### 行为

- 文件不存在 → 返回错误
- `old_string` 在文件中匹配 0 次且 `replace_all=false` → 返回错误 "No match found"
- `old_string` 在文件中匹配 >1 次且 `replace_all=false` → 返回错误 "Multiple matches found, use replace_all or provide more context"
- `old_string` 匹配 1 次 → 执行替换
- `replace_all=true` → 替换所有匹配项
- 替换后文件内容不变 → 返回提示

### search_hint

`"perform exact string replacements in existing file"`

### aliases

`["edit"]`

---

## validate_input 行为

### read_file

- 检查 `file_path` 不为空
- 检查路径在 `ctx.allowed_paths` 范围内（若配置了沙箱）

### write_file / edit_file

- 检查 `file_path` 不为空
- 检查路径在 `ctx.allowed_paths` 范围内（若配置了沙箱）
- 检查目标不是目录

## get_path 行为

三者均从 `file_path` 参数中提取操作目标路径。

## user_facing_name 行为

- read_file → `"读取 {file_name}"`
- write_file → `"写入 {file_name}"`
- edit_file → `"编辑 {file_name}"`
