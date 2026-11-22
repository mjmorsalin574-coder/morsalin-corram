import { App as CapApp } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { useEffect, useState } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

export function isAndroidNative(): boolean {
  try {
    return Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android';
  } catch {
    return false;
  }
}

export function useAndroidLifecycle(
  onBackPress: () => boolean,
  onBackground?: () => void,
  onForeground?: () => void
) {
  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') {
        onBackground?.();
      } else {
        onForeground?.();
      }
    };
    document.addEventListener('visibilitychange', onVisibility);

    if (!Capacitor.isNativePlatform()) {
      return () => {
        document.removeEventListener('visibilitychange', onVisibility);
      };
    }

    let removed = false;
    let backHandle: { remove: () => Promise<void> } | null = null;
    let stateHandle: { remove: () => Promise<void> } | null = null;

    CapApp.addListener('backButton', () => {
      const handled = onBackPress();
      if (!handled) {
        CapApp.exitApp().catch(() => {});
      }
    })
      .then((handle) => {
        if (removed) handle.remove();
        else backHandle = handle;
      })
      .catch(() => {});

    CapApp.addListener('appStateChange', ({ isActive }) => {
      if (!isActive) {
        onBackground?.();
      } else {
        onForeground?.();
      }
    })
      .then((handle) => {
        if (removed) handle.remove();
        else stateHandle = handle;
      })
      .catch(() => {});

    return () => {
      removed = true;
      document.removeEventListener('visibilitychange', onVisibility);
      backHandle?.remove().catch(() => {});
      stateHandle?.remove().catch(() => {});
    };
  }, [onBackPress, onBackground, onForeground]);
}

export function usePWAInstall() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    if (isAndroidNative()) {
      setIsInstalled(true);
      return;
    }

    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true;
    setIsInstalled(isStandalone);

    const ua = window.navigator.userAgent.toLowerCase();
    setIsIOS(/iphone|ipad|ipod/.test(ua));

    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    const handleInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);
    window.addEventListener('appinstalled', handleInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
      window.removeEventListener('appinstalled', handleInstalled);
    };
  }, []);

  const install = async () => {
    if (!deferredPrompt) return false;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setIsInstalled(true);
      setDeferredPrompt(null);
      return true;
    }
    return false;
  };

  return {
    isInstallable: !!deferredPrompt,
    isInstalled,
    isIOS,
    install,
  };
}

export function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );

  useEffect(() => {
    const onOnline = () => setIsOnline(true);
    const onOffline = () => setIsOnline(false);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);

  return isOnline;
}
