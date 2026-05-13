<template>
  <slot v-if="isLoginPage" />

  <div v-else-if="needsLogin" class="flex min-h-screen items-center justify-center bg-base-200 px-4">
    <section class="card w-full max-w-md bg-base-100 shadow-sm">
      <div class="card-body space-y-4 text-center">
        <h1 class="text-2xl font-bold">{{ l("需要管理员登录", "Admin Login Required") }}</h1>
        <p class="text-sm text-base-content/70">{{ l("正在跳转到后台登录页，如果没有自动跳转，请手动点击下面按钮。", "Redirecting to the admin login page. If it does not redirect automatically, use the button below.") }}</p>
        <AppButton variant="primary" :href="`${adminBase}/login?redirect=${encodeURIComponent(publicCurrentPath)}`">{{ l("前往登录", "Go to Login") }}</AppButton>
      </div>
    </section>
  </div>

  <div
    v-else
    class="drawer lg:drawer-open min-h-screen bg-base-200"
    @click.capture="handleAdminRouteClick"
    @submit.capture="handleAdminFormSubmit"
  >
    <input id="admin-drawer" type="checkbox" class="drawer-toggle" />
    <div class="drawer-content flex flex-col min-w-0">
      <div class="navbar bg-base-100 border-b border-base-300 w-full lg:hidden sticky top-0 z-40 shadow-sm">
        <div class="flex-none">
          <label for="admin-drawer" aria-label="open sidebar" class="btn btn-square btn-ghost">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" class="inline-block w-6 h-6 stroke-current"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16"></path></svg>
          </label>
        </div>
        <div class="flex-1 px-2 mx-2">
          <h1 class="text-lg font-bold text-primary">edgeKey</h1>
        </div>
      </div>

      <header class="hidden lg:flex items-center justify-between border-b border-base-300 bg-base-100 px-8 py-4 sticky top-0 z-30 shadow-sm">
        <div>
          <div class="breadcrumbs text-sm text-base-content/60 mt-0.5">
            <ul>
              <li><a :href="adminHref('/admin')">Home</a></li>
              <li v-if="breadcrumbs?.length > 0"><a :href="adminHref(breadcrumbs[0].href || '/admin')">{{ breadcrumbs[0].name }}</a>
              </li>
              <li v-if="breadcrumbs?.length > 1">{{ breadcrumbs[1].name }}</li>
            </ul>
          </div>
        </div>

        <ul class="menu menu-horizontal bg-base-200 rounded-box p-1 gap-1">
          <li class="z-50 px-2 py-1">
            <LanguageSwitcher />
          </li>
          <li class="tooltip tooltip-bottom z-50" :data-tip="l('切换主题', 'Toggle Theme')">
            <label class="swap swap-rotate px-3 py-2">
              <input type="checkbox" class="theme-controller" value="dark" />
              <svg class="swap-off h-5 w-5 fill-current" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M5.64,17l-.71.71a1,1,0,0,0,0,1.41,1,1,0,0,0,1.41,0l.71-.71A1,1,0,0,0,5.64,17ZM5,12a1,1,0,0,0-1-1H3a1,1,0,0,0,0,2H4A1,1,0,0,0,5,12Zm7-7a1,1,0,0,0,1-1V3a1,1,0,0,0-2,0V4A1,1,0,0,0,12,5ZM5.64,7.05a1,1,0,0,0,.7.29,1,1,0,0,0,.71-.29,1,1,0,0,0,0-1.41l-.71-.71A1,1,0,0,0,4.93,6.34Zm12,.29a1,1,0,0,0,.7-.29l.71-.71a1,1,0,1,0-1.41-1.41L17,5.64a1,1,0,0,0,0,1.41A1,1,0,0,0,17.66,7.34ZM21,11H20a1,1,0,0,0,0,2h1a1,1,0,0,0,0-2Zm-9,8a1,1,0,0,0-1,1v1a1,1,0,0,0,2,0V20A1,1,0,0,0,12,19ZM18.36,17A1,1,0,0,0,17,18.36l.71.71a1,1,0,0,0,1.41,0,1,1,0,0,0,0-1.41ZM12,6.5A5.5,5.5,0,1,0,17.5,12,5.51,5.51,0,0,0,12,6.5Zm0,9A3.5,3.5,0,1,1,15.5,12,3.5,3.5,0,0,1,12,15.5Z" /></svg>
              <svg class="swap-on h-5 w-5 fill-current" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M21.64,13a1,1,0,0,0-1.05-.14,8.05,8.05,0,0,1-3.37.73A8.15,8.15,0,0,1,9.08,5.49a8.59,8.59,0,0,1,.25-2A1,1,0,0,0,8,2.36,10.14,10.14,0,1,0,22,14.05,1,1,0,0,0,21.64,13Zm-9.5,6.69A8.14,8.14,0,0,1,7.08,5.22v.27A10.15,10.15,0,0,0,17.22,15.63a9.79,9.79,0,0,0,2.1-.22A8.11,8.11,0,0,1,12.14,19.73Z" /></svg>
            </label>
          </li>
          <li class="tooltip tooltip-bottom z-50" :data-tip="l('返回前台', 'Back to Storefront')">
            <a href="/">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
              </svg>
            </a>
          </li>
        </ul>
      </header>

      <main class="flex-1 p-4 lg:p-8">
        <div class="mx-auto max-w-7xl w-full">
          <slot />
        </div>
      </main>
    </div>

    <div class="drawer-side z-50">
      <label for="admin-drawer" aria-label="close sidebar" class="drawer-overlay"></label>
      <aside class="bg-base-100 min-h-screen w-72 flex flex-col border-r border-base-300 shadow-sm">
        <a
          :href="adminHref('/admin')"
          class="p-6 pb-2 flex items-center gap-2 hover:bg-base-200 transition-colors block"
        >
          <img :src="siteLogo" height="50" width="50" alt="logo" />
          <div>
            <div class="text-2xl font-black text-primary tracking-tight">EK Admin</div>
            <p class="text-xs font-medium text-base-content/50 mt-1 uppercase tracking-wider">
              {{ l("全球部署，一触即达。", "Global deployment, instant delivery.") }}
            </p>
          </div>
        </a>

        <div class="p-4 flex-1 overflow-y-auto">
          <ul class="menu menu-md w-full gap-1 p-0">
            <li><a :href="adminHref('/admin')" :class="{'active': currentPath === '/admin'}">{{ l("仪表盘", "Dashboard") }}</a></li>
            <li><a :href="adminHref('/admin/categories')" :class="{'active': currentPath?.startsWith('/admin/categories')}">{{ l("分类管理", "Categories") }}</a></li>
            <li><a :href="adminHref('/admin/products')" :class="{'active': currentPath?.startsWith('/admin/products')}">{{ l("商品管理", "Products") }}</a></li>
            <li><a :href="adminHref('/admin/blog')" :class="{'active': currentPath?.startsWith('/admin/blog')}">{{ l("博客管理", "Blog") }}</a></li>
            <li><a :href="adminHref('/admin/cards')" :class="{'active': currentPath?.startsWith('/admin/cards')}">{{ l("卡密管理", "Cards") }}</a></li>
            <li><a :href="adminHref('/admin/orders')" :class="{'active': currentPath?.startsWith('/admin/orders')}">{{ l("订单管理", "Orders") }}</a></li>
            <li><a :href="adminHref('/admin/payments')" :class="{'active': currentPath?.startsWith('/admin/payments')}">{{ l("支付配置", "Payments") }}</a></li>
            <li><a :href="adminHref('/admin/notify')" :class="{'active': currentPath?.startsWith('/admin/notify')}">{{ l("Telegram 通知", "Telegram") }}</a></li>
            <li><a :href="adminHref('/admin/settings')" :class="{'active': currentPath?.startsWith('/admin/settings')}">{{ l("站点设置", "Settings") }}</a></li>
            <li><a :href="adminHref('/admin/profile')" :class="{'active': currentPath?.startsWith('/admin/profile')}">{{ l("个人资料", "Profile") }}</a></li>
          </ul>
        </div>

        <div class="p-4 border-t border-base-300 mt-auto space-y-2">
          <AppButton variant="outline" block @click="handleSignOut">{{ l("退出登录", "Sign Out") }}</AppButton>
          <div class="flex items-center justify-between text-xs text-base-content/50 px-2">
            <a class="cursor-default" href="#">edgeKey</a>
            <div>v{{ appVersion }}-{{ gitHash }}</div>
          </div>
        </div>
      </aside>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted } from "vue";
import AppButton from "../../components/AppButton.vue";
import LanguageSwitcher from "../../components/LanguageSwitcher.vue";
import { useI18n } from "../../lib/client-i18n";
import { usePageContext } from "vike-vue/usePageContext";

import logoUrl from "../../assets/logo.svg";

const pageContext = usePageContext();
const { l } = useI18n();

const currentPath = computed(() => pageContext.urlPathname ?? "");
const adminBase = computed(() => pageContext.adminBase || "/admin");
const publicCurrentPath = computed(() => adminHref(currentPath.value));
const gitHash = __GIT_HASH__;
const appVersion = __APP_VERSION__;

async function handleSignOut() {
  const form = document.createElement("form");
  form.method = "POST";
  form.action = "/api/auth/signout";
  const csrf = document.createElement("input");
  csrf.type = "hidden";
  csrf.name = "csrfToken";
  const token = await fetch("/api/auth/csrf").then(r => r.json()).then((d: any) => d.csrfToken);
  csrf.value = token;
  form.appendChild(csrf);
  document.body.appendChild(form);
  form.submit();
}
const isLoginPage = computed(() => (pageContext.urlPathname ?? "") === "/admin/login");
const isAdminUser = computed(() => pageContext.session?.user?.role === "admin");
const needsLogin = computed(() => !isLoginPage.value && !isAdminUser.value);
const siteLogo = computed(() => pageContext.site?.logo || logoUrl);

type Crumb = { name: string; href?: string };
type CrumbKey = "products" | "newProduct" | "editProduct" | "blog" | "orders" | "orderDetail" | "categories" | "cards" | "payments" | "notify" | "settings" | "security" | "profile";
type RouteCrumb = { key: CrumbKey; href?: string };

const BREADCRUMB_ROUTES: { pattern: string; crumbs: RouteCrumb[] }[] = [
  { pattern: "/admin/products/new",      crumbs: [{ key: "products", href: "/admin/products" }, { key: "newProduct" }] },
  { pattern: "/admin/products/:id/edit", crumbs: [{ key: "products", href: "/admin/products" }, { key: "editProduct" }] },
  { pattern: "/admin/products",          crumbs: [{ key: "products" }] },
  { pattern: "/admin/blog",              crumbs: [{ key: "blog" }] },
  { pattern: "/admin/orders/:id",        crumbs: [{ key: "orders", href: "/admin/orders" }, { key: "orderDetail" }] },
  { pattern: "/admin/orders",            crumbs: [{ key: "orders" }] },
  { pattern: "/admin/categories",        crumbs: [{ key: "categories" }] },
  { pattern: "/admin/cards",             crumbs: [{ key: "cards" }] },
  { pattern: "/admin/payments",          crumbs: [{ key: "payments" }] },
  { pattern: "/admin/notify",            crumbs: [{ key: "notify" }] },
  { pattern: "/admin/settings",          crumbs: [{ key: "settings" }] },
  { pattern: "/admin/security",          crumbs: [{ key: "security" }] },
  { pattern: "/admin/profile",           crumbs: [{ key: "profile" }] },
];

const crumbLabels: Record<CrumbKey, [string, string]> = {
  products: ["商品管理", "Products"],
  newProduct: ["新建商品", "New Product"],
  editProduct: ["编辑商品", "Edit Product"],
  blog: ["博客管理", "Blog"],
  orders: ["订单管理", "Orders"],
  orderDetail: ["订单详情", "Order Detail"],
  categories: ["分类管理", "Categories"],
  cards: ["卡密管理", "Cards"],
  payments: ["支付配置", "Payments"],
  notify: ["Telegram 通知", "Telegram"],
  settings: ["站点设置", "Settings"],
  security: ["安全配置", "Security"],
  profile: ["个人资料", "Profile"],
};

function matchRoute(pattern: string, path: string) {
  const re = new RegExp("^" + pattern.replace(/:[^/]+/g, "[^/]+") + "(/.*)?$");
  return re.test(path);
}

const breadcrumbs = computed((): Crumb[] => {
  const path = currentPath.value ?? "";
  const route = BREADCRUMB_ROUTES.find(r => matchRoute(r.pattern, path));
  return route ? route.crumbs.map((crumb) => {
    const [zh, en] = crumbLabels[crumb.key];
    return { name: l(zh, en), href: crumb.href };
  }) : [];
});

onMounted(() => {
  if (needsLogin.value) {
    window.location.href = `${adminBase.value}/login?redirect=${encodeURIComponent(publicCurrentPath.value)}`;
  }
});

function adminHref(path = "/admin") {
  const base = adminBase.value || "/admin";
  if (!path || path === "/admin") return base;
  if (path.startsWith("/admin/")) return `${base}${path.slice("/admin".length)}`;
  return path;
}

function adminRouteUrl(url: URL) {
  return `${adminHref(url.pathname)}${url.search}${url.hash}`;
}

function handleAdminRouteClick(event: MouseEvent) {
  if (adminBase.value === "/admin" || typeof window === "undefined") return;

  const target = event.target;
  if (!(target instanceof Element)) return;

  const anchor = target.closest<HTMLAnchorElement>('a[href^="/admin"]');
  if (!anchor || anchor.download) return;

  const url = new URL(anchor.href);
  if (url.origin !== window.location.origin) return;

  anchor.href = adminRouteUrl(url);
}

function handleAdminFormSubmit(event: SubmitEvent) {
  if (adminBase.value === "/admin" || typeof window === "undefined") return;

  const form = event.target;
  if (!(form instanceof HTMLFormElement)) return;

  const action = form.getAttribute("action");
  if (!action?.startsWith("/admin")) return;

  const url = new URL(form.action);
  if (url.origin !== window.location.origin) return;

  form.action = adminRouteUrl(url);
}
</script>
