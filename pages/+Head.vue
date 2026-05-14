<template>
  <link rel="icon" :href="faviconUrl" />
  <script v-if="shouldLoadTurnstile" src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer></script>
</template>

<script setup lang="ts">
import "./tailwind.css";
import { computed } from "vue";
import { usePageContext } from "vike-vue/usePageContext";
import logoUrl from "../assets/logo.svg";

const pageContext = usePageContext();
const faviconUrl = computed(() => pageContext.site?.logoIcon || logoUrl);
const shouldLoadTurnstile = computed(() => {
  // 只在需要时加载 Turnstile 脚本
  return pageContext.site?.enableTurnstile && pageContext.site?.turnstileSiteKey;
});
</script>
