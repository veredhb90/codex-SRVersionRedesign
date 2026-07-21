(function() {
  var isOpen         = false;
  var isFullscreen   = false;
  var chatHistory    = [];
  var isTyping       = false;
  var currentStock   = null;
  var currentSessionId = null; // null = no session yet, 'NEW' = force new, ID = continue existing

  var pendingStockData = null;

  window.setChatStockContext = function(stockData) {
    // Don't auto-open chat. Just prepare context and show a subtle prompt bubble.
    pendingStockData = stockData;
    currentStock = null; // not yet loaded into chat until user opens it
    chatHistory  = [];
    showAskAiPrompt(stockData);
  };

  function loadPendingStockIntoChat() {
    if (!pendingStockData) return;
    var stockData = pendingStockData;
    currentStock = stockData;
    var statusEl = document.getElementById('sr-chat-status');
    if (statusEl) statusEl.textContent = 'Analyzing ' + stockData.symbol;
    var suggestEl = document.getElementById('sr-chat-suggestions');
    if (suggestEl) {
      var isBuy = stockData.direction === 'BUY';
      var dir = stockData.direction;
      var sym = stockData.symbol;
      var sc  = stockData.score > 0 ? '+' + stockData.score : String(stockData.score);
      suggestEl.innerHTML =
        '<button class="sr-sug" onclick="srSuggest(\'Why is ' + sym + ' a ' + dir + ' signal right now?\')">'+  (isBuy?'▲':'▼') + ' Why ' + dir + '?</button>' +
        '<button class="sr-sug" onclick="srSuggest(\'Explain each indicator for ' + sym + ' and why score is ' + sc + '\')">📊 Explain score</button>' +
        '<button class="sr-sug" onclick="srSuggest(\'Show me latest news with links for ' + sym + '\')">📰 News links</button>' +
        '<button class="sr-sug" onclick="srSuggest(\'What are the main risks for this ' + sym + ' trade?\')">🔍 Risks</button>' +
        '<button class="sr-sug" onclick="srSuggest(\'Who is the CEO of ' + sym + ' and what were last earnings?\')">🏢 Company info</button>';
    }
    var dir2 = stockData.direction === 'BUY' ? '▲ BUY' : '▼ SELL';
    var sc2  = stockData.score > 0 ? '+' + stockData.score : String(stockData.score);
    addMessage('ai',
      'Loaded full analysis for ' + stockData.symbol + ' @ $' + Number(stockData.price).toFixed(2) + '\n\n' +
      dir2 + ' | Score: ' + sc2 + '/24 | ' + stockData.confidence + ' Confidence\n' +
      'TP: $' + stockData.takeProfit + ' | SL: $' + stockData.stopLoss + ' | R:R 1:' + stockData.riskReward + '\n\n' +
      'Ask me anything — signals, news links, company info, risks, entry strategy!'
    );
    pendingStockData = null;
  }

  function showAskAiPrompt(stockData) {
    var old = document.getElementById('sr-ask-prompt');
    if (old) old.remove();
    var bubble = document.createElement('div');
    bubble.id = 'sr-ask-prompt';
    bubble.style.cssText = 'position:fixed; bottom:112px; right:26px; z-index:9999; background:#0d1f3c; color:#F5D061; padding:10px 16px; border-radius:20px; font-size:12.5px; font-weight:600; cursor:pointer; box-shadow:0 6px 20px rgba(0,0,0,0.35), 0 0 12px rgba(245,208,97,0.4); display:flex; align-items:center; gap:8px; animation:srMsgIn .3s ease;';
    bubble.innerHTML = '💬 Ask AI about ' + stockData.symbol + '<span style="opacity:0.6;font-size:11px;" onclick="event.stopPropagation();document.getElementById(\'sr-ask-prompt\').remove();">✕</span>';
    bubble.addEventListener('click', function() {
      bubble.remove();
      openChat();
      loadPendingStockIntoChat();
    });
    document.body.appendChild(bubble);
    var badge = document.getElementById('sr-chat-badge');
    if (badge) { badge.style.display = 'flex'; badge.textContent = '1'; }
    setTimeout(function() {
      var b = document.getElementById('sr-ask-prompt');
      if (b) b.remove();
    }, 15000);
  }

  var widget = document.createElement('div');
  widget.id = 'sr-chat-widget';
  widget.innerHTML = '<style>' +
    '#sr-chat-widget * { box-sizing:border-box; font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif; }' +
    '#sr-chat-btn { position:fixed; bottom:28px; right:28px; z-index:9999; width:84px; height:84px; border-radius:50%; border:none; cursor:pointer; background:transparent; filter:drop-shadow(0 0 8px rgba(245,208,97,0.9)) drop-shadow(0 0 22px rgba(245,208,97,0.5)); display:flex; align-items:center; justify-content:center; transition:all .3s; }' +
    '#sr-chat-btn:hover { transform:scale(1.1) translateY(-3px); box-shadow:0 0 25px rgba(66,165,245,1), 0 0 50px rgba(66,165,245,0.7), 0 0 80px rgba(66,165,245,0.35), inset 0 0 20px rgba(66,165,245,0.15); }' +
    '#sr-chat-pulse { position:absolute; inset:-5px; border-radius:50%; border:2px solid rgba(66,165,245,0.7); box-shadow:0 0 12px rgba(66,165,245,0.5); animation:srPulse 2.5s ease-out infinite; }' +
    '@keyframes srPulse { 0%{transform:scale(1);opacity:1} 100%{transform:scale(1.55);opacity:0} }' +
    '#sr-chat-badge { position:absolute; top:-4px; right:-4px; min-width:22px; height:22px; border-radius:11px; background:#F44336; color:#fff; font-size:11px; font-weight:700; display:none; align-items:center; justify-content:center; border:2.5px solid #fff; padding:0 4px; }' +
    '.srb{animation:srFloat 2.5s ease-in-out infinite}' +
    '.srwl{animation:srWL 1.3s ease-in-out infinite;transform-origin:52px 56px}' +
    '.srwr{animation:srWR 1.3s ease-in-out infinite;transform-origin:68px 56px}' +
    '@keyframes srFloat{0%,100%{transform:translateY(0)}50%{transform:translateY(-7px)}}' +
    '@keyframes srWL{0%,100%{transform:rotate(0)}50%{transform:rotate(-28deg)}}' +
    '@keyframes srWR{0%,100%{transform:rotate(0)}50%{transform:rotate(28deg)}}' +
    '#sr-chat-box { position:fixed; z-index:9998; display:none; flex-direction:column; border-radius:20px; overflow:hidden; box-shadow:0 32px 80px rgba(0,0,0,0.3); animation:srSlideUp .35s ease; }' +
    '#sr-chat-box.normal { bottom:114px; right:28px; width:420px; height:600px; max-height:calc(100vh - 130px); }' +
    '#sr-chat-box.fullscreen { bottom:32px; right:32px; left:32px; top:32px; width:calc(100vw - 64px); height:calc(100vh - 64px); border-radius:24px; background:rgba(255,255,255,0.97) !important; backdrop-filter:blur(20px); -webkit-backdrop-filter:blur(20px); }' +
    '@keyframes srSlideUp { from{opacity:0;transform:translateY(28px)} to{opacity:1;transform:translateY(0)} }' +
    '#sr-chat-header { background:#0D2244; padding:14px 18px; color:#fff; display:flex; align-items:center; gap:12px; flex-shrink:0; position:relative; }' + '#sr-chat-header::after { content:\'\'; position:absolute; bottom:-2px; left:0; right:0; height:2px; background:linear-gradient(90deg,#F5D061,#00E68C); box-shadow:0 0 8px rgba(0,230,140,0.5); }' +
    '#sr-chat-avatar { width:44px; height:44px; border-radius:50%; flex-shrink:0; background:rgba(245,208,97,0.15); display:flex; align-items:center; justify-content:center; border:1.5px solid rgba(245,208,97,0.3); box-shadow:0 0 16px rgba(245,208,97,0.4); }' +
    '#sr-chat-hinfo { flex:1; min-width:0; }' +
    '#sr-chat-title { font-size:15px; font-weight:700; }' +
    '#sr-chat-status { font-size:11px; color:#00FF8C; text-shadow:0 0 8px rgba(0,255,140,0.6); margin-top:2px; display:flex; align-items:center; gap:5px; }' +
    '#sr-chat-status::before { content:""; width:7px; height:7px; border-radius:50%; background:#4CAF50; display:inline-block; flex-shrink:0; animation:srBlink 2s infinite; }' +
    '@keyframes srBlink { 0%,100%{opacity:1} 50%{opacity:.35} }' +
    '.sr-header-btn { background:#1A3A6B; border:none; color:#DCE8F8; cursor:pointer; width:32px; height:32px; border-radius:8px; font-size:13px; display:flex; align-items:center; justify-content:center; flex-shrink:0; transition:background .2s; }' +
    '.sr-header-btn:hover { background:rgba(255,255,255,0.22); }' +
    '#sr-chat-messages { flex:1; overflow-y:auto; padding:18px 16px; background:#FFFDF8; display:flex; flex-direction:column; gap:14px; }' +
    '#sr-chat-messages::-webkit-scrollbar { width:4px; }' +
    '#sr-chat-messages::-webkit-scrollbar-thumb { background:rgba(13,71,161,0.2); border-radius:2px; }' +
    '.sr-msg { max-width:85%; display:flex; flex-direction:column; gap:4px; animation:srMsgIn .25s ease; }' +
    '@keyframes srMsgIn { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }' +
    '.sr-msg.user { align-self:flex-end; align-items:flex-end; }' +
    '.sr-msg.ai { align-self:flex-start; align-items:flex-start; }' +
    '.sr-msg-row { display:flex; align-items:flex-end; gap:8px; }' +
    '.sr-av-sm { width:28px; height:28px; border-radius:50%; background:#1565C0; display:flex; align-items:center; justify-content:center; flex-shrink:0; }' +
    '.sr-bubble { padding:12px 16px; font-size:13.5px; line-height:1.65; white-space:pre-wrap; word-break:break-word; }' +
    '.sr-msg.user .sr-bubble { background:#1565C0; color:#fff; border-radius:14px 14px 4px 14px; }' +
    '.sr-msg.ai .sr-bubble { background:#fff; color:#1A2540; border-radius:4px 14px 14px 14px; box-shadow:0 2px 12px rgba(180,140,40,0.06); border:1px solid #F0E6D2; cursor:text; user-select:text; }' +
    '.sr-bubble.sr-md { white-space:normal; }' +
    '.sr-bubble.sr-md h1, .sr-bubble.sr-md h2 { margin:12px 0 6px; color:#0D2244; font-size:15px; font-weight:800; border-bottom:1.5px solid #E3EEFF; padding-bottom:4px; }' +
    '.sr-bubble.sr-md h3 { margin:10px 0 5px; color:#0D2244; font-size:13.5px; font-weight:700; }' +
    '.sr-bubble.sr-md p { margin:6px 0; }' +
    '.sr-bubble.sr-md ul, .sr-bubble.sr-md ol { margin:6px 0; padding-left:20px; }' +
    '.sr-bubble.sr-md li { margin:3px 0; }' +
    '.sr-bubble.sr-md table { border-collapse:collapse; width:100%; margin:8px 0; font-size:12.5px; }' +
    '.sr-bubble.sr-md th { background:#EEF4FF; color:#0D2244; font-weight:700; text-align:left; padding:6px 9px; border:1px solid #D6E4F5; }' +
    '.sr-bubble.sr-md td { padding:6px 9px; border:1px solid #E3EEFF; }' +
    '.sr-bubble.sr-md tr:nth-child(even) td { background:#F8FAFF; }' +
    '.sr-bubble.sr-md strong { color:#0D47A1; }' +
    '.sr-bubble.sr-md hr { border:none; border-top:1px solid #E3EEFF; margin:10px 0; }' +
    '.sr-bubble.sr-md code { background:#EEF4FF; padding:1px 5px; border-radius:4px; font-size:12px; }' +
    '.sr-bubble.sr-md a { color:#1565C0; }' +
    '.sr-msg-time { font-size:10px; color:#94a3b8; padding:0 4px; }' +
    '#sr-selection-popup { position:fixed; z-index:10000; background:#1565C0; color:#fff; border-radius:20px; padding:6px 14px; font-size:12px; font-weight:600; cursor:pointer; box-shadow:0 4px 16px rgba(13,71,161,0.4); display:none; align-items:center; gap:6px; border:none; }' +
    '.sr-typing { display:flex; gap:5px; padding:14px 16px; background:#fff; border-radius:4px 18px 18px 18px; width:fit-content; box-shadow:0 2px 10px rgba(0,0,0,0.08); }' +
    '.sr-dot { width:8px; height:8px; border-radius:50%; background:#1565C0; animation:srBounce 1.4s ease infinite; opacity:.7; }' +
    '.sr-dot:nth-child(2){animation-delay:.2s} .sr-dot:nth-child(3){animation-delay:.4s}' +
    '@keyframes srBounce { 0%,60%,100%{transform:translateY(0)} 30%{transform:translateY(-9px);opacity:1} }' +
    '#sr-chat-suggestions { padding:10px 14px; display:flex; gap:6px; flex-wrap:wrap; background:rgba(255,255,255,0.65); border-top:1px solid rgba(227,238,255,0.8); flex-shrink:0; max-height:90px; overflow-y:auto; }' +
    '.sr-sug { padding:6px 13px; border-radius:20px; font-size:11.5px; font-weight:600; border:1px solid #F0E0B0; background:#FFFBF0; color:#92650C; cursor:pointer; transition:all .2s; white-space:nowrap; }' +
    '.sr-sug:hover { background:#1565C0; color:#fff; }' +
    '#sr-chat-input-row { padding:12px 14px; display:flex; gap:8px; align-items:flex-end; background:#FFFDF8; border-top:1px solid #F5EEDC; flex-shrink:0; }' +
    '#sr-chat-img-btn { width:36px; height:36px; border-radius:50%; border:1.5px solid #E3EEFF; background:#F5F8FF; cursor:pointer; display:flex; align-items:center; justify-content:center; font-size:16px; flex-shrink:0; transition:all .2s; }' +
    '#sr-chat-img-btn:hover { background:#EEF4FF; border-color:#1565C0; }' +
    '#sr-chat-input { flex:1; border:1px solid #F0E6D2; border-radius:18px; padding:11px 16px; font-size:13.5px; outline:none; resize:none; font-family:inherit; max-height:120px; background:#FFFBF0; color:#1A2540; transition:all .2s; line-height:1.5; }' +
    '#sr-chat-input:focus { border-color:#1565C0; background:#fff; box-shadow:0 0 0 3px rgba(21,101,192,0.1); }' +
    '#sr-chat-input::placeholder { color:#94a3b8; }' +
    '#sr-chat-send { width:44px; height:44px; border-radius:50%; border:none; cursor:pointer; background:#00C853; color:#fff; display:flex; align-items:center; justify-content:center; flex-shrink:0; font-size:18px; transition:background .2s; }' +
    '#sr-chat-send:disabled { background:#cbd5e1; cursor:not-allowed; }' +
    '#sr-img-preview { padding:8px 14px; background:rgba(255,255,255,0.65); border-top:1px solid rgba(227,238,255,0.8); display:none; align-items:center; gap:8px; flex-shrink:0; }' +
    '#sr-img-preview img { width:48px; height:48px; object-fit:cover; border-radius:8px; border:1px solid #E3EEFF; }' +
    '#sr-img-remove { background:none; border:none; color:#ef4444; cursor:pointer; font-size:18px; }' +
    '#sr-history-panel { display:none; position:absolute; top:60px; right:0; left:0; bottom:0; background:rgba(255,255,255,0.97); z-index:10; overflow-y:auto; padding:14px; backdrop-filter:blur(10px); }' +
    '#sr-chat-box.fullscreen #sr-chat-messages { padding:24px 16%; }' +
    '#sr-chat-box.fullscreen #sr-chat-suggestions { padding:12px 16%; }' +
    '#sr-chat-box.fullscreen #sr-chat-input-row { padding:14px 16%; }' +
    '#sr-chat-box.fullscreen .sr-msg { max-width:78%; }' +
    
    
    '@media(max-width:680px){' +
    '#sr-chat-btn{width:60px;height:60px;bottom:calc(16px + env(safe-area-inset-bottom));right:16px;}' +
    '#sr-chat-btn svg{width:44px;height:41px;}' +
    '#sr-chat-badge{top:-2px;right:-2px;min-width:19px;height:19px;font-size:10px;}' +
    '#sr-ask-prompt{bottom:calc(84px + env(safe-area-inset-bottom)) !important;right:12px !important;left:12px;max-width:none;font-size:12px;padding:9px 14px;}' +
    '#sr-chat-box.normal{width:100vw;height:100vh;height:100dvh;right:0;bottom:0;left:0;top:0;border-radius:0;}' +
    '#sr-chat-box.fullscreen{width:100vw;height:100vh;height:100dvh;right:0;bottom:0;left:0;top:0;border-radius:0;}' +
    '#sr-chat-header{padding:calc(10px + env(safe-area-inset-top)) 12px 10px;gap:8px;}' +
    '#sr-chat-avatar{width:36px;height:36px;}' +
    '#sr-chat-title{font-size:13.5px;}' +
    '#sr-chat-status{font-size:10px;}' +
    '.sr-header-btn{width:30px;height:30px;font-size:12px;}' +
    '#sr-newchat-btn{font-size:10px !important;padding:0 6px !important;}' +
    '#sr-chat-messages{padding:14px 10px;gap:10px;min-height:0;}' +
    '#sr-chat-box.fullscreen #sr-chat-messages{padding:14px 10px;}' +
    '.sr-msg{max-width:94% !important;}' +
    '#sr-chat-box.fullscreen .sr-msg{max-width:94% !important;}' +
    '.sr-bubble{font-size:13px;padding:10px 13px;}' +
    '#sr-chat-suggestions{padding:8px 10px;max-height:48px;flex-wrap:nowrap;overflow-x:auto;-webkit-overflow-scrolling:touch;}' +
    '#sr-chat-box.fullscreen #sr-chat-suggestions{padding:8px 10px;}' +
    '.sr-sug{font-size:11px;padding:5px 11px;}' +
    '#sr-chat-input-row{padding:10px 10px calc(10px + env(safe-area-inset-bottom));}' +
    '#sr-chat-box.fullscreen #sr-chat-input-row{padding:10px 10px calc(10px + env(safe-area-inset-bottom));}' +
    '#sr-chat-input{font-size:16px;padding:10px 14px;}' +
    '#sr-chat-send,#sr-chat-img-btn{width:38px;height:38px;}' +
    '#sr-history-panel{padding:12px;top:56px;}' +
    '}' +
    '@media(max-width:680px) and (orientation:landscape){#sr-chat-btn{bottom:10px;}}' +
    '</style>' +
    '<button id="sr-selection-popup">💬 Reply to this</button>' +
    '<input type="file" id="sr-img-input" accept="image/*" style="display:none">'+
    '<button id="sr-chat-btn" title="SwingRush AI"><div id="sr-chat-pulse"></div><svg viewBox="0 0 500 460" width="78" height="72"><path d="M159,178 A105,105 0 0,1 341,178" fill="none" stroke="#F5D061" stroke-width="10" stroke-linecap="round"/><path d="M159,282 A105,105 0 0,0 226,332" fill="none" stroke="#F5D061" stroke-width="10" stroke-linecap="round"/><path d="M341,282 A105,105 0 0,1 274,332" fill="none" stroke="#F5D061" stroke-width="10" stroke-linecap="round"/><path fill="#F5D061" d="M250,160 C258,172 270,190 282,204 C310,193 345,187 372,189 C405,192 428,199 446,224 C430,232 410,233 394,236 C360,243 330,252 313,267 C300,277 290,283 282,292 C270,305 263,325 262,345 L262,398 Q262,408 250,408 Q238,408 238,398 L238,345 C237,325 230,305 218,292 C210,283 200,277 187,267 C170,252 140,243 106,236 C90,233 70,232 54,224 C72,199 95,192 128,189 C155,187 190,193 218,204 C230,190 242,172 250,160 Z"/></svg><span id="sr-chat-badge"></span></button>' +
    '<div id="sr-chat-box" class="normal">' +
    '<div id="sr-history-panel"><div style="font-weight:700;font-size:14px;color:#0D47A1;margin-bottom:12px;padding-bottom:8px;border-bottom:1px solid #E3EEFF;">💬 Previous Chats</div><div id="sr-history-list"></div></div>'+
    '<div id="sr-chat-header">' +
      '<div id="sr-chat-avatar"><svg viewBox="0 0 500 460" width="32" height="30"><path d="M159,178 A105,105 0 0,1 341,178" fill="none" stroke="#F5D061" stroke-width="10" stroke-linecap="round"/><path d="M159,282 A105,105 0 0,0 226,332" fill="none" stroke="#F5D061" stroke-width="10" stroke-linecap="round"/><path d="M341,282 A105,105 0 0,1 274,332" fill="none" stroke="#F5D061" stroke-width="10" stroke-linecap="round"/><path fill="#F5D061" d="M250,160 C258,172 270,190 282,204 C310,193 345,187 372,189 C405,192 428,199 446,224 C430,232 410,233 394,236 C360,243 330,252 313,267 C300,277 290,283 282,292 C270,305 263,325 262,345 L262,398 Q262,408 250,408 Q238,408 238,398 L238,345 C237,325 230,305 218,292 C210,283 200,277 187,267 C170,252 140,243 106,236 C90,233 70,232 54,224 C72,199 95,192 128,189 C155,187 190,193 218,204 C230,190 242,172 250,160 Z"/></svg></div>' +
      '<div id="sr-chat-hinfo"><div id="sr-chat-title">SwingRush AI</div><div id="sr-chat-status">Online — Ask about any stock</div></div>' +
      '<button class="sr-header-btn" id="sr-history-btn" title="Chat History">🕐</button>' +
      '<button class="sr-header-btn" id="sr-newchat-btn" title="New Chat" style="font-size:11px;width:auto;padding:0 8px;">+New</button>' +
      '<button class="sr-header-btn" id="sr-fullscreen-btn" title="Fullscreen">⛶</button>' +
      '<button class="sr-header-btn" id="sr-chat-close" title="Close">✕</button>' +
    '</div>' +
    '<div id="sr-chat-messages"></div>' +
    '<div id="sr-img-preview"><img id="sr-img-thumb" src=""><span id="sr-img-name" style="font-size:12px;color:#64748b;flex:1;"></span><button id="sr-img-remove">✕</button></div>'+
    '<div id="sr-chat-suggestions"><button class="sr-sug" onclick="srSuggest(\'Analyze AAPL with full signals\')">📊 Analyze AAPL</button><button class="sr-sug" onclick="srSuggest(\'Show top stocks today from scanner\')">🔥 Top stocks</button><button class="sr-sug" onclick="srSuggest(\'Is the market bullish or bearish?\')">📈 Market mood</button><button class="sr-sug" onclick="srSuggest(\'Explain RSI and how it works\')">📚 What is RSI?</button><button class="sr-sug" onclick="srSuggest(\'What stocks have best risk reward today?\')">🎯 Best R:R</button></div>' +
    '<div id="sr-chat-input-row"><button id="sr-chat-img-btn" title="Upload chart/image">📎</button><textarea id="sr-chat-input" placeholder="Ask about any stock, indicator, or market..." rows="1"></textarea><button id="sr-chat-send">➤</button></div>' +
    '</div>';

  document.body.appendChild(widget);

  var btn        = document.getElementById('sr-chat-btn');
  var box        = document.getElementById('sr-chat-box');
  var closeBtn   = document.getElementById('sr-chat-close');
  var fsBtn      = document.getElementById('sr-fullscreen-btn');
  var input      = document.getElementById('sr-chat-input');
  var sendBtn    = document.getElementById('sr-chat-send');
  var messages   = document.getElementById('sr-chat-messages');
  var selPopup   = document.getElementById('sr-selection-popup');
  var newChatBtn = document.getElementById('sr-newchat-btn');
  var historyBtn = document.getElementById('sr-history-btn');
  var historyPanel = document.getElementById('sr-history-panel');
  var imgBtn     = document.getElementById('sr-chat-img-btn');
  var imgInput   = document.getElementById('sr-img-input');
  var imgPreview = document.getElementById('sr-img-preview');
  var imgThumb   = document.getElementById('sr-img-thumb');
  var imgName    = document.getElementById('sr-img-name');
  var imgRemove  = document.getElementById('sr-img-remove');

  var pendingImage = null; // { base64, mimeType }

  // Welcome message
  addMessage('ai', 'Hi! I am SwingRush AI.\n\nI have full access to our live signal engine and scanner.\n\nAsk me anything:\n- "Analyze NVDA" — full engine analysis\n- "Best stocks under $50" — scanner results\n- "Who is Tesla CEO?" — company info\n- "Latest news for AAPL" — news with links\n\nTip: Upload a chart 📎 for AI analysis!');

  // ── Open / Close ────────────────────────────────────────────────
  function openChat() {
    isOpen = true;
    isFullscreen = true;
    box.classList.remove('normal');
    box.classList.add('fullscreen');
    fsBtn.textContent = '⛷';
    box.style.display = 'flex';
    input.focus();
    document.getElementById('sr-chat-badge').style.display = 'none';
    if (window.innerWidth <= 680) btn.style.display = 'none';
    // Load last session automatically when opening
    if (Auth.token() && !currentSessionId) {
      loadLastSession();
    }
  }

  function closeChat() {
    isOpen = false;
    box.style.display = 'none';
    btn.style.display = 'flex';
    box.classList.remove('fullscreen');
    box.classList.add('normal');
    fsBtn.textContent = '⛶';
    historyPanel.style.display = 'none';
  }

  // ── Load last session on open ───────────────────────────────────
  async function loadLastSession() {
    try {
      var sessions = await API.getChatSessions();
      if (sessions && sessions.length > 0) {
        var last = sessions[0];
        currentSessionId = last._id;
        if (last.messages && last.messages.length > 0) {
          messages.innerHTML = '';
          var lastDateLabel = '';
          last.messages.forEach(function(m) {
            var msgDate = m.time ? new Date(m.time) : new Date();
            var dateLabel = msgDate.toLocaleDateString('en-US', { weekday:'short', month:'short', day:'numeric', year:'numeric' });
            if (dateLabel !== lastDateLabel) {
              var divider = document.createElement('div');
              divider.style.cssText = 'text-align:center;margin:14px 0 6px;font-size:11px;color:#94a3b8;font-weight:700;letter-spacing:0.5px;';
              divider.textContent = '\u2014 ' + dateLabel + ' \u2014';
              messages.appendChild(divider);
              lastDateLabel = dateLabel;
            }
            addMessage(m.role === 'user' ? 'user' : 'ai', m.content, m.time);
          });
        }
      }
    } catch(e) { console.log('Could not load last session'); }
  }

  // ── New chat ────────────────────────────────────────────────────
  function startNewChat() {
    currentSessionId = 'NEW'; // forces backend to create new session
    chatHistory = [];
    messages.innerHTML = '';
    historyPanel.style.display = 'none';
    addMessage('ai', 'New chat started! What would you like to discuss?');
    input.focus();
  }

  // ── History panel ───────────────────────────────────────────────
  async function loadHistoryList() {
    var listEl = document.getElementById('sr-history-list');
    if (!listEl || !Auth.token()) return;
    listEl.innerHTML = '<div style="color:#94a3b8;text-align:center;padding:20px;">Loading...</div>';
    try {
      var sessions = await API.getChatSessions();
      if (!sessions || !sessions.length) {
        listEl.innerHTML = '<div style="color:#94a3b8;text-align:center;padding:20px;">No previous chats</div>';
        return;
      }
      listEl.innerHTML = '';
      sessions.forEach(function(s) {
        var d = new Date(s.updatedAt).toLocaleDateString('en-US', { month:'short', day:'numeric', hour:'2-digit', minute:'2-digit' });
        var isActive = s._id === currentSessionId;
        var div = document.createElement('div');
        div.style.cssText = 'padding:10px 12px;border-radius:10px;cursor:pointer;margin-bottom:6px;background:' + (isActive?'#EEF4FF':'#F8FAFF') + ';border:1.5px solid ' + (isActive?'#1565C0':'#E3EEFF') + ';';
        div.innerHTML = '<div style="display:flex;justify-content:space-between;align-items:center;"><div style="font-size:13px;font-weight:600;color:#1a1a2e;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;flex:1;">' + (s.title || 'Chat') + '</div><button onclick="srDeleteSession(event,\'' + s._id + '\')" style="background:none;border:none;color:#ef4444;cursor:pointer;font-size:16px;padding:0 4px;flex-shrink:0;">🗑</button></div><div style="font-size:11px;color:#94a3b8;margin-top:3px;">' + d + ' · ' + (s.messages?s.messages.length:0) + ' messages</div>';
        div.addEventListener('click', function(e) { if (e.target.tagName !== 'BUTTON') loadSession(s._id); });
        div.addEventListener('mouseover', function() { if (s._id !== currentSessionId) this.style.background = '#EEF4FF'; });
        div.addEventListener('mouseout', function() { if (s._id !== currentSessionId) this.style.background = '#F8FAFF'; });
        listEl.appendChild(div);
      });
    } catch(e) {
      listEl.innerHTML = '<div style="color:#94a3b8;text-align:center;padding:20px;">Could not load</div>';
    }
  }

  async function loadSession(sessionId) {
    try {
      var session = await API.getChatSession(sessionId);
      currentSessionId = session._id;
      messages.innerHTML = '';
      if (session.messages) {
        var lastDateLabel = '';
        session.messages.forEach(function(m) {
          var msgDate = m.time ? new Date(m.time) : new Date();
          var dateLabel = msgDate.toLocaleDateString('en-US', { weekday:'short', month:'short', day:'numeric', year:'numeric' });
          if (dateLabel !== lastDateLabel) {
            var divider = document.createElement('div');
            divider.style.cssText = 'text-align:center;margin:14px 0 6px;font-size:11px;color:#94a3b8;font-weight:700;letter-spacing:0.5px;';
            divider.textContent = '— ' + dateLabel + ' —';
            messages.appendChild(divider);
            lastDateLabel = dateLabel;
          }
          addMessage(m.role === 'user' ? 'user' : 'ai', m.content, m.time);
        });
      }
      historyPanel.style.display = 'none';
    } catch(e) { console.log('Load session error:', e.message); }
  }

  window.srDeleteSession = async function(event, sessionId) {
    event.stopPropagation();
    if (!confirm('Delete this chat?')) return;
    try {
      await API.deleteChatSession(sessionId);
      if (currentSessionId === sessionId) {
        currentSessionId = 'NEW';
        messages.innerHTML = '';
        addMessage('ai', 'Chat deleted. Start a new conversation!');
      }
      loadHistoryList();
    } catch(e) {}
  };

  // ── Image upload ────────────────────────────────────────────────
  imgBtn.addEventListener('click', function() { imgInput.click(); });

  imgInput.addEventListener('change', function() {
    var file = imgInput.files[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { alert('Image must be under 5MB'); return; }
    var reader = new FileReader();
    reader.onload = function(e) {
      var base64 = e.target.result.split(',')[1];
      pendingImage = { base64: base64, mimeType: file.type };
      imgThumb.src = e.target.result;
      imgName.textContent = file.name;
      imgPreview.style.display = 'flex';
    };
    reader.readAsDataURL(file);
    imgInput.value = '';
  });

  imgRemove.addEventListener('click', function() {
    pendingImage = null;
    imgPreview.style.display = 'none';
    imgThumb.src = '';
  });

  // ── Event listeners ─────────────────────────────────────────────
  btn.addEventListener('click', function() { isOpen ? closeChat() : openChat(); });
  closeBtn.addEventListener('click', closeChat);

  newChatBtn.addEventListener('click', startNewChat);

  historyBtn.addEventListener('click', function() {
    if (historyPanel.style.display === 'none') {
      historyPanel.style.display = 'block';
      loadHistoryList();
    } else {
      historyPanel.style.display = 'none';
    }
  });

  fsBtn.addEventListener('click', function() {
    isFullscreen = !isFullscreen;
    if (isFullscreen) {
      box.classList.remove('normal'); box.classList.add('fullscreen'); fsBtn.textContent = '⛷';
    } else {
      box.classList.remove('fullscreen'); box.classList.add('normal'); fsBtn.textContent = '⛶';
    }
  });

  input.addEventListener('keydown', function(e) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  });
  input.addEventListener('input', function() {
    input.style.height = 'auto';
    input.style.height = Math.min(input.scrollHeight, 120) + 'px';
  });
  sendBtn.addEventListener('click', sendMessage);
  window.srSuggest = function(text) { input.value = text; sendMessage(); };

  // ── Text selection popup ────────────────────────────────────────
  document.addEventListener('mouseup', function() {
    setTimeout(function() {
      var sel  = window.getSelection();
      var text = sel ? sel.toString().trim() : '';
      if (text.length > 3 && text.length < 300 && messages.contains(sel.anchorNode)) {
        var range = sel.getRangeAt(0);
        var rect  = range.getBoundingClientRect();
        selPopup.style.display = 'flex';
        selPopup.style.left = Math.min(rect.left, window.innerWidth - 220) + 'px';
        selPopup.style.top  = (rect.top - 42 + window.scrollY) + 'px';
        selPopup.dataset.text = text;
      } else {
        selPopup.style.display = 'none';
      }
    }, 10);
  });

  var quotedText = null; // stores the quoted selection for reply

  selPopup.addEventListener('click', function() {
    var text = selPopup.dataset.text;
    selPopup.style.display = 'none';
    window.getSelection().removeAllRanges();
    if (text) {
      quotedText = text;
      // Show quote preview above input
      var quotePreview = document.getElementById('sr-quote-preview');
      if (!quotePreview) {
        quotePreview = document.createElement('div');
        quotePreview.id = 'sr-quote-preview';
        quotePreview.style.cssText = 'padding:8px 14px;background:rgba(238,244,255,0.9);border-left:3px solid #1565C0;margin:0 14px;border-radius:0 8px 8px 0;display:flex;align-items:center;gap:8px;font-size:12px;color:#475569;';
        var inputRow = document.getElementById('sr-chat-input-row');
        inputRow.parentNode.insertBefore(quotePreview, inputRow);
      }
      var shortText = text.length > 80 ? text.substring(0, 80) + '...' : text;
      quotePreview.innerHTML = '<span style="flex:1;font-style:italic;">"' + shortText.replace(/</g,'&lt;') + '"</span><button onclick="srCancelQuote()" style="background:none;border:none;color:#ef4444;cursor:pointer;font-size:14px;flex-shrink:0;">✕</button>';
      quotePreview.style.display = 'flex';
      if (!isOpen) openChat();
      input.focus();
      input.placeholder = 'Write your reply about the quoted text...';
    }
  });

  window.srCancelQuote = function() {
    quotedText = null;
    var qp = document.getElementById('sr-quote-preview');
    if (qp) qp.style.display = 'none';
    input.placeholder = 'Ask about any stock, indicator, or market...';
  };

  document.addEventListener('mousedown', function(e) {
    if (e.target !== selPopup) selPopup.style.display = 'none';
  });

  // ── Register prompt — close chat and scroll to register ─────────
  function handleRegisterClick() {
    closeChat();
    // Scroll to register section on page
    var regSection = document.getElementById('register') || document.querySelector('.register-section') || document.querySelector('[data-section="register"]');
    if (regSection) {
      regSection.scrollIntoView({ behavior: 'smooth' });
    } else {
      // If on another page, go to index
      window.location.href = '/#register';
    }
  }

  // ── Send message ────────────────────────────────────────────────
  function sendMessage() {
    var text = input.value.trim();
    if ((!text && !pendingImage) || isTyping) return;

    // If replying to a quote, prepend it
    if (quotedText) {
      text = 'Regarding this from your previous answer: "' + quotedText + '"\n\n' + text;
      window.srCancelQuote();
    }

    if (!Auth.token()) {
      if (window.Paywall) {
        Paywall.showRegisterPrompt();
        // Override the register button in paywall to close chat first
        setTimeout(function() {
          var regBtn = document.querySelector('.paywall-register-btn, [onclick*="register"], [onclick*="Register"]');
          if (regBtn) {
            var oldOnclick = regBtn.onclick;
            regBtn.onclick = function(e) {
              closeChat();
              if (oldOnclick) oldOnclick.call(this, e);
            };
          }
        }, 100);
      }
      return;
    }

    if (text) addMessage('user', text);
    if (pendingImage) addMessage('user', '📎 Image uploaded for analysis');
    input.value = '';
    input.style.height = 'auto';
    isTyping = true;
    sendBtn.disabled = true;
    var typingEl = addTyping();

    var stockContextStr = '';
    if (currentStock) {
      stockContextStr = currentStock.symbol + ' @ $' + currentStock.price + ' | ' + currentStock.direction + ' | Score: ' + currentStock.score + ' | TP: $' + currentStock.takeProfit + ' | SL: $' + currentStock.stopLoss;
    }

    // Build request body
    var requestBody = {
      message: text || 'Please analyze this chart/image',
      history: chatHistory.slice(-6),
      stockContext: stockContextStr,
      sessionId: currentSessionId // null = continue recent, 'NEW' = create new, ID = specific session
    };

    if (pendingImage) {
      requestBody.imageBase64 = pendingImage.base64;
      requestBody.imageMimeType = pendingImage.mimeType;
      pendingImage = null;
      imgPreview.style.display = 'none';
    }

    fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + Auth.token() },
      body: JSON.stringify(requestBody),
    })
    .then(function(res) { return res.json().then(function(data) { return { ok: res.ok, data: data }; }); })
    .then(function(result) {
      typingEl.remove();
      if (!result.ok) {
        if (result.data.requireSubscription) {
          addMessage('ai', 'AI Chat is a SwingRush Pro feature.\n\nUpgrade to Pro for unlimited access to the AI analyst \u2014 real Claude AI reasoning combined with technical analysis on every stock.');
          setTimeout(function() { if (window.Paywall) Paywall.showSubscribePaywall('chat'); }, 500);
          return;
        }
        throw new Error(result.data.message);
      }
      addMessage('ai', result.data.response);
      if (result.data.stockDataList && result.data.stockDataList.length > 0) {
        result.data.stockDataList.forEach(function(sd) { renderStockChart(sd); });
      } else if (result.data.stockData) {
        renderStockChart(result.data.stockData);
      }
      chatHistory.push({ role: 'user', content: text || 'Image uploaded' });
      chatHistory.push({ role: 'assistant', content: result.data.response });
      // Save sessionId — now we know which session to continue
      if (result.data.sessionId) {
        currentSessionId = result.data.sessionId;
      }
      if (!isOpen) {
        var badge = document.getElementById('sr-chat-badge');
        badge.style.display = 'flex';
        badge.textContent = '1';
      }
    })
    .catch(function(err) {
      typingEl.remove();
      addMessage('ai', 'Connection error. Please try again in a moment.');
    })
    .finally(function() {
      isTyping = false;
      sendBtn.disabled = false;
      input.focus();
    });
  }

  var birdSvg = '<svg viewBox="0 0 500 460" width="18" height="17"><path d="M159,178 A105,105 0 0,1 341,178" fill="none" stroke="#F5D061" stroke-width="10" stroke-linecap="round"/><path d="M159,282 A105,105 0 0,0 226,332" fill="none" stroke="#F5D061" stroke-width="10" stroke-linecap="round"/><path d="M341,282 A105,105 0 0,1 274,332" fill="none" stroke="#F5D061" stroke-width="10" stroke-linecap="round"/><path fill="#F5D061" d="M250,160 C258,172 270,190 282,204 C310,193 345,187 372,189 C405,192 428,199 446,224 C430,232 410,233 394,236 C360,243 330,252 313,267 C300,277 290,283 282,292 C270,305 263,325 262,345 L262,398 Q262,408 250,408 Q238,408 238,398 L238,345 C237,325 230,305 218,292 C210,283 200,277 187,267 C170,252 140,243 106,236 C90,233 70,232 54,224 C72,199 95,192 128,189 C155,187 190,193 218,204 C230,190 242,172 250,160 Z"/></svg>';

  function addMessage(role, text, realTime) {
    var now = realTime
      ? new Date(realTime).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
      : new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    var div = document.createElement('div');
    div.className = 'sr-msg ' + role;
    var escaped = text.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
    if (role === 'ai') {
      div.innerHTML = '<div class="sr-msg-row"><div class="sr-av-sm">' + birdSvg + '</div><div class="sr-bubble">' + escaped + '</div></div><span class="sr-msg-time">' + now + '</span>';
      renderMarkdownInto(div.querySelector('.sr-bubble'), text);
    } else {
      div.innerHTML = '<div class="sr-msg-row"><div class="sr-bubble">' + escaped + '</div></div><span class="sr-msg-time">' + now + '</span>';
    }
    messages.appendChild(div);
    messages.scrollTop = messages.scrollHeight;
    return div;
  }

  function loadMarkedLib(cb) {
    if (window.marked) return cb();
    var s = document.createElement('script');
    s.src = 'https://cdnjs.cloudflare.com/ajax/libs/marked/9.1.6/marked.min.js';
    s.onload = cb;
    s.onerror = function() {};
    document.head.appendChild(s);
  }

  function renderMarkdownInto(bubbleEl, rawText) {
    if (!bubbleEl || !rawText) return;
    loadMarkedLib(function() {
      try {
        var safe = rawText.replace(/</g, '&lt;');
        bubbleEl.innerHTML = marked.parse(safe);
        bubbleEl.classList.add('sr-md');
        messages.scrollTop = messages.scrollHeight;
      } catch(e) {}
    });
  }

  function addTyping() {
    var div = document.createElement('div');
    div.className = 'sr-msg ai';
    div.innerHTML = '<div class="sr-msg-row"><div class="sr-av-sm">' + birdSvg + '</div><div class="sr-typing"><div class="sr-dot"></div><div class="sr-dot"></div><div class="sr-dot"></div></div></div>';
    messages.appendChild(div);
    messages.scrollTop = messages.scrollHeight;
    return div;
  }

  // ── Stock Chart Rendering ───────────────────────────────────────
  function loadChartLib(cb) {
    if (window.LightweightCharts) return cb();
    var s = document.createElement('script');
    s.src = 'https://unpkg.com/lightweight-charts@4.1.3/dist/lightweight-charts.standalone.production.js';
    s.onload = cb;
    s.onerror = function() { console.log('Chart lib failed to load'); };
    document.head.appendChild(s);
  }

  function renderStockChart(sd) {
    if (!sd || !sd.candles || sd.candles.length < 10) return;
    loadChartLib(function() {
      try {
        var container = document.createElement('div');
        container.className = 'sr-msg ai';
        container.style.maxWidth = '95%';
        container.style.width = '95%';

        var wrap = document.createElement('div');
        wrap.style.cssText = 'background:#fff;border-radius:14px;padding:' + (window.innerWidth<=680?'10px':'14px') + ';box-shadow:0 2px 10px rgba(0,0,0,0.08);border:1px solid rgba(13,71,161,0.1);width:100%;box-sizing:border-box;';

        var isBuy = sd.direction === 'BUY';
        var badgeStyle = isBuy ? 'background:#e8f5e9;color:#2e7d32;' : sd.direction === 'SELL' ? 'background:#ffebee;color:#c62828;' : 'background:#f5f5f5;color:#616161;';
        var header = document.createElement('div');
        header.style.cssText = 'display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;';
        header.innerHTML = '<div style="font-weight:800;font-size:16px;color:#1a1a2e;">' + sd.symbol + ' — $' + sd.price + '</div>' +
          '<div style="padding:4px 12px;border-radius:14px;font-size:12px;font-weight:700;' + badgeStyle + '">' + sd.direction + ' ' + (sd.score > 0 ? '+' : '') + sd.score + '</div>';
        wrap.appendChild(header);

        var scorePct = ((sd.score + 24) / 48) * 100;
        var gauge = document.createElement('div');
        gauge.style.cssText = 'margin-bottom:12px;';
        gauge.innerHTML = '<div style="display:flex;justify-content:space-between;font-size:10px;color:#94a3b8;margin-bottom:3px;"><span>SELL -24</span><span>0</span><span>+24 BUY</span></div>' +
          '<div style="height:10px;background:linear-gradient(90deg,#ef5350,#eeeeee 50%,#26a69a);border-radius:5px;position:relative;">' +
          '<div style="position:absolute;left:' + scorePct + '%;top:-3px;width:5px;height:16px;background:#1a1a2e;border-radius:2px;transform:translateX(-50%);"></div></div>';
        wrap.appendChild(gauge);

        var isMobile = window.innerWidth <= 680;
        var chartH = isMobile ? 190 : 260;
        var chartDiv = document.createElement('div');
        chartDiv.style.cssText = 'height:' + chartH + 'px;width:100%;';
        wrap.appendChild(chartDiv);

        container.appendChild(wrap);
        messages.appendChild(container);

        var chart = LightweightCharts.createChart(chartDiv, {
          height: chartH,
          layout: { background: { color: 'transparent' }, textColor: '#64748b', fontSize: 11 },
          grid: { vertLines: { color: 'rgba(0,0,0,0.04)' }, horzLines: { color: 'rgba(0,0,0,0.04)' } },
          timeScale: { timeVisible: false, borderColor: 'rgba(0,0,0,0.1)' },
          rightPriceScale: { borderColor: 'rgba(0,0,0,0.1)' },
        });
        var series = chart.addCandlestickSeries({
          upColor: '#26a69a', downColor: '#ef5350',
          wickUpColor: '#26a69a', wickDownColor: '#ef5350',
          borderVisible: false,
        });
        series.setData(sd.candles);

        if (sd.takeProfit) series.createPriceLine({ price: Number(sd.takeProfit), color: '#26a69a', lineWidth: 2, lineStyle: 2, title: 'TP' });
        if (sd.stopLoss)   series.createPriceLine({ price: Number(sd.stopLoss),   color: '#ef5350', lineWidth: 2, lineStyle: 2, title: 'SL' });
        chart.timeScale().fitContent();

        if (sd.news && sd.news.length) {
          var newsWrap = document.createElement('div');
          newsWrap.style.cssText = 'margin-top:12px;';
          var newsHtml = '<div style="font-size:11px;font-weight:700;color:#64748b;letter-spacing:1px;margin-bottom:6px;">📰 LATEST NEWS</div>';
          sd.news.forEach(function(n) {
            var sColor = n.sentiment === 'positive' ? '#26a69a' : n.sentiment === 'negative' ? '#ef5350' : '#94a3b8';
            newsHtml += '<a href="' + n.url + '" target="_blank" style="display:block;padding:8px 12px;margin-bottom:5px;background:#f8faff;border-left:3px solid ' + sColor + ';border-radius:0 8px 8px 0;font-size:12px;color:#1a1a2e;text-decoration:none;line-height:1.4;">' + (n.headline || '').replace(/</g,'&lt;') + '</a>';
          });
          newsWrap.innerHTML = newsHtml;
          wrap.appendChild(newsWrap);
        }

        messages.scrollTop = messages.scrollHeight;
      } catch(e) { console.log('Chart render error:', e.message); }
    });
  }

})();
