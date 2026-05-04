# settings-sidebar-layout Specification

## ADDED Requirements

### Requirement: Settings modal shall have sidebar navigation

设置弹窗 SHALL 采用左右两栏布局，左侧为分类导航侧边栏，右侧为对应分类的设置内容。

#### Scenario: Open settings modal

- **WHEN** 用户打开设置弹窗
- **THEN** 弹窗左侧显示分类导航，包含"通用"、"API 配置"两个分类
- **AND** 默认选中"通用"分类
- **AND** 右侧显示"通用"分类对应的设置内容（主题切换）
- **AND** 弹窗为固定高度 480px，无标题栏
- **AND** 侧边栏导航高度占满弹窗内容区

#### Scenario: Navigate between setting categories

- **WHEN** 用户点击左侧导航中的另一个分类
- **THEN** 右侧内容区切换为对应分类的设置项
- **AND** 被选中的分类在导航中高亮显示
- **AND** 之前分类中填写的表单数据不丢失

#### Scenario: Save settings

- **WHEN** 用户点击保存按钮
- **THEN** 所有分类中的设置（主题、API 配置、模型选择）一并保存
- **AND** 无论当前选中哪个分类，所有修改都生效

### Requirement: General section shall contain theme setting

"通用"分类 SHALL 包含主题切换控件，支持深色和浅色两种主题。

#### Scenario: Display theme options

- **WHEN** 用户在设置中选中"通用"分类
- **THEN** 右侧显示主题标签和深色/浅色切换按钮
- **AND** 当前生效的主题对应的按钮高亮

#### Scenario: Switch theme

- **WHEN** 用户点击与当前不同的主题按钮
- **THEN** 该按钮立即高亮
- **AND** 保存后主题生效

### Requirement: API configuration section shall contain provider and model settings

"API 配置"分类 SHALL 包含提供商选择器、API Key 输入框、自定义端点输入框、模型下拉选择器和刷新模型列表按钮。API 配置和模型配置合并在同一分类下。

#### Scenario: Display API configuration

- **WHEN** 用户在设置中选中"API 配置"分类
- **THEN** 右侧显示提供商选择器（Anthropic / DeepSeek / OpenAI 单选按钮组）
- **AND** 显示 API Key 输入框
- **AND** 显示 API 端点输入框
- **AND** 显示模型下拉选择框和刷新按钮
- **AND** 若 API Key 已配置，显示已配置状态标识
- **AND** 若已刷新过模型列表，显示可用模型数量

#### Scenario: Switch provider

- **WHEN** 用户在 API 配置中切换提供商
- **THEN** API Key 输入框、端点输入框和模型选择器更新为对应提供商的已保存值或默认值
- **AND** 模型列表清空，等待用户刷新
- **AND** 切换前填写的表单数据在切回时保留

#### Scenario: Refresh model list

- **WHEN** 用户点击刷新模型按钮
- **THEN** 通过当前选中的 provider 和 API Key 查询可用模型
- **AND** 下拉框更新为返回的模型列表
- **AND** 若当前选中的模型不在新列表中，自动选中第一个可用模型

#### Scenario: Refresh fails

- **WHEN** 模型列表刷新失败（如 API Key 无效或网络错误）
- **THEN** 显示错误提示
- **AND** 下拉框保持原有选项不变

#### Scenario: Save API configuration

- **WHEN** 用户填写 API 配置并保存
- **THEN** API Key 通过后端安全存储
- **AND** 端点、模型选择和主题一并持久化

### Requirement: Settings modal shall not contain work mode or work directory

设置弹窗 SHALL NOT 包含工作模式切换和工作目录管理功能。

#### Scenario: Settings modal without work mode

- **WHEN** 用户打开设置弹窗
- **THEN** 弹窗中不包含工作模式（对话/编程）选择控件
- **AND** 弹窗中不包含工作目录添加、删除、列表显示控件

### Requirement: Settings modal shall have fixed height and no title bar

设置弹窗 SHALL 使用固定高度 480px，不包含顶部标题栏。关闭按钮移至底部操作区。

#### Scenario: Settings modal structure

- **WHEN** 用户打开设置弹窗
- **THEN** 弹窗高度固定为 480px
- **AND** 弹窗不包含"设置"标题和顶部关闭按钮
- **AND** 关闭按钮位于底部操作区，与取消和保存按钮同排
- **AND** 切换到不同分类时弹窗高度不变

### Requirement: Settings sidebar shall fill full modal height

设置弹窗的左侧分类导航 SHALL 占满弹窗内容区的完整高度，顶部和底部不留空白间隙。

#### Scenario: Sidebar full height

- **WHEN** 设置弹窗显示
- **THEN** 侧边栏导航从弹窗内容区顶部延伸到底部
- **AND** 分类导航项在侧边栏中从上到下排列
- **AND** 侧边栏顶部没有标题栏占位

### Requirement: Settings modal layout shall be responsive

设置弹窗 SHALL 适应不同的窗口宽度，确保不会超出视口。

#### Scenario: Settings modal on small window

- **WHEN** 窗口宽度小于 700px
- **THEN** 弹窗宽度自适应为视口的 90%
- **AND** 侧边栏和内容区按比例缩放
- **AND** 所有控件仍可正常交互
