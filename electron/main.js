const { app, BrowserWindow } = require("electron");
const { spawn } = require("child_process");
const path = require("path");

let splashWindow = null;
let mainWindow = null;
let backend = null;

const isDev = !app.isPackaged;

// ─────────────────────────────────────────────
// Start Python Backend
// ─────────────────────────────────────────────

function startBackend() {
    console.log("Starting backend...");

    backend = spawn(
        "python",
        [
            "-m",
            "uvicorn",
            "app.main:app",
            "--host",
            "127.0.0.1",
            "--port",
            "8000"
        ],
        {
            cwd: path.join(__dirname, ".."),
            shell: true,
            windowsHide: true
        }
    );

    backend.stdout.on("data", (data) => {
        console.log("[BACKEND]", data.toString());
    });

    backend.stderr.on("data", (data) => {
        console.log("[BACKEND]", data.toString());
    });

    backend.on("close", (code) => {
        console.log("Backend exited:", code);
    });

    backend.on("error", (error) => {
        console.error("Backend failed to start:", error);
    });
}

// ─────────────────────────────────────────────
// Splash Screen
// ─────────────────────────────────────────────

function createSplash() {
    console.log("Creating splash screen...");

    splashWindow = new BrowserWindow({
        width: 600,
        height: 400,

        frame: false,
        resizable: false,
        movable: false,

        center: true,
        alwaysOnTop: true,

        show: true,

        backgroundColor: "#0B1120",

        webPreferences: {
            contextIsolation: true,
            nodeIntegration: false
        }
    });

    splashWindow.loadFile(
        path.join(__dirname, "splash.html")
    );

    splashWindow.once("ready-to-show", () => {
        if (splashWindow) {
            splashWindow.show();
        }
    });
}

// ─────────────────────────────────────────────
// Main Window
// ─────────────────────────────────────────────

function createMainWindow() {
    console.log("Creating main window...");

    mainWindow = new BrowserWindow({
        width: 1600,
        height: 900,

        minWidth: 1200,
        minHeight: 700,

        show: false,

        backgroundColor: "#0B1120",

        autoHideMenuBar: true,

        webPreferences: {
            preload: path.join(__dirname, "preload.js"),
            contextIsolation: true,
            nodeIntegration: false
        }
    });

    if (isDev) {
        console.log("Loading frontend from Vite...");

        mainWindow.loadURL("http://localhost:5173");

        mainWindow.webContents.once("did-finish-load", () => {
            console.log("Frontend loaded.");

            showMainWindow();
        });

    } else {
        console.log("Loading packaged frontend...");

        mainWindow.loadFile(
            path.join(
                __dirname,
                "..",
                "frontend",
                "dist",
                "index.html"
            )
        );

        mainWindow.webContents.once("did-finish-load", () => {
            showMainWindow();
        });
    }

    mainWindow.webContents.on("did-fail-load", (event, errorCode, errorDescription) => {
        console.error(
            "Frontend failed to load:",
            errorCode,
            errorDescription
        );
    });
}

// ─────────────────────────────────────────────
// Show Main Window
// ─────────────────────────────────────────────

function showMainWindow() {
    console.log("Showing main window...");

    if (splashWindow && !splashWindow.isDestroyed()) {
        splashWindow.close();
        splashWindow = null;
    }

    if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.show();
        mainWindow.focus();
    }
}

// ─────────────────────────────────────────────
// App Startup
// ─────────────────────────────────────────────

app.whenReady().then(() => {
    console.log("Electron ready.");

    // Splash FIRST
    createSplash();

    // Backend starts in background
    startBackend();

    // Frontend loads independently
    createMainWindow();
});

// ─────────────────────────────────────────────
// Window Closed
// ─────────────────────────────────────────────

app.on("window-all-closed", () => {
    if (backend) {
        backend.kill();
        backend = null;
    }

    if (process.platform !== "darwin") {
        app.quit();
    }
});

// ─────────────────────────────────────────────
// Before Quit
// ─────────────────────────────────────────────

app.on("before-quit", () => {
    if (backend) {
        backend.kill();
        backend = null;
    }
});