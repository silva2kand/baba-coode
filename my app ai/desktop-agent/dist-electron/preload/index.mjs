import { contextBridge as e, ipcRenderer as t } from "electron";
//#region electron/preload/index.ts
e.exposeInMainWorld("electronAPI", {
	minimize: () => t.invoke("app:minimize"),
	maximize: () => t.invoke("app:maximize"),
	close: () => t.invoke("app:close"),
	isMaximized: () => t.invoke("app:isMaximized"),
	executeBash: (e) => t.invoke("tool:bash", e),
	readFile: (e) => t.invoke("tool:readFile", e),
	writeFile: (e, n) => t.invoke("tool:writeFile", e, n),
	listDir: (e) => t.invoke("tool:listDir", e),
	webFetch: (e) => t.invoke("tool:webFetch", e),
	getLocalProviders: () => t.invoke("providers:list"),
	connectProvider: (e, n) => t.invoke("providers:connect", e, n)
});
//#endregion
