declare const __GIT_HASH__: string;
declare const __APP_VERSION__: string;

import { Session } from "@auth/core/types";
import type { PrismaClient } from "./generated/prisma/client";
import type { getPublicSiteInfo } from "./modules/site/service";

declare global {
  namespace Vike {
    interface PageContext {
      session?: Session | null;
      prisma: PrismaClient;
      site?: Awaited<ReturnType<typeof getPublicSiteInfo>>;
      adminBase?: string;
    }
  }

  interface Window {
    turnstile?: {
      render: (container: HTMLElement, options: {
        sitekey: string;
        callback?: (token: string) => void;
        'error-callback'?: () => void;
        theme?: 'light' | 'dark';
        size?: 'normal' | 'compact';
      }) => string;
      reset: (widgetId: string) => void;
      remove: (widgetId: string) => void;
    };
  }
}

declare module "telefunc" {
  namespace Telefunc {
    interface Context {
      prisma: PrismaClient;
      session?: Session | null;
    }
  }
}

declare module "@auth/core/types" {
  interface Session {
    user?: Session["user"] & {
      id?: string;
      username?: string;
      role?: "admin";
    };
  }

  interface User {
    id?: string;
    username?: string;
    role?: "admin";
  }
}

export {};
