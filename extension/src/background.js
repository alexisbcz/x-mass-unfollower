// Toolbar click: toggle the panel on an x.com tab, or open x.com if we're elsewhere.
chrome.action.onClicked.addListener(async (tab) => {
  const onX = tab.url && /^https:\/\/(x|twitter)\.com\//.test(tab.url);
  if (!onX) {
    const t = await chrome.tabs.create({ url: 'https://x.com/home#xmu' });
    return t;
  }
  await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    world: 'MAIN',
    func: () => (window.__XMU ? window.__XMU.toggle() : location.assign('https://x.com/home#xmu')),
  });
});
