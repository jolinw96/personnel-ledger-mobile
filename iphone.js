(() => {
  "use strict";
  const input = document.getElementById("backup-input");
  const notify = message => window.HR.notify(message);
  window.LocalFiles = {
    exportBackup(text) {
      try {
        const blob = new Blob([text], {type:"application/json"});
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.download = "人事台账-"+new Date().toISOString().replace(/[:.]/g,"-")+".json";
        link.href = url;
        document.body.appendChild(link);
        link.click();
        link.remove();
        setTimeout(() => URL.revokeObjectURL(url), 60000);
      } catch (_) {notify("导出失败，请检查手机可用空间后重试");}
    },
    importBackup() {
      input.value = "";
      input.click();
    }
  };
  input.addEventListener("change", () => {
    const file = input.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => window.onBackupFile(String(reader.result).replace(/^\uFEFF/,""));
    reader.onerror = () => notify("文件读取失败，请重新选择备份");
    reader.readAsText(file);
  });

  const status = document.getElementById("install-status");
  const help = document.getElementById("install-help");
  const hint = document.getElementById("install-hint");
  const retry = document.getElementById("retry-offline");
  const standalone = window.matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;
  const details = document.getElementById("install-details");
  const title = document.getElementById("guide-title");
  const applePhone = /iPhone|iPod|iPad/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const wechat = applePhone && /MicroMessenger/i.test(navigator.userAgent);
  const otherBrowser = applePhone && /CriOS|FxiOS|EdgiOS|DingTalk|\bQQ\//i.test(navigator.userAgent);
  const needSafari = !standalone && (wechat || otherBrowser);
  const inApp = document.getElementById("inapp-guide");
  const copyButton = document.getElementById("copy-install-url");
  const url = new URL("./", location.href).href;

  details.open = applePhone && !standalone;
  hint.classList.toggle("home-mode", standalone);
  title.textContent = standalone ? "本机台账" : "把人事台账放到桌面";
  document.getElementById("safari-guide").hidden = standalone || needSafari;
  inApp.hidden = !needSafari;
  if (needSafari) {
    document.getElementById("inapp-copy").textContent = wechat
      ? "点微信右上角的“···”，选“在浏览器打开”，再选择 Safari。也可以复制网址，粘贴到 Safari 的地址栏。"
      : "复制下方网址，打开 iPhone 上的 Safari，粘贴到地址栏后前往。";
  }
  copyButton.onclick = async () => {
    try {
      await navigator.clipboard.writeText(url);
      copyButton.textContent = "网址已复制，去 Safari 粘贴";
    } catch (_) {
      const field = document.getElementById("copy-field");
      field.value = url;
      field.hidden = false;
      field.focus();
      field.select();
      copyButton.textContent = "按住下方网址，选择复制";
    }
  };

  function problem(detail) {
    status.textContent = needSafari ? "请用 Safari 打开" : "离线资源未就绪";
    help.hidden = needSafari;
    help.textContent = detail;
    hint.dataset.ready = "false";
    retry.hidden = needSafari;
    document.getElementById("install-details").open = true;
  }
  async function prepare() {
    retry.hidden = true;
    if (!window.isSecureContext || !("serviceWorker" in navigator)) {
      problem("请用 Safari 打开有效 HTTPS 安装地址，或手机本机安装服务提供的 localhost 地址。");
      return;
    }
    try {
      const registration = await navigator.serviceWorker.register("./sw.js",{scope:"./"});
      function ready() {
        hint.dataset.ready = "true";
        status.textContent = standalone ? "可离线使用" : (needSafari ? "请用 Safari 打开" : "已准备好");
        help.hidden = !standalone;
        help.textContent = standalone ? "台账保存在这台手机。可在“本机数据”导出备份。" : "";
        retry.hidden = true;
      }
      // Check the resource inventory of the active worker, including after an offline restart.
      let attempt = 0;
      function verify(worker) {
        if (!worker) return;
        const current = ++attempt;
        const channel = new MessageChannel();
        const timer = setTimeout(() => {
          channel.port1.close();
          if (current === attempt) problem("请连接安装服务并重新准备离线资源。");
        },8000);
        channel.port1.onmessage = event => {
          clearTimeout(timer);
          channel.port1.close();
          if (current !== attempt) return;
          if (event.data && event.data.revision === "1.18-release-1" && event.data.complete) ready();
          else problem("离线资源需要更新。请连接安装服务，再点“重新准备”。");
        };
        worker.postMessage({type:"verify-shell"},[channel.port2]);
      }
      function track(worker) {
        if (!worker) return;
        const changed = () => {
          if (worker.state === "activated") verify(worker);
          else if (worker.state === "redundant" && !registration.active) problem("离线文件未完整保存，请连接安装服务后重新准备。");
        };
        worker.addEventListener("statechange",changed);
        changed();
      }
      navigator.serviceWorker.addEventListener("controllerchange",() => verify(navigator.serviceWorker.controller));
      registration.addEventListener("updatefound",() => track(registration.installing));
      if (registration.active) verify(registration.active);
      track(registration.installing || registration.waiting);
    } catch (_) {problem("无法保存离线资源。请确认安装服务可用，并检查手机可用空间。");}
  }
  retry.onclick = () => location.reload();
  prepare();
})();
