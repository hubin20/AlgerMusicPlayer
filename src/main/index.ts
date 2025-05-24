import { electronApp, optimizer } from '@electron-toolkit/utils';
import { app, ipcMain, nativeImage } from 'electron';
import { join } from 'path';

import type { Language } from '../i18n/main';
import i18n from '../i18n/main';
import { loadLyricWindow } from './lyric';
import { initializeConfig } from './modules/config';
import { initializeFileManager } from './modules/fileManager';
import { initializeFonts } from './modules/fonts';
import { initializeRemoteControl } from './modules/remoteControl';
import { initializeShortcuts, registerShortcuts } from './modules/shortcuts';
import { initializeStats, setupStatsHandlers } from './modules/statsService';
import { initializeTray, updateCurrentSong, updatePlayState, updateTrayMenu } from './modules/tray';
import { setupUpdateHandlers } from './modules/update';
import { createMainWindow, initializeWindowManager } from './modules/window';
import { startMusicApi } from './server';

// 导入所有图标
const iconPath = join(__dirname, '../../resources');
const icon = nativeImage.createFromPath(
  process.platform === 'darwin'
    ? join(iconPath, 'icon.icns')
    : join(iconPath, 'icon.png')
);

let mainWindow: Electron.BrowserWindow;
let isQuitting = false;

// 初始化应用
function initialize() {
  // 初始化配置管理
  const store = initializeConfig();

  // 设置初始语言
  const savedLanguage = store.get('set.language') as Language;
  if (savedLanguage) {
    i18n.global.locale = savedLanguage;
  }

  // 初始化文件管理
  initializeFileManager();
  // 初始化窗口管理
  initializeWindowManager();
  // 初始化字体管理
  initializeFonts();

  // 创建主窗口
  mainWindow = createMainWindow(icon);

  // 为主窗口添加 close 事件处理
  mainWindow.on('close', (event) => {
    if (!isQuitting) {
      event.preventDefault();
      mainWindow.hide();
    }
  });

  // 初始化托盘
  initializeTray(iconPath, mainWindow);

  // 初始化统计服务
  initializeStats();

  // 设置统计相关的IPC处理程序
  setupStatsHandlers(ipcMain);

  // 启动音乐API
  startMusicApi();

  // 加载歌词窗口
  loadLyricWindow(ipcMain, mainWindow);

  // 初始化快捷键
  initializeShortcuts(mainWindow);

  // 初始化远程控制服务
  initializeRemoteControl(mainWindow);

  // 初始化更新处理程序
  setupUpdateHandlers(mainWindow);
}

// 检查是否为第一个实例
const isSingleInstance = app.requestSingleInstanceLock();

if (!isSingleInstance) {
  app.quit();
} else {
  // 当第二个实例启动时，将焦点转移到第一个实例的窗口
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) {
        mainWindow.restore();
      }
      mainWindow.show();
      mainWindow.focus();
    }
  });

  // 应用程序准备就绪时的处理
  app.whenReady().then(() => {
    // 设置应用ID
    electronApp.setAppUserModelId('com.alger.music');

    // 监听窗口创建事件
    app.on('browser-window-created', (_, window) => {
      optimizer.watchWindowShortcuts(window);
    });

    // 初始化应用
    initialize();

    // macOS 激活应用时的处理
    app.on('activate', () => {
      if (mainWindow === null) initialize();
    });
  });

  // 监听快捷键更新
  ipcMain.on('update-shortcuts', () => {
    registerShortcuts(mainWindow);
  });

  // 监听语言切换
  ipcMain.on('change-language', (_, locale: Language) => {
    // 更新主进程的语言设置
    i18n.global.locale = locale;
    // 更新托盘菜单
    updateTrayMenu(mainWindow);
    // 通知所有窗口语言已更改
    mainWindow?.webContents.send('language-changed', locale);
  });

  // 监听播放状态变化
  ipcMain.on('update-play-state', (_, playing: boolean) => {
    updatePlayState(playing);
  });

  // 监听当前歌曲变化
  ipcMain.on('update-current-song', (_, song: any) => {
    updateCurrentSong(song);
  });

  // 所有窗口关闭时的处理
  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
      // 如果希望点击关闭按钮后，非isQuitting状态下不退出，则此处的app.quit()也应受isQuitting控制
      // 但由于主窗口的关闭已被拦截，此事件可能不会轻易触发导致退出
      // 如果确实需要，可以改为 if (!isQuitting) app.quit(); 或者完全移除/注释掉这一段以依赖托盘退出
      // 为确保后台运行，我们暂时不修改此处的原有逻辑，因为主窗口隐藏不会触发此事件。
      // 如果后续发现此逻辑干扰了后台运行，可以再调整。
      app.quit();
    }
  });

  // 在应用退出前设置标志
  app.on('before-quit', () => {
    isQuitting = true;
  });

  // 重启应用
  ipcMain.on('restart', () => {
    app.relaunch();
    app.exit(0);
  });

  // 获取系统架构信息
  ipcMain.on('get-arch', (event) => {
    event.returnValue = process.arch;
  });
}
