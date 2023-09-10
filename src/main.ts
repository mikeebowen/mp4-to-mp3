import { app, BrowserWindow, dialog, ipcMain, webContents, ipcRenderer } from 'electron';
import { join, parse, basename } from 'path';
import { lstat, readdir } from 'fs/promises'
import * as Ffmpeg from 'fluent-ffmpeg';

let mainWindow: BrowserWindow;

async function createWindow() {
  // Create the browser window.
  mainWindow = new BrowserWindow({
    height: 300,
    width: 500,
    webPreferences: {
      preload: join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true
    },
  });

  // and load the index.html of the app.
  mainWindow.loadFile(join(__dirname, '../index.html'));
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(() => {
  createWindow();

  app.on('activate', async function () {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.
ipcMain.on('select-dirs', async function (event, arg) {
  const js = 'document.getElementById("icn").classList.remove("js-spin")';
  await mainWindow.webContents.executeJavaScript(js);
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory', 'openFile', 'multiSelections'],
    filters: [{ name: 'Mp4', extensions: ['mp4'] }],
  });

  if (!result.canceled) {
    try {
      const path = result.filePaths[0];
      const pathStats = await lstat(path);
      const mp3s = [];

      if (pathStats.isDirectory()) {
        const files = (await readdir(path)).filter(f => f.endsWith('mp4'));

        for (const file of files) {
          mp3s.push(`<p>${(await convertMp4ToMp3(file, path))}</p>`);
        }
      } else if (pathStats.isFile()) {
        for (const file of result.filePaths) {
          mp3s.push(`<p>${(await convertMp4ToMp3(basename(file), parse(file).dir))}</p>`);
        }
      }
      const ps = mp3s.join('');
      const code = `
    document.getElementById("icn").classList.add("js-spin");
    document.getElementById("list").innerHTML = "<h2>Created</h2>${ps}"`;
      await mainWindow.webContents.executeJavaScript(code);
    } catch (err: any) {
      dialog.showErrorBox('Something went wrong', err?.message ?? err);
    }
  } else {
    mainWindow.webContents.executeJavaScript('document.getElementById("icn").classList.add("js-spin")');
  }
});

function convertMp4ToMp3(file: string, path: string): string {
  const newFileName = `${parse(file).name}.mp3`;
  const newPath = join(path, newFileName);
  Ffmpeg(join(path, file))
    .toFormat('mp3')
    .on('end', () => console.log('Conversion Done !'))
    .on('error', (err: any) => dialog.showErrorBox('Something went wrong', err?.message ?? err))
    .saveToFile(newPath);

  return newFileName;
}

