import { BrowserWindow as e, app as t, ipcMain as n, shell as r } from "electron";
import { fileURLToPath as i } from "node:url";
import a from "node:path";
//#region electron/main/index.ts
var o = a.dirname(i(import.meta.url));
process.env.APP_ROOT = a.join(o, "../..");
var s = a.join(process.env.APP_ROOT, "dist-electron"), c = a.join(process.env.APP_ROOT, "dist");
process.env.VITE_PUBLIC = process.env.VITE_DEV_SERVER_URL ? a.join(process.env.APP_ROOT, "public") : c;
var l;
function u() {
	l = new e({
		width: 1200,
		height: 800,
		minWidth: 900,
		minHeight: 600,
		frame: !1,
		titleBarStyle: "hidden",
		trafficLightPosition: {
			x: 12,
			y: 10
		},
		backgroundColor: "#ffffff",
		webPreferences: {
			preload: a.join(o, "../preload/index.mjs"),
			sandbox: !1,
			nodeIntegration: !1,
			contextIsolation: !0,
			webSecurity: !0,
			allowRunningInsecureContent: !1
		}
	}), process.env.VITE_DEV_SERVER_URL ? l.loadURL(process.env.VITE_DEV_SERVER_URL) : l.loadFile(a.join(c, "index.html")), l.webContents.setWindowOpenHandler(({ url: e }) => (r.openExternal(e), { action: "deny" }));
}
t.whenReady().then(() => {
	n.handle("app:minimize", () => l?.minimize()), n.handle("app:maximize", () => l?.isMaximized() ? l?.unmaximize() : l?.maximize()), n.handle("app:close", () => t.quit()), n.handle("app:isMaximized", () => l?.isMaximized()), u(), t.on("activate", () => {
		e.getAllWindows().length === 0 && u();
	});
}), t.on("window-all-closed", () => {
	process.platform !== "darwin" && t.quit();
});
//#endregion
export { s as MAIN_DIST, c as RENDERER_DIST };
