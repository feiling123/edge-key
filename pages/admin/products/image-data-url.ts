const MAX_IMAGE_BYTES = 1_500_000;

type Localize = (zh: string, en: string) => string;

export function createImageDataUrlMessages(l: Localize) {
  return {
    readFailed: l("图片读取失败。", "Failed to read image."),
    remoteNotImage: l("远程地址不是图片文件。", "The remote URL is not an image."),
    tooLarge: l("图片超过 1.5MB，请压缩后再上传。", "Image exceeds 1.5MB. Compress it before uploading."),
    remoteRequestFailed: (status: number) => l(`远程图片读取失败：HTTP ${status}`, `Remote image request failed: HTTP ${status}`),
  };
}

type ImageDataUrlMessages = ReturnType<typeof createImageDataUrlMessages>;

export function isRemoteImageUrl(value: string) {
  return /^https?:\/\//i.test(value);
}

export async function remoteImageToDataUrl(url: string, messages: ImageDataUrlMessages) {
  const response = await fetch(url, { mode: "cors", credentials: "omit" });
  if (!response.ok) {
    throw new Error(messages.remoteRequestFailed(response.status));
  }
  const blob = await response.blob();
  if (!blob.type.startsWith("image/")) {
    throw new Error(messages.remoteNotImage);
  }
  assertImageSize(blob.size, messages);
  return fileToDataUrl(blob, messages);
}

export function imageFileToDataUrl(file: File, messages: ImageDataUrlMessages) {
  if (!file.type.startsWith("image/")) {
    throw new Error(messages.remoteNotImage);
  }
  assertImageSize(file.size, messages);
  return fileToDataUrl(file, messages);
}

export function fileToDataUrl(file: Blob, messages: ImageDataUrlMessages) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error(messages.readFailed));
    reader.readAsDataURL(file);
  });
}

export function assertImageSize(size: number, messages: ImageDataUrlMessages) {
  if (size > MAX_IMAGE_BYTES) {
    throw new Error(messages.tooLarge);
  }
}
