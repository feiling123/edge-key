<template>
  <section class="card bg-base-100 shadow-sm">
    <div class="card-body space-y-4">
      <div>
        <h1 class="text-2xl font-bold">{{ title }}</h1>
        <p class="text-sm text-base-content/70">{{ l("商品保存已接入真实数据库写入。", "Products are saved directly to the database.") }}</p>
      </div>

      <div class="grid gap-4 md:grid-cols-2">
        <label class="flex flex-col gap-1.5">
          <span class="label-text font-medium">{{ l("商品名称", "Product Name") }}</span>
          <input v-model="form.name" class="input input-bordered w-full" />
        </label>
        <label class="flex flex-col gap-1.5">
          <span class="label-text font-medium">Slug</span>
          <input v-model="form.slug" class="input input-bordered w-full" :placeholder="l('留空则自动生成', 'Leave empty to generate automatically')" />
        </label>
      </div>

      <div class="grid gap-4 md:grid-cols-3">
        <label class="flex flex-col gap-1.5">
          <span class="label-text font-medium">{{ l("分类", "Category") }}</span>
          <select v-model="form.categoryId" class="select select-bordered w-full">
            <option value="">{{ l("未分类", "Uncategorized") }}</option>
            <option v-for="category in categories" :key="category.id" :value="String(category.id)">
              {{ category.name }}
            </option>
          </select>
        </label>
        <label class="flex flex-col gap-1.5">
          <span class="label-text font-medium">{{ l("价格（分）", "Price (cents)") }}</span>
          <input v-model.number="form.price" type="number" min="0" class="input input-bordered w-full" />
        </label>
        <label class="flex flex-col gap-1.5">
          <span class="label-text font-medium">{{ l("状态", "Status") }}</span>
          <select v-model="form.status" class="select select-bordered w-full">
            <option value="ACTIVE">{{ l("上架", "Active") }}</option>
            <option value="INACTIVE">{{ l("下架", "Inactive") }}</option>
            <option value="DRAFT">{{ l("草稿", "Draft") }}</option>
          </select>
        </label>
      </div>

      <div class="grid gap-4 md:grid-cols-4">
        <label class="flex flex-col gap-1.5">
          <span class="label-text font-medium">{{ l("最小购买数", "Minimum Quantity") }}</span>
          <input v-model.number="form.minBuy" type="number" min="1" class="input input-bordered w-full" />
        </label>
        <label class="flex flex-col gap-1.5">
          <span class="label-text font-medium">{{ l("最大购买数", "Maximum Quantity") }}</span>
          <input v-model.number="form.maxBuy" type="number" min="1" class="input input-bordered w-full" />
        </label>
        <label class="flex flex-col gap-1.5">
          <span class="label-text font-medium">{{ l("排序", "Sort") }}</span>
          <input v-model.number="form.sort" type="number" class="input input-bordered w-full" />
        </label>
        <label class="flex flex-col gap-1.5">
          <span class="label-text font-medium">{{ l("价格预览", "Price Preview") }}</span>
          <div class="input input-bordered w-full flex items-center text-sm text-base-content/70">{{ formatCents(form.price || 0) }}</div>
        </label>
      </div>

      <div class="grid gap-4 md:grid-cols-2">
        <label class="flex flex-col gap-1.5">
          <span class="label-text font-medium">{{ l("副标题", "Subtitle") }}</span>
          <input v-model="form.subtitle" class="input input-bordered w-full" />
        </label>
        <div class="flex flex-col gap-1.5">
          <span class="label-text font-medium">{{ l("商品封面（图片链接，可上传转 Base64）", "Cover Image (URL, upload converts to Base64)") }}</span>
          <div class="flex gap-2 max-sm:flex-col">
            <input
              v-model="form.coverImage"
              class="input input-bordered w-full"
              :placeholder="l('可填写 https://... / data:image/...，或点上传', 'Enter https://... / data:image/... or upload')"
            />
            <input ref="coverFileInputRef" type="file" accept="image/*" class="hidden" @change="handleCoverImageFile" />
            <AppButton variant="outline" :loading="coverImageBusy" :disabled="coverImageBusy" @click="openCoverImagePicker">
              {{ coverImageBusy ? l("处理中...", "Processing...") : l("上传并转 Base64", "Upload to Base64") }}
            </AppButton>
            <AppButton
              variant="outline"
              :loading="coverImageBusy"
              :disabled="coverImageBusy || !isRemoteCoverImage"
              @click="convertRemoteCoverImage"
            >
              {{ coverImageBusy ? l("处理中...", "Processing...") : l("转为 Base64", "Convert to Base64") }}
            </AppButton>
          </div>
          <p class="text-xs text-base-content/60">
            {{
              l(
                "编辑商品时可保留原图片链接；选择本地图片会立即转为 Base64，保存商品后生效。远程链接仍可手动转为 Base64。",
                "When editing, you can keep the existing image URL. Local uploads are converted to Base64 immediately and saved with the product. Remote URLs can still be converted manually.",
              )
            }}
          </p>
          <p v-if="coverImageMessage" class="text-xs" :class="coverImageMessageType === 'error' ? 'text-error' : 'text-success'">
            {{ coverImageMessage }}
          </p>
          <div v-if="form.coverImage" class="overflow-hidden rounded-box border border-base-300 bg-base-200">
            <img :src="form.coverImage" :alt="l('商品封面预览', 'Cover image preview')" class="max-h-48 w-full object-cover" />
          </div>
        </div>
      </div>

      <div class="flex flex-col gap-1.5">
        <span class="label-text font-medium">{{ l("商品描述", "Description") }}</span>
        <RichTextEditor v-model="form.description" />
      </div>

      <label class="flex flex-col gap-1.5">
        <span class="label-text font-medium">{{ l("购买须知", "Purchase Note") }}</span>
        <textarea v-model="form.purchaseNote" class="textarea textarea-bordered w-full" rows="4"></textarea>
      </label>

      <div class="flex items-center gap-3">
        <AppButton variant="primary" :loading="saving" @click="handleSave">{{ l("保存商品", "Save Product") }}</AppButton>
        <AppButton :href="adminHref('/admin/products')" variant="ghost">{{ l("返回列表", "Back to List") }}</AppButton>
        <span v-if="saved" class="badge badge-success">{{ l("已保存", "Saved") }}</span>
        <span v-if="errorMessage" class="text-sm text-error">{{ errorMessage }}</span>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { normalizeTelefuncError } from "../../../lib/app-error";
import { computed, reactive, ref } from "vue";
import AppButton from "../../../components/AppButton.vue";
import { formatCents } from "../../../lib/utils/money";
import RichTextEditor from "./RichTextEditor.vue";
import { onSaveProduct } from "./saveProduct.telefunc";
import { createProductFormState, type ProductFormState } from "./form";
import { useAdminPath } from "../../../lib/client-admin-path";
import { useI18n } from "../../../lib/client-i18n";
import { createImageDataUrlMessages, imageFileToDataUrl, isRemoteImageUrl, remoteImageToDataUrl } from "./image-data-url";

const props = defineProps<{
  title: string;
  categories: Array<{ id: number; name: string }>;
  initialValue?: Partial<ProductFormState>;
}>();

const form = reactive(createProductFormState(props.initialValue));
const { adminHref } = useAdminPath();
const { l } = useI18n();
const saving = ref(false);
const saved = ref(false);
const errorMessage = ref("");
const coverFileInputRef = ref<HTMLInputElement | null>(null);
const coverImageBusy = ref(false);
const coverImageMessage = ref("");
const coverImageMessageType = ref<"success" | "error">("success");
const isRemoteCoverImage = computed(() => isRemoteImageUrl(form.coverImage.trim()));

function openCoverImagePicker() {
  coverFileInputRef.value?.click();
}

async function handleCoverImageFile(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = Array.from(input.files ?? []).find((item) => item.type.startsWith("image/"));
  input.value = "";

  if (!file) {
    setCoverImageMessage(l("请选择图片文件。", "Choose an image file."), "error");
    return;
  }

  coverImageBusy.value = true;
  clearCoverImageMessage();

  try {
    form.coverImage = await imageFileToDataUrl(file, createImageDataUrlMessages(l));
    setCoverImageMessage(l(`本地图片「${file.name}」已转为 Base64。`, `Local image "${file.name}" converted to Base64.`), "success");
  } catch (error) {
    setCoverImageMessage(error instanceof Error ? error.message : l("图片处理失败", "Image processing failed"), "error");
  } finally {
    coverImageBusy.value = false;
  }
}

async function convertRemoteCoverImage() {
  const url = form.coverImage.trim();
  if (!isRemoteImageUrl(url)) {
    setCoverImageMessage(l("请先填写远程图片地址。", "Enter a remote image URL first."), "error");
    return;
  }

  coverImageBusy.value = true;
  clearCoverImageMessage();

  try {
    form.coverImage = await remoteImageToDataUrl(url, createImageDataUrlMessages(l));
    setCoverImageMessage(l("远程图片已转为 Base64。", "Remote image converted to Base64."), "success");
  } catch (error) {
    setCoverImageMessage(error instanceof Error ? error.message : l("图片处理失败", "Image processing failed"), "error");
  } finally {
    coverImageBusy.value = false;
  }
}

function clearCoverImageMessage() {
  coverImageMessage.value = "";
}

function setCoverImageMessage(message: string, type: "success" | "error") {
  coverImageMessage.value = message;
  coverImageMessageType.value = type;
}

async function handleSave() {
  saving.value = true;
  saved.value = false;
  errorMessage.value = "";

  try {
    const result = await onSaveProduct({
      id: form.id,
      categoryId: form.categoryId ? Number(form.categoryId) : null,
      name: form.name,
      slug: form.slug,
      subtitle: form.subtitle,
      coverImage: form.coverImage,
      description: form.description,
      price: form.price,
      status: form.status,
      minBuy: form.minBuy,
      maxBuy: form.maxBuy,
      sort: form.sort,
      purchaseNote: form.purchaseNote,
    });

    form.id = result.id;
    form.categoryId = result.categoryId ? String(result.categoryId) : "";
    form.name = result.name;
    form.slug = result.slug;
    form.subtitle = result.subtitle ?? "";
    form.coverImage = result.coverImage ?? "";
    form.description = result.description ?? "";
    form.price = result.price;
    form.status = result.status;
    form.minBuy = result.minBuy;
    form.maxBuy = result.maxBuy;
    form.sort = result.sort;
    form.purchaseNote = result.purchaseNote ?? "";
    saved.value = true;
  } catch (error) {
    errorMessage.value = normalizeTelefuncError(error, l("保存失败", "Save failed"));
  } finally {
    saving.value = false;
  }
}
</script>
