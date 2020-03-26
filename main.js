// Modules to control application life and create native browser window
const {app, BrowserWindow} = require('electron');
const path = require('path');

// Keep a global reference of the window object, if you don't, the window will
// be closed automatically when the JavaScript object is garbage collected.
let mainWindow, serve;
const args = process.argv.slice(1);
serve = args.some(val => val === '--serve');
debug = args.some(val => val === '--debug');

if (serve) {
    require('electron-reload')(__dirname, {});
}

function createWindow() {
    setTimeout(function() {
        let myScreen = require('electron').screen;
        // Create the browser window.
        mainWindow = new BrowserWindow({
            x:              myScreen.getPrimaryDisplay().workArea.x,
            y:              myScreen.getPrimaryDisplay().workArea.y,
            width:          myScreen.getPrimaryDisplay().workArea.width,
            height:         myScreen.getPrimaryDisplay().workArea.height,
            fullscreen:     !debug,
            kiosk:          false,
            frame:          debug,
            webPreferences: {
                nativeWindowOpen: true,
                preload:          path.join(__dirname, 'preload.js')
            }
        });

        var os = require("os");
        // and load the index.html of the app.
        console.log(os.hostname().toLowerCase());
        console.log(myScreen.getPrimaryDisplay().workArea.width);
        console.log(myScreen.getPrimaryDisplay().workArea.height);
        mainWindow.loadURL('http://' + os.hostname().toLowerCase() + ':4000/#');
        mainWindow.maximize();
        // Open the DevTools.
        // mainWindow.webContents.openDevTools();

        // Emitted when the window is closed.
        mainWindow.on('closed', function() {
            // Dereference the window object, usually you would store windows
            // in an array if your app supports multi windows, this is the time
            // when you should delete the corresponding element.
            mainWindow = null;
        });
    }, 30_000);
}

try {
    // This method will be called when Electron has finished
    // initialization and is ready to create browser windows.
    // Some APIs can only be used after this event occurs.
    app.on('ready', createWindow);

    // Quit when all windows are closed.
    app.on('window-all-closed', function() {
        // On macOS it is common for applications and their menu bar
        // to stay active until the user quits explicitly with Cmd + Q
        if (process.platform !== 'darwin') {
            app.quit();
        }
    });

    app.on('activate', function() {
        // On macOS it's common to re-create a window in the app when the
        // dock icon is clicked and there are no other windows open.
        if (mainWindow === null) {
            createWindow();
        }
    });
}
catch (e) {
}
