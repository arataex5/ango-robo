import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import './index.css';
import App from './App.tsx';

// 再読み込み時に「アプリ内」の履歴マークが残っていたら消す（戻るボタンの誤動作防止）
if (history.state?.inApp) history.replaceState(null, '');

// PWA：新しい版があれば自動で更新（APK 内では Service Worker は使わない）
if (!('Capacitor' in window)) registerSW({ immediate: true });

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
