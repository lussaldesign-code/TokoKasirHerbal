const { contextBridge } = require('electron');

contextBridge.exposeInMainWorld('electronUpdater', {
  available: true
});
