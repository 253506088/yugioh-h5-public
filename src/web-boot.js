(function () {
  'use strict';
  performance.mark('boot-start');
  const language = (() => { try { return localStorage.getItem('duel-sanctuary-language-v1') || 'zh-CN'; } catch { return 'zh-CN'; } })();
  const tr = (zh, en, ja) => language === 'en' ? en : language === 'ja' ? ja : zh;
  let loading,actionSerial=0;
  const translations=__HOME_TRANSLATIONS__,originalNodes=new Map();
  if(language!=='zh-CN'){const walker=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT);let node;const keys=Object.keys(translations).sort((a,b)=>b.length-a.length);while((node=walker.nextNode())){if(node.parentElement.closest('script,style,svg'))continue;const before=node.nodeValue;let value=before;for(const key of keys)if(translations[key][language])value=value.split(key).join(translations[key][language]);if(value!==before){originalNodes.set(node,before);node.nodeValue=value;}}document.documentElement.lang=language;}
  async function activate(action) {
    const request=++actionSerial;
    if (!loading) {
      const status = document.createElement('div');
      status.className = 'web-loading'; status.setAttribute('role', 'status');
      status.textContent = tr('正在准备决斗…', 'Preparing your duel…', 'デュエルを準備中…');
      document.body.append(status);
      loading = import(new URL('__LOADER_URL__', document.baseURI).href).then(() => {for(const [node,text]of originalNodes)if(node.isConnected)node.nodeValue=text;return DuelWeb.start('__MANIFEST_URL__');}).then(() => {
        document.removeEventListener('click', handle, true); status.remove(); document.body.classList.remove('web-booting');
      }).catch(error => { status.textContent = tr('加载失败，请检查网络后刷新。', 'Could not load. Check your connection and reload.', '読込に失敗しました。接続を確認して再読込してください。'); console.error(error); throw error; });
    }
    try {
      await loading;if(request!==actionSerial)return;
      const button = document.querySelector('[data-action="' + action + '"]');
      if (button) button.click();
    } catch {}
  }
  function handle(event) {
    const button = event.target.closest('[data-action]');
    if (!button) return;
    event.preventDefault(); event.stopImmediatePropagation(); activate(button.dataset.action);
  }
  document.addEventListener('click', handle, true);
  document.documentElement.dataset.bootReady = 'true';
  performance.mark('home-interactive');
  if (location.hash === '#arena') activate('tournament');
  else if (location.hash.startsWith('#pvp')) activate('pvp');
})();
