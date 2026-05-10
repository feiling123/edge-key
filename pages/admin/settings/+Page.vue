<template>
  <section class="card bg-base-100 shadow-sm">
    <div class="card-body space-y-4">
      <div class="flex items-center justify-between gap-4 max-md:flex-col max-md:items-start">
        <div>
          <h1 class="text-2xl font-bold">{{ l("站点设置", "Site Settings") }}</h1>
          <p class="text-sm text-base-content/70">{{ l("维护前台展示的站点名称、公告、关于、客服和下单提示。", "Maintain storefront name, notice page, about page, support contact, and order notes.") }}</p>
        </div>
        <span v-if="saved" class="badge badge-success">{{ l("已保存", "Saved") }}</span>
      </div>

      <div class="grid gap-4 md:grid-cols-2">
        <label class="flex flex-col gap-1.5">
          <span class="label-text font-medium">{{ l("站点名称", "Site Name") }}</span>
          <input v-model="form.siteName" class="input input-bordered w-full" />
        </label>
        <label class="flex flex-col gap-1.5">
          <span class="label-text font-medium">{{ l("网站地址", "Site URL") }}</span>
          <input v-model="form.siteUrl" class="input input-bordered w-full" placeholder="https://example.com" />
        </label>
      </div>

      <div class="grid gap-4 md:grid-cols-2">
        <label class="flex flex-col gap-1.5">
          <span class="label-text font-medium">{{ l("副标题", "Subtitle") }}</span>
          <input v-model="form.siteSubtitle" class="input input-bordered w-full" />
        </label>
        <label class="flex flex-col gap-1.5">
          <span class="label-text font-medium">{{ l("网站 Favicon (ico & png)", "Favicon (ico & png)") }}</span>
          <input v-model="form.logoIcon" class="input input-bordered w-full" placeholder="https://example.com/favicon.ico" />
        </label>
      </div>

      <div class="grid gap-4 md:grid-cols-2">
        <label class="flex flex-col gap-1.5 md:col-span-2">
          <span class="label-text font-medium">{{ l("网站 Logo URL", "Logo URL") }}</span>
          <input v-model="form.logo" class="input input-bordered w-full" placeholder="https://example.com/logo.png" />
        </label>
      </div>

      <label class="flex flex-col gap-1.5">
        <span class="label-text font-medium">{{ l("首页公告", "Homepage Notice") }}</span>
        <textarea v-model="form.notice" class="textarea textarea-bordered w-full" rows="4"></textarea>
      </label>

      <div class="rounded-box border border-base-300 bg-base-200/40 p-4">
        <div class="mb-4">
          <h2 class="text-lg font-semibold">{{ l("公告页面内容", "Notice Page Content") }}</h2>
          <p class="text-xs text-base-content/50">{{ l("显示在前台 /notice 页面，支持纯文本换行或少量 HTML。", "Displayed on /notice. Plain text with line breaks or simple HTML is supported.") }}</p>
        </div>
        <div class="grid gap-4 md:grid-cols-2">
          <label class="flex flex-col gap-1.5">
            <span class="label-text font-medium">{{ l("公告内容（中文）", "Notice Content (Chinese)") }}</span>
            <textarea v-model="form.noticePageZh" class="textarea textarea-bordered w-full" rows="8"></textarea>
          </label>
          <label class="flex flex-col gap-1.5">
            <span class="label-text font-medium">{{ l("公告内容（英文）", "Notice Content (English)") }}</span>
            <textarea v-model="form.noticePageEn" class="textarea textarea-bordered w-full" rows="8"></textarea>
          </label>
        </div>
      </div>

      <div class="rounded-box border border-base-300 bg-base-200/40 p-4">
        <div class="mb-4">
          <h2 class="text-lg font-semibold">{{ l("关于页面内容", "About Page Content") }}</h2>
          <p class="text-xs text-base-content/50">{{ l("显示在前台 /about 页面，支持纯文本换行或少量 HTML。", "Displayed on /about. Plain text with line breaks or simple HTML is supported.") }}</p>
        </div>
        <div class="grid gap-4 md:grid-cols-2">
          <label class="flex flex-col gap-1.5">
            <span class="label-text font-medium">{{ l("关于内容（中文）", "About Content (Chinese)") }}</span>
            <textarea v-model="form.aboutPageZh" class="textarea textarea-bordered w-full" rows="8"></textarea>
          </label>
          <label class="flex flex-col gap-1.5">
            <span class="label-text font-medium">{{ l("关于内容（英文）", "About Content (English)") }}</span>
            <textarea v-model="form.aboutPageEn" class="textarea textarea-bordered w-full" rows="8"></textarea>
          </label>
        </div>
      </div>

      <div class="grid gap-4 md:grid-cols-2">
        <label class="flex flex-col gap-1.5">
          <span class="label-text font-medium">{{ l("客服联系方式", "Support Contacts") }}</span>
          <textarea v-model="form.supportContact" class="textarea textarea-bordered w-full" rows="3" :placeholder="l('格式：文字|链接（无链接直接填文字）\n例：联系客服|https://t.me/123\n例：邮件支持|mailto:support@example.com', 'Format: text|link. Plain text is also allowed.\nExample: Telegram|https://t.me/123\nExample: Email|mailto:support@example.com')"></textarea>
          <span class="text-xs text-base-content/50">{{ l("每行一条。纯文字直接填写；需要链接时用 | 分隔，格式：显示文字|链接地址", "One item per line. Use plain text, or split display text and URL with |.") }}</span>
        </label>
        <label class="flex flex-col gap-1.5">
          <span class="label-text font-medium">{{ l("页脚文案", "Footer Text") }}</span>
          <textarea v-model="form.footerText" class="textarea textarea-bordered w-full" rows="2" :placeholder="l('© 2026 xxxx 版权所有', '© 2026 Example. All rights reserved.')"></textarea>
        </label>
      </div>

      <label class="flex flex-col gap-1.5">
        <span class="label-text font-medium">{{ l("下单提示", "Order Notice") }}</span>
        <textarea v-model="form.orderNotice" class="textarea textarea-bordered w-full" rows="4"></textarea>
      </label>

      <div class="flex items-center gap-3">
        <AppButton variant="primary" :loading="saving" @click="handleSave">{{ l("保存设置", "Save Settings") }}</AppButton>
        <span v-if="errorMessage" class="text-sm text-error">{{ errorMessage }}</span>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import AppButton from "../../../components/AppButton.vue";
import { normalizeTelefuncError } from "../../../lib/app-error";
import { reactive, ref } from "vue";
import { useData } from "vike-vue/useData";
import { onSaveSiteSettings } from "./saveSiteSettings.telefunc";
import type { Data } from "./+data";
import { useI18n } from "../../../lib/client-i18n";

const { site } = useData<Data>();
const { l } = useI18n();

const form = reactive({
  siteName: site.siteName,
  siteUrl: site.siteUrl ?? "",
  siteSubtitle: site.siteSubtitle ?? "",
  logoIcon: site.logoIcon ?? "",
  logo: site.logo ?? "",
  notice: site.notice ?? "",
  noticePageZh: site.noticePageZh ?? "",
  noticePageEn: site.noticePageEn ?? "",
  aboutPageZh: site.aboutPageZh ?? "",
  aboutPageEn: site.aboutPageEn ?? "",
  supportContact: site.supportContact ?? "",
  footerText: site.footerText ?? "",
  orderNotice: site.orderNotice ?? "",
});

const saving = ref(false);
const saved = ref(false);
const errorMessage = ref("");

async function handleSave() {
  saving.value = true;
  saved.value = false;
  errorMessage.value = "";

  try {
    const result = await onSaveSiteSettings({ ...form });
    form.siteName = result.siteName;
    form.siteUrl = result.siteUrl ?? "";
    form.siteSubtitle = result.siteSubtitle ?? "";
    form.logoIcon = result.logoIcon ?? "";
    form.logo = result.logo ?? "";
    form.notice = result.notice ?? "";
    form.noticePageZh = result.noticePageZh ?? "";
    form.noticePageEn = result.noticePageEn ?? "";
    form.aboutPageZh = result.aboutPageZh ?? "";
    form.aboutPageEn = result.aboutPageEn ?? "";
    form.supportContact = result.supportContact ?? "";
    form.footerText = result.footerText ?? "";
    form.orderNotice = result.orderNotice ?? "";
    saved.value = true;
  } catch (error) {
    errorMessage.value = normalizeTelefuncError(error, l("保存失败", "Save failed"));
  } finally {
    saving.value = false;
  }
}
</script>
