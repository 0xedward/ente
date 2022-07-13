import {
    BrowserWindow,
    dialog,
    ipcMain,
    Tray,
    Notification,
    safeStorage,
} from 'electron';
import { createWindow } from './createWindow';
import { buildContextMenu } from './menuUtil';
import { logErrorSentry } from './sentry';
import { getFilesFromDir } from './upload';

export default function setupIpcComs(
    tray: Tray,
    mainWindow: BrowserWindow,
    HOST_URL: string
): void {
    ipcMain.handle('select-dir', async () => {
        const result = await dialog.showOpenDialog({
            properties: ['openDirectory'],
        });
        const dir =
            result.filePaths &&
            result.filePaths.length > 0 &&
            result.filePaths[0];
        return dir;
    });

    ipcMain.on('update-tray', (_, args) => {
        tray.setContextMenu(buildContextMenu(mainWindow, args));
    });

    ipcMain.on('send-notification', (_, args) => {
        const notification = {
            title: 'ente',
            body: args,
        };
        new Notification(notification).show();
    });
    ipcMain.on('reload-window', () => {
        const secondWindow = createWindow(HOST_URL);
        mainWindow.destroy();
        mainWindow = secondWindow;
    });

    ipcMain.handle('show-upload-files-dialog', async () => {
        const files = await dialog.showOpenDialog({
            properties: ['openFile', 'multiSelections'],
        });
        return files.filePaths;
    });

    ipcMain.handle('show-upload-zip-dialog', async () => {
        const files = await dialog.showOpenDialog({
            properties: ['openFile', 'multiSelections'],
            filters: [{ name: 'Zip File', extensions: ['zip'] }],
        });
        return files.filePaths;
    });

    ipcMain.handle('show-upload-dirs-dialog', async () => {
        const dir = await dialog.showOpenDialog({
            properties: ['openDirectory', 'multiSelections'],
        });

        let files: string[] = [];
        for (const dirPath of dir.filePaths) {
            files = files.concat(await getFilesFromDir(dirPath));
        }

        return files;
    });

    ipcMain.handle('log-error', (_, err, msg, info?) => {
        logErrorSentry(err, msg, info);
    });

    ipcMain.handle('safeStorage-encrypt', (_, message) => {
        return safeStorage.encryptString(message);
    });

    ipcMain.handle('safeStorage-decrypt', (_, message) => {
        return safeStorage.decryptString(message);
    });
}
