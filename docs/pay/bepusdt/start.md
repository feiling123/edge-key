# EdgeKey 对接 Upay Pro V3 教程

本教程说明 EdgeKey 的 `BEpusdt` 支付标签页如何对接 Upay Pro V3 Cloudflare 支付网关。

## 配置步骤

**配置说明**

- **网关地址**：只需填写 Upay Pro V3 域名，如 `https://pay.example.com`，系统会自动拼接 API 路径（`/api/create_order`）。
- **商户 ID**：Upay Pro V3 后台创建的商户 ID，默认 `default`。
- **支付币种**：Upay Pro V3 后台该商户已配置钱包的币种，可多选，例如 `USDT-TRC20`、`TRX`。
- **App Secret**：Upay Pro V3 商户签名密钥。

![BEpusdt支付配置](./0.jpg)

**配置步骤示例**：
1. 登录 EdgeKey 管理后台
2. 进入「支付配置」页面
3. 选择 BEpusdt 标签页
4. 填写具体配置
5. 启用支付方式：点击右上角的启用开关
6. 保存配置：点击「保存配置」按钮

![支付配置](./1.jpg)

### 重要提示
填写完配置信息后，点击右上角的 **启用** 开关，然后点击 **保存配置** 按钮。
⚠️ **重要提示**：启用支付前，请先前往「站点设置」配置网站地址，否则无法获取支付结果。

![网站地址配置](./2.jpg)

## 配置字段说明

**通用字段说明**：
- **显示名称**：支付方式在前台显示的名称，用户可自定义
- **网关地址**：支付网关服务域名，系统会自动处理接口路径
- **Notify URL**：异步通知地址，支付完成后系统会回调此地址
- **Return URL**：同步回跳地址，用户支付完成后跳转的页面

**Upay Pro V3 专用字段**：
- **商户 ID**：Upay Pro V3 后台商户 ID，默认 `default`
- **支付币种**：必须与 Upay Pro V3 钱包配置中的币种一致；多选后前台会按币种分别展示支付入口
- **App Secret**：Upay Pro V3 商户签名密钥


## 异步通知地址和同步回跳地址

这两个地址的路由部分 **严格按要求填写**，只需将域名部分替换为您实际部署的 EdgeKey 服务器地址：

- **异步通知地址**：`/api/payments/bepusdt/notify`
    - 路由固定为 `/api/payments/bepusdt/notify`
    - 示例：若部署地址为 `https://example.com`，则填写 `/api/payments/bepusdt/notify`

- **同步回跳地址**：`/order/{orderNo}?token={token}`
    - 路由固定为 `/order/{orderNo}?token={token}`（`:orderNo` 和 `{token}` 为动态参数）
    - 示例：若部署地址为 `https://example.com`，则填写 `/order/{orderNo}?token={token}`

## 配置验证

配置完成后，请按照以下步骤进行测试：

1. 进入 EdgeKey 前台，选择一个商品进行购买。
2. 在结算页面选择具体数字货币币种。
3. 观察是否正常跳转到收银台页面。

## 故障排查

若出现网关错误提示，请按照以下步骤排查：

- **检查网络连通性**：确认 EdgeKey Worker 能够正常访问 Upay Pro V3 域名。
- **检查商户 ID、支付币种和 App Secret**：确认与 Upay Pro V3 后台商户、钱包、签名密钥一致。
- **Cloudflare 1042**：如果 EdgeKey 和 Upay Pro V3 都部署在 Cloudflare Workers，同域 Worker 之间 `fetch` 可能触发 1042；项目已启用 `global_fetch_strictly_public` 兼容标记，更新部署后再测试。
- **检查回调地址**：确保异步通知地址可以从外部访问，且格式正确。
- **检查站点设置**：确保在「站点设置」中配置了正确的网站地址。
- **查看日志**：检查 EdgeKey 和 Upay Pro V3 的 Worker 日志，获取更详细的错误信息。

## 工作模式

本项目的 BEpusdt 适配器已按 Upay Pro V3 兼容接口工作，创建订单接口为 `/api/create_order`。需要在支付配置中选择商户 ID 和一个或多个支付币种，且该商户必须在 Upay Pro V3 后台配置对应钱包。

## 相关链接

- [EdgeKey 项目主页](https://github.com/34892002/edgeKey)
