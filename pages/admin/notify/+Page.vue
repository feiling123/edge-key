<template>
  <section class="space-y-6">
    <div class="flex items-center justify-between gap-4 max-md:flex-col max-md:items-start">
      <div>
        <h1 class="text-2xl font-bold">{{ l("Telegram 通知", "Telegram Notifications") }}</h1>
        <p class="text-sm text-base-content/70">
          {{ l("配置 Telegram Bot API、通知开关、发送日志和消息模板。", "Configure Telegram Bot API, notification toggles, logs, and message templates.") }}
        </p>
      </div>
      <AppButton variant="primary" @click="openCreateDialog">{{ l("新增 Telegram Bot", "Add Telegram Bot") }}</AppButton>
    </div>

    <div role="tablist" class="tabs tabs-border">
      <a role="tab" class="tab" :class="{ 'tab-active': activeTab === 'stats' }" @click="activeTab = 'stats'">{{ l("统计", "Stats") }}</a>
      <a role="tab" class="tab" :class="{ 'tab-active': activeTab === 'config' }" @click="activeTab = 'config'">{{ l("配置", "Config") }}</a>
      <a role="tab" class="tab" :class="{ 'tab-active': activeTab === 'logs' }" @click="activeTab = 'logs'">{{ l("日志", "Logs") }}</a>
      <a role="tab" class="tab" :class="{ 'tab-active': activeTab === 'templates' }" @click="activeTab = 'templates'">{{ l("模板", "Templates") }}</a>
    </div>

    <section v-if="activeTab === 'stats'" class="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      <article v-for="metric in metricItems" :key="metric.label" class="card bg-base-100 shadow-sm">
        <div class="card-body">
          <div class="text-sm text-base-content/60">{{ metric.label }}</div>
          <div class="text-3xl font-bold">{{ metric.value }}</div>
        </div>
      </article>
    </section>

    <section v-if="activeTab === 'config'" class="space-y-6">
      <section class="card bg-base-100 shadow-sm">
        <div class="card-body space-y-4">
          <div>
            <h2 class="text-xl font-semibold">{{ l("消息推送设置", "Notification Settings") }}</h2>
            <p class="text-sm text-base-content/70">{{ l("这些开关会同步到所有 Telegram Bot 配置。", "These toggles are synced to every Telegram Bot config.") }}</p>
          </div>
          <div class="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
            <label class="label cursor-pointer justify-start gap-3">
              <input v-model="pushSettings.notifyOrderPaid" type="checkbox" class="checkbox checkbox-primary checkbox-sm" />
              <span class="label-text font-medium">{{ l("收款成功通知", "Payment success") }}</span>
            </label>
            <label class="label cursor-pointer justify-start gap-3">
              <input v-model="pushSettings.notifyDeliverySuccess" type="checkbox" class="checkbox checkbox-primary checkbox-sm" />
              <span class="label-text font-medium">{{ l("发货成功通知", "Delivery success") }}</span>
            </label>
            <label class="label cursor-pointer justify-start gap-3">
              <input v-model="pushSettings.notifyDeliveryFailed" type="checkbox" class="checkbox checkbox-primary checkbox-sm" />
              <span class="label-text font-medium">{{ l("发货失败告警", "Delivery failure alert") }}</span>
            </label>
            <label class="label cursor-pointer justify-start gap-3">
              <input v-model="pushSettings.notifyOrderDeleted" type="checkbox" class="checkbox checkbox-primary checkbox-sm" />
              <span class="label-text font-medium">{{ l("删除订单日志", "Order deletion log") }}</span>
            </label>
            <label class="label cursor-pointer justify-start gap-3">
              <input v-model="pushSettings.notifyAdminLogin" type="checkbox" class="checkbox checkbox-primary checkbox-sm" />
              <span class="label-text font-medium">{{ l("后台登录日志", "Admin login log") }}</span>
            </label>
          </div>
          <div class="flex flex-wrap items-center gap-3">
            <AppButton size="sm" variant="primary" :loading="savingPushSettings" @click="handleSavePushSettings">{{ l("保存推送设置", "Save Settings") }}</AppButton>
            <span v-if="pushSettingsMessage" class="text-sm" :class="pushSettingsError ? 'text-error' : 'text-success'">{{ pushSettingsMessage }}</span>
          </div>
        </div>
      </section>

      <section class="card bg-base-100 shadow-sm">
        <div class="card-body space-y-4">
          <div class="flex items-center justify-between gap-4">
            <div>
              <h2 class="text-xl font-semibold">{{ l("Telegram Bot 列表", "Telegram Bot List") }}</h2>
              <p class="text-sm text-base-content/70">{{ l("可添加多个 Bot 配置，只有激活的 Bot 会用于自动通知。", "Add multiple bot configs. Only the active bot sends automatic notifications.") }}</p>
            </div>
            <AppButton size="sm" variant="primary" @click="openCreateDialog">{{ l("新增 Bot", "Add Bot") }}</AppButton>
          </div>

          <div v-if="!configList.length" class="rounded border border-dashed border-base-300 py-10 text-center text-base-content/50">
            {{ l("暂无 Telegram Bot 配置。", "No Telegram Bot configuration yet.") }}
          </div>

          <div v-else class="overflow-x-auto">
            <table class="table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>{{ l("名称", "Name") }}</th>
                  <th>Chat ID</th>
                  <th>Bot Token</th>
                  <th>Parse Mode</th>
                  <th>{{ l("状态", "Status") }}</th>
                  <th>{{ l("操作", "Actions") }}</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="item in configList" :key="item.id">
                  <td class="font-mono text-sm">{{ item.id }}</td>
                  <td>{{ item.name || "-" }}</td>
                  <td class="font-mono text-sm">{{ item.chatId }}</td>
                  <td class="font-mono text-sm">{{ maskSecret(item.botToken) }}</td>
                  <td>{{ getParseModeLabel(item.parseMode) }}</td>
                  <td>
                    <StatusTag :type="item.isEnabled ? 'success' : 'default'">
                      {{ item.isEnabled ? l("已激活", "Active") : l("未激活", "Inactive") }}
                    </StatusTag>
                  </td>
                  <td>
                    <div class="flex flex-wrap items-center gap-2">
                      <AppButton size="xs" variant="outline" @click="openEditDialog(item)">{{ l("编辑", "Edit") }}</AppButton>
                      <AppButton size="xs" variant="outline" @click="openTestModal(item)">{{ l("测试", "Test") }}</AppButton>
                      <AppButton size="xs" :variant="item.isEnabled ? 'default' : 'primary'" :disabled="item.isEnabled" @click="handleActivate(item)">
                        {{ item.isEnabled ? l("当前激活", "Current") : l("激活", "Activate") }}
                      </AppButton>
                      <AppButton size="xs" variant="danger" @click="openDeleteConfig(item)">{{ l("删除", "Delete") }}</AppButton>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </section>

    <section v-if="activeTab === 'logs'" class="card bg-base-100 shadow-sm">
      <div class="card-body space-y-4">
        <div class="flex items-center justify-between gap-4">
          <div>
            <h2 class="text-xl font-semibold">{{ l("发送日志", "Send Logs") }}</h2>
            <p class="text-sm text-base-content/70">{{ l("记录 Telegram API 的发送结果和失败原因。", "Tracks Telegram API send results and errors.") }}</p>
          </div>
          <AppButton size="sm" variant="danger" :disabled="!logList.length" @click="openClearLogs">{{ l("清空日志", "Clear Logs") }}</AppButton>
        </div>
        <div class="overflow-x-auto">
          <table class="table">
            <thead>
              <tr>
                <th>{{ l("时间", "Time") }}</th>
                <th>{{ l("配置", "Config") }}</th>
                <th>{{ l("场景", "Scene") }}</th>
                <th>Chat ID</th>
                <th>{{ l("状态", "Status") }}</th>
                <th>{{ l("消息", "Message") }}</th>
                <th>{{ l("错误", "Error") }}</th>
              </tr>
            </thead>
            <tbody>
              <tr v-if="!logList.length">
                <td colspan="7" class="text-center text-base-content/60">{{ l("暂无 Telegram 日志", "No Telegram logs") }}</td>
              </tr>
              <tr v-for="log in logList" :key="log.id">
                <td class="whitespace-nowrap">{{ formatDate(log.createdAt) }}</td>
                <td>{{ log.configName || "-" }}</td>
                <td>{{ getSceneLabel(log.scene) }}</td>
                <td class="font-mono text-sm">{{ log.chatId }}</td>
                <td>
                  <StatusTag :type="log.status === 'SUCCESS' ? 'success' : 'danger'">
                    {{ log.status === "SUCCESS" ? l("成功", "Success") : l("失败", "Failed") }}
                  </StatusTag>
                </td>
                <td class="max-w-md">
                  <div class="line-clamp-2 whitespace-pre-wrap text-sm">{{ log.message }}</div>
                </td>
                <td class="max-w-xs text-error">
                  <div class="line-clamp-2">{{ log.error || "-" }}</div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </section>

    <section v-if="activeTab === 'templates'" class="grid gap-4 xl:grid-cols-2">
      <article v-for="template in templateList" :key="template.scene" class="card bg-base-100 shadow-sm">
        <div class="card-body space-y-4">
          <div class="flex items-center justify-between gap-4">
            <div>
              <h2 class="text-xl font-semibold">{{ getSceneLabel(template.scene) }}</h2>
              <p class="text-sm text-base-content/60">{{ template.name }}</p>
            </div>
            <label class="label cursor-pointer gap-2">
              <input v-model="template.isEnabled" type="checkbox" class="checkbox checkbox-primary checkbox-sm" />
              <span class="label-text">{{ l("启用", "Enabled") }}</span>
            </label>
          </div>
          <label class="flex flex-col gap-1.5">
            <span class="label-text font-medium">{{ l("模板名称", "Template Name") }}</span>
            <input v-model="template.name" class="input input-bordered w-full" />
          </label>
          <label class="flex flex-col gap-1.5">
            <span class="label-text font-medium">{{ l("消息内容", "Message Content") }}</span>
            <textarea v-model="template.content" class="textarea textarea-bordered min-h-44 w-full font-mono text-sm" />
          </label>
          <p class="text-xs text-base-content/60">
            {{ variableHelpText }}
          </p>
          <div class="flex items-center gap-3">
            <AppButton size="sm" variant="primary" :loading="savingTemplateScene === template.scene" @click="handleSaveTemplate(template)">{{ l("保存模板", "Save Template") }}</AppButton>
            <span v-if="templateMessages[template.scene]" class="text-sm" :class="templateErrors[template.scene] ? 'text-error' : 'text-success'">
              {{ templateMessages[template.scene] }}
            </span>
          </div>
        </div>
      </article>
    </section>

    <dialog class="modal" :class="{ 'modal-open': showConfigDialog }">
      <div class="modal-box w-11/12 max-w-2xl">
        <h3 class="mb-4 text-lg font-bold">{{ editingId ? l("编辑 Telegram Bot", "Edit Telegram Bot") : l("新增 Telegram Bot", "Add Telegram Bot") }}</h3>
        <div class="grid gap-4 md:grid-cols-2">
          <label class="flex flex-col gap-1.5 md:col-span-2">
            <span class="label-text font-medium">{{ l("配置名称", "Config Name") }}</span>
            <input v-model="configForm.name" class="input input-bordered w-full" :placeholder="l('例如：主通知 Bot', 'Example: Primary notification bot')" />
          </label>
          <label class="flex flex-col gap-1.5 md:col-span-2">
            <span class="label-text font-medium">Bot Token</span>
            <SecretInput v-model="configForm.botToken" placeholder="1234567890:AA..." />
          </label>
          <label class="flex flex-col gap-1.5">
            <span class="label-text font-medium">Chat ID</span>
            <input v-model="configForm.chatId" class="input input-bordered w-full" placeholder="-1001234567890" />
          </label>
          <label class="flex flex-col gap-1.5">
            <span class="label-text font-medium">{{ l("发送格式", "Send Format") }}</span>
            <select v-model="configForm.parseMode" class="select select-bordered w-full">
              <option value="NONE">{{ l("纯文本", "Plain Text") }}</option>
            </select>
          </label>
          <label class="flex flex-col gap-1.5 md:col-span-2">
            <span class="label-text font-medium">Telegram API Base URL</span>
            <input v-model="configForm.apiBaseUrl" class="input input-bordered w-full" placeholder="https://api.telegram.org" />
          </label>
          <label class="label cursor-pointer justify-start gap-3">
            <input v-model="configForm.isEnabled" type="checkbox" class="checkbox checkbox-primary checkbox-sm" />
            <span class="label-text font-medium">{{ l("保存后激活", "Activate after save") }}</span>
          </label>
        </div>
        <p v-if="configMessage" class="mt-4 text-sm" :class="configError ? 'text-error' : 'text-success'">{{ configMessage }}</p>
        <div class="modal-action">
          <AppButton variant="default" @click="closeConfigDialog">{{ l("取消", "Cancel") }}</AppButton>
          <AppButton variant="primary" :loading="savingConfig" @click="handleSaveConfig">{{ l("保存", "Save") }}</AppButton>
        </div>
      </div>
      <form method="dialog" class="modal-backdrop"><button @click.prevent="closeConfigDialog">close</button></form>
    </dialog>

    <dialog class="modal" :class="{ 'modal-open': showTestDialog }">
      <div class="modal-box w-11/12 max-w-xl">
        <h3 class="mb-4 text-lg font-bold">{{ l("测试发送", "Test Send") }} - {{ testingConfigName }}</h3>
        <div class="space-y-4">
          <label class="flex flex-col gap-1.5">
            <span class="label-text font-medium">Chat ID</span>
            <input v-model="testChatId" class="input input-bordered w-full" :placeholder="l('留空使用配置中的 Chat ID', 'Leave blank to use configured Chat ID')" />
          </label>
          <label class="flex flex-col gap-1.5">
            <span class="label-text font-medium">{{ l("测试内容", "Test Content") }}</span>
            <textarea v-model="testContent" class="textarea textarea-bordered min-h-32 w-full" />
          </label>
        </div>
        <p v-if="testMessage" class="mt-4 text-sm" :class="testError ? 'text-error' : 'text-success'">{{ testMessage }}</p>
        <div class="modal-action">
          <AppButton variant="default" @click="closeTestDialog">{{ l("取消", "Cancel") }}</AppButton>
          <AppButton variant="primary" :loading="sendingTest" @click="handleSendTest">{{ l("发送测试", "Send Test") }}</AppButton>
        </div>
      </div>
      <form method="dialog" class="modal-backdrop"><button @click.prevent="closeTestDialog">close</button></form>
    </dialog>

    <dialog class="modal" :class="{ 'modal-open': confirmState.open }">
      <div class="modal-box max-w-md">
        <h3 class="text-lg font-bold">{{ confirmState.title }}</h3>
        <p class="py-4 whitespace-pre-line">{{ confirmState.message }}</p>
        <p v-if="confirmMessage" class="text-sm" :class="confirmError ? 'text-error' : 'text-success'">{{ confirmMessage }}</p>
        <div class="modal-action">
          <AppButton variant="default" @click="closeConfirm">{{ l("取消", "Cancel") }}</AppButton>
          <AppButton variant="danger" :loading="confirmLoading" @click="handleConfirm">{{ l("确认", "Confirm") }}</AppButton>
        </div>
      </div>
      <form method="dialog" class="modal-backdrop"><button @click.prevent="closeConfirm">close</button></form>
    </dialog>
  </section>
</template>

<script setup lang="ts">
import { computed, reactive, ref } from "vue";
import AppButton from "../../../components/AppButton.vue";
import SecretInput from "../../../components/SecretInput.vue";
import StatusTag from "../../../components/StatusTag.vue";
import { useI18n } from "../../../lib/client-i18n";
import { usePageContext } from "vike-vue/usePageContext";
import { onSaveTelegramConfig, onDeleteTelegramConfig, onSaveTelegramPushSettings, onActivateTelegramConfig, onClearTelegramLogs } from "./saveTelegramConfig.telefunc";
import { onSaveTelegramTemplate } from "./saveTelegramTemplate.telefunc";
import { onSendTestTelegram } from "./sendTestTelegram.telefunc";

type TelegramScene = "TEST" | "ORDER_PAID" | "DELIVERY_SUCCESS" | "DELIVERY_FAILED" | "ORDER_DELETED" | "ADMIN_LOGIN";
type TelegramParseMode = "NONE" | "HTML" | "MARKDOWN_V2";

type TelegramConfigItem = {
  id?: number;
  name?: string;
  botToken: string;
  chatId: string;
  apiBaseUrl: string;
  parseMode: TelegramParseMode;
  isEnabled: boolean;
  notifyOrderPaid: boolean;
  notifyDeliverySuccess: boolean;
  notifyDeliveryFailed: boolean;
  notifyOrderDeleted: boolean;
  notifyAdminLogin: boolean;
};

type TelegramTemplateItem = {
  scene: TelegramScene;
  name: string;
  content: string;
  isEnabled: boolean;
};

type TelegramLogItem = {
  id: number;
  configId?: number | null;
  configName?: string | null;
  scene: TelegramScene;
  status: "SUCCESS" | "FAILED";
  chatId: string;
  message: string;
  error?: string | null;
  createdAt: string;
};

type PushSettings = {
  notifyOrderPaid: boolean;
  notifyDeliverySuccess: boolean;
  notifyDeliveryFailed: boolean;
  notifyOrderDeleted: boolean;
  notifyAdminLogin: boolean;
};

const pageContext = usePageContext();
const { l } = useI18n();
const pageData = (pageContext.data ?? {}) as {
  configs?: TelegramConfigItem[];
  templates?: TelegramTemplateItem[];
  logs?: TelegramLogItem[];
  pushSettings?: Partial<PushSettings>;
};

const activeTab = ref<"stats" | "config" | "logs" | "templates">("config");
const configList = reactive<TelegramConfigItem[]>([...(pageData.configs ?? [])]);
const templateList = reactive<TelegramTemplateItem[]>([...(pageData.templates ?? [])]);
const logList = reactive<TelegramLogItem[]>([...(pageData.logs ?? [])]);
const pushSettings = reactive<PushSettings>({
  notifyOrderPaid: pageData.pushSettings?.notifyOrderPaid ?? true,
  notifyDeliverySuccess: pageData.pushSettings?.notifyDeliverySuccess ?? true,
  notifyDeliveryFailed: pageData.pushSettings?.notifyDeliveryFailed ?? true,
  notifyOrderDeleted: pageData.pushSettings?.notifyOrderDeleted ?? false,
  notifyAdminLogin: pageData.pushSettings?.notifyAdminLogin ?? false,
});

const metricItems = computed(() => [
  { label: l("Bot 配置", "Bot Configs"), value: formatNumber(configList.length) },
  { label: l("发送成功", "Sent"), value: formatNumber(logList.filter((item) => item.status === "SUCCESS").length) },
  { label: l("发送失败", "Failed"), value: formatNumber(logList.filter((item) => item.status === "FAILED").length) },
  { label: l("测试通知", "Tests"), value: formatNumber(logList.filter((item) => item.scene === "TEST").length) },
]);
const variableHelpText = computed(() =>
  l(
    "变量：{{siteName}} {{siteUrl}} {{orderNo}} {{productName}} {{amount}} {{quantity}} {{deliveryItems}} {{errorMessage}} {{queryUrl}} {{sentAt}} {{customContent}} {{clientIp}} {{username}}",
    "Variables: {{siteName}} {{siteUrl}} {{orderNo}} {{productName}} {{amount}} {{quantity}} {{deliveryItems}} {{errorMessage}} {{queryUrl}} {{sentAt}} {{customContent}} {{clientIp}} {{username}}",
  )
);

const configForm = reactive<TelegramConfigItem>(emptyConfigForm());
const editingId = ref<number | null>(null);
const showConfigDialog = ref(false);
const savingConfig = ref(false);
const configMessage = ref("");
const configError = ref(false);

const savingPushSettings = ref(false);
const pushSettingsMessage = ref("");
const pushSettingsError = ref(false);

const testingConfigId = ref<number | null>(null);
const testingConfigName = ref("");
const showTestDialog = ref(false);
const testChatId = ref("");
const testContent = ref(l("Telegram API 已连通。", "Telegram API is connected."));
const sendingTest = ref(false);
const testMessage = ref("");
const testError = ref(false);

const savingTemplateScene = ref<TelegramScene | null>(null);
const templateMessages = reactive<Record<string, string>>({});
const templateErrors = reactive<Record<string, boolean>>({});

const confirmState = reactive({
  open: false,
  kind: "" as "config" | "logs" | "",
  id: 0,
  title: "",
  message: "",
});
const confirmLoading = ref(false);
const confirmMessage = ref("");
const confirmError = ref(false);

function emptyConfigForm(): TelegramConfigItem {
  return {
    name: "",
    botToken: "",
    chatId: "",
    apiBaseUrl: "https://api.telegram.org",
    parseMode: "NONE",
    isEnabled: configList.length === 0,
    notifyOrderPaid: pushSettings?.notifyOrderPaid ?? true,
    notifyDeliverySuccess: pushSettings?.notifyDeliverySuccess ?? true,
    notifyDeliveryFailed: pushSettings?.notifyDeliveryFailed ?? true,
    notifyOrderDeleted: pushSettings?.notifyOrderDeleted ?? false,
    notifyAdminLogin: pushSettings?.notifyAdminLogin ?? false,
  };
}

function assignConfigForm(value: TelegramConfigItem) {
  Object.assign(configForm, {
    name: value.name ?? "",
    botToken: value.botToken ?? "",
    chatId: value.chatId ?? "",
    apiBaseUrl: value.apiBaseUrl || "https://api.telegram.org",
    parseMode: "NONE",
    isEnabled: Boolean(value.isEnabled),
    notifyOrderPaid: value.notifyOrderPaid,
    notifyDeliverySuccess: value.notifyDeliverySuccess,
    notifyDeliveryFailed: value.notifyDeliveryFailed,
    notifyOrderDeleted: value.notifyOrderDeleted,
    notifyAdminLogin: value.notifyAdminLogin,
  });
}

function openCreateDialog() {
  editingId.value = null;
  assignConfigForm(emptyConfigForm());
  configMessage.value = "";
  configError.value = false;
  showConfigDialog.value = true;
}

function openEditDialog(item: TelegramConfigItem) {
  editingId.value = item.id ?? null;
  assignConfigForm(item);
  configMessage.value = "";
  configError.value = false;
  showConfigDialog.value = true;
}

function closeConfigDialog() {
  if (savingConfig.value) return;
  showConfigDialog.value = false;
}

async function handleSaveConfig() {
  savingConfig.value = true;
  configMessage.value = "";
  configError.value = false;
  try {
    const payload = {
      ...configForm,
      id: editingId.value ?? undefined,
      notifyOrderPaid: pushSettings.notifyOrderPaid,
      notifyDeliverySuccess: pushSettings.notifyDeliverySuccess,
      notifyDeliveryFailed: pushSettings.notifyDeliveryFailed,
      notifyOrderDeleted: pushSettings.notifyOrderDeleted,
      notifyAdminLogin: pushSettings.notifyAdminLogin,
    };
    const result = await onSaveTelegramConfig(payload) as TelegramConfigItem;
    if (result.isEnabled) {
      for (const item of configList) item.isEnabled = false;
    }
    const index = configList.findIndex((item) => item.id === result.id);
    if (index >= 0) {
      Object.assign(configList[index], result);
    } else {
      configList.push(result);
    }
    configMessage.value = l("保存成功", "Saved");
    window.setTimeout(() => closeConfigDialog(), 350);
  } catch (error) {
    configError.value = true;
    configMessage.value = getErrorText(error);
  } finally {
    savingConfig.value = false;
  }
}

async function handleSavePushSettings() {
  savingPushSettings.value = true;
  pushSettingsMessage.value = "";
  pushSettingsError.value = false;
  try {
    const result = await onSaveTelegramPushSettings({ ...pushSettings }) as PushSettings;
    Object.assign(pushSettings, result);
    for (const item of configList) {
      item.notifyOrderPaid = result.notifyOrderPaid;
      item.notifyDeliverySuccess = result.notifyDeliverySuccess;
      item.notifyDeliveryFailed = result.notifyDeliveryFailed;
      item.notifyOrderDeleted = result.notifyOrderDeleted;
      item.notifyAdminLogin = result.notifyAdminLogin;
    }
    pushSettingsMessage.value = l("已保存", "Saved");
  } catch (error) {
    pushSettingsError.value = true;
    pushSettingsMessage.value = getErrorText(error);
  } finally {
    savingPushSettings.value = false;
  }
}

async function handleActivate(item: TelegramConfigItem) {
  if (!item.id || item.isEnabled) return;
  try {
    const result = await onActivateTelegramConfig(item.id) as TelegramConfigItem;
    for (const config of configList) {
      config.isEnabled = config.id === result.id;
    }
  } catch (error) {
    window.alert(getErrorText(error));
  }
}

function openTestModal(item: TelegramConfigItem) {
  testingConfigId.value = item.id ?? null;
  testingConfigName.value = item.name || `Bot ${item.id}`;
  testChatId.value = "";
  testContent.value = l("Telegram API 已连通。", "Telegram API is connected.");
  testMessage.value = "";
  testError.value = false;
  showTestDialog.value = true;
}

function closeTestDialog() {
  if (sendingTest.value) return;
  showTestDialog.value = false;
}

async function handleSendTest() {
  if (!testingConfigId.value) return;
  sendingTest.value = true;
  testMessage.value = "";
  testError.value = false;
  try {
    await onSendTestTelegram({
      configId: testingConfigId.value,
      chatId: testChatId.value,
      customContent: testContent.value,
    });
    testMessage.value = l("测试通知已发送", "Test notification sent");
  } catch (error) {
    testError.value = true;
    testMessage.value = getErrorText(error);
  } finally {
    sendingTest.value = false;
  }
}

function openDeleteConfig(item: TelegramConfigItem) {
  if (!item.id) return;
  confirmState.open = true;
  confirmState.kind = "config";
  confirmState.id = item.id;
  confirmState.title = l("删除 Telegram Bot", "Delete Telegram Bot");
  confirmState.message = l(`确认删除 ${item.name || item.chatId}？此操作不可恢复。`, `Delete ${item.name || item.chatId}? This cannot be undone.`);
  confirmMessage.value = "";
  confirmError.value = false;
}

function openClearLogs() {
  confirmState.open = true;
  confirmState.kind = "logs";
  confirmState.id = 0;
  confirmState.title = l("清空发送日志", "Clear Send Logs");
  confirmState.message = l("确认清空所有 Telegram 发送日志？此操作不可恢复。", "Clear all Telegram send logs? This cannot be undone.");
  confirmMessage.value = "";
  confirmError.value = false;
}

function closeConfirm() {
  if (confirmLoading.value) return;
  confirmState.open = false;
}

async function handleConfirm() {
  confirmLoading.value = true;
  confirmMessage.value = "";
  confirmError.value = false;
  try {
    if (confirmState.kind === "config") {
      await onDeleteTelegramConfig(confirmState.id);
      const index = configList.findIndex((item) => item.id === confirmState.id);
      if (index >= 0) configList.splice(index, 1);
    } else if (confirmState.kind === "logs") {
      await onClearTelegramLogs();
      logList.splice(0, logList.length);
    }
    closeConfirm();
  } catch (error) {
    confirmError.value = true;
    confirmMessage.value = getErrorText(error);
  } finally {
    confirmLoading.value = false;
  }
}

async function handleSaveTemplate(template: TelegramTemplateItem) {
  savingTemplateScene.value = template.scene;
  templateMessages[template.scene] = "";
  templateErrors[template.scene] = false;
  try {
    const result = await onSaveTelegramTemplate({ ...template }) as TelegramTemplateItem;
    Object.assign(template, result);
    templateMessages[template.scene] = l("已保存", "Saved");
  } catch (error) {
    templateErrors[template.scene] = true;
    templateMessages[template.scene] = getErrorText(error);
  } finally {
    savingTemplateScene.value = null;
  }
}

function getSceneLabel(scene: TelegramScene) {
  return ({
    TEST: l("测试通知", "Test Notification"),
    ORDER_PAID: l("收款成功", "Payment Success"),
    DELIVERY_SUCCESS: l("发货成功", "Delivery Success"),
    DELIVERY_FAILED: l("发货失败", "Delivery Failure"),
    ORDER_DELETED: l("删除订单", "Order Deleted"),
    ADMIN_LOGIN: l("后台登录", "Admin Login"),
  } as Record<TelegramScene, string>)[scene] || scene;
}

function getParseModeLabel(mode: TelegramParseMode) {
  if (mode === "MARKDOWN_V2") return "MarkdownV2";
  if (mode === "HTML") return "HTML";
  return l("纯文本", "Plain Text");
}

function maskSecret(value?: string) {
  if (!value) return "-";
  if (value.length <= 12) return "********";
  return `${value.slice(0, 6)}********${value.slice(-4)}`;
}

function formatDate(value: string) {
  if (!value) return "-";
  try {
    return new Intl.DateTimeFormat(undefined, {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(value));
  } catch {
    return value;
  }
}

function formatNumber(value: number) {
  return new Intl.NumberFormat().format(value);
}

function getErrorText(error: unknown) {
  const abortValue = (error as { abortValue?: { message?: unknown } } | null)?.abortValue;
  if (typeof abortValue?.message === "string" && abortValue.message) return abortValue.message;
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === "string") return error;
  return l("操作失败", "Operation failed");
}
</script>
