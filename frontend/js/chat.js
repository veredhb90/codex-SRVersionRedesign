(function() {
  var isOpen = false;
  var isFullscreen = false;
  var history = [];
  var isTyping = false;
  var currentStock = null;

  window.setChatStockContext = function(stockData) {
    currentStock = stockData;
    history = [];
    var statusEl = document.getElementById('sr-chat-status');
    if (statusEl && stockData) statusEl.textContent = 'Analyzing ' + stockData.symbol;
    var suggestEl = document.getElementById('sr-chat-suggestions');
    if (suggestEl && stockData) {
      var isBuy = stockData.direction === 'BUY';
      var dir = stockData.direction;
      var sym = stockData.symbol;
      var sc  = stockData.score > 0 ? '+' + stockData.score : String(stockData.score);
      var sl  = stockData.stopLoss;
      suggestEl.innerHTML =
        '<button class="sr-sug" onclick="srSuggest(\'Why is ' + sym + ' a ' + dir + ' signal right now?\')">' + (isBuy?'▲':'▼') + ' Why ' + dir + '?</button>' +
        '<button class="sr-sug" onclick="srSuggest(\'Explain each indicator for ' + sym + ' and why score is ' + sc + '\')">📊 Explain score</button>' +
        '<button class="sr-sug" onclick="srSuggest(\'Show me latest news with links for ' + sym + '\')">📰 News links</button>' +
        '<button class="sr-sug" onclick="srSuggest(\'What if ' + sym + ' hits stop loss? Should I re-enter?\')">⚠️ If SL hit?</button>' +
        '<button class="sr-sug" onclick="srSuggest(\'What are the main risks for this ' + sym + ' trade?\')">🔍 Risks</button>' +
        '<button class="sr-sug" onclick="srSuggest(\'Who is the CEO of ' + sym + ' and what were last earnings?\')">🏢 Company info</button>';
    }
    if (!isOpen) openChat();
    setTimeout(function() {
      var dir2 = stockData.direction === 'BUY' ? '▲ BUY' : '▼ SELL';
      var sc2  = stockData.score > 0 ? '+' + stockData.score : String(stockData.score);
      addMessage('ai',
        'Loaded full analysis for ' + stockData.symbol + ' @ $' + Number(stockData.price).toFixed(2) + '\n\n' +
        dir2 + ' | Score: ' + sc2 + '/24 | ' + stockData.confidence + ' Confidence\n' +
        'TP: $' + stockData.takeProfit + ' | SL: $' + stockData.stopLoss + ' | R:R 1:' + stockData.riskReward + '\n\n' +
        'Ask me anything — signals, news links, company info, risks, entry strategy!'
      );
    }, 100);
  };

  var widget = document.createElement('div');
  widget.id = 'sr-chat-widget';
  widget.innerHTML = '<style>' +
    '#sr-chat-widget * { box-sizing:border-box; font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif; }' +
    '#sr-chat-btn { position:fixed; bottom:28px; right:28px; z-index:9999; width:72px; height:72px; border-radius:50%; border:none; cursor:pointer; background:linear-gradient(145deg,#42A5F5,#1E88E5,#1565C0); box-shadow:0 8px 32px rgba(66,165,245,0.55); display:flex; align-items:center; justify-content:center; transition:all .3s; }' +
    '#sr-chat-btn:hover { transform:scale(1.12) translateY(-3px); }' +
    '#sr-chat-pulse { position:absolute; inset:-5px; border-radius:50%; border:2.5px solid rgba(66,165,245,0.45); animation:srPulse 2.5s ease-out infinite; }' +
    '@keyframes srPulse { 0%{transform:scale(1);opacity:1} 100%{transform:scale(1.55);opacity:0} }' +
    '#sr-chat-badge { position:absolute; top:-4px; right:-4px; min-width:22px; height:22px; border-radius:11px; background:#F44336; color:#fff; font-size:11px; font-weight:700; display:none; align-items:center; justify-content:center; border:2.5px solid #fff; padding:0 4px; }' +
    '.srb{animation:srFloat 2.5s ease-in-out infinite}' +
    '.srwl{animation:srWL 1.3s ease-in-out infinite;transform-origin:52px 56px}' +
    '.srwr{animation:srWR 1.3s ease-in-out infinite;transform-origin:68px 56px}' +
    '@keyframes srFloat{0%,100%{transform:translateY(0)}50%{transform:translateY(-7px)}}' +
    '@keyframes srWL{0%,100%{transform:rotate(0)}50%{transform:rotate(-28deg)}}' +
    '@keyframes srWR{0%,100%{transform:rotate(0)}50%{transform:rotate(28deg)}}' +
    '#sr-chat-box { position:fixed; z-index:9998; display:none; flex-direction:column; border-radius:20px; overflow:hidden; box-shadow:0 32px 80px rgba(0,0,0,0.3); animation:srSlideUp .35s ease; }' +
    '#sr-chat-box.normal { bottom:114px; right:28px; width:420px; height:600px; }' +
    '#sr-chat-box.fullscreen { bottom:32px; right:32px; left:32px; top:32px; width:calc(100vw - 64px); height:calc(100vh - 64px); border-radius:24px; background:rgba(255,255,255,0.93) !important; backdrop-filter:blur(20px); -webkit-backdrop-filter:blur(20px); }' +
    '@keyframes srSlideUp { from{opacity:0;transform:translateY(28px)} to{opacity:1;transform:translateY(0)} }' +
    '#sr-chat-header { background:linear-gradient(135deg,#0D47A1,#1565C0,#1976D2); padding:14px 18px; color:#fff; display:flex; align-items:center; gap:12px; flex-shrink:0; }' +
    '#sr-chat-avatar { width:44px; height:44px; border-radius:50%; flex-shrink:0; background:rgba(255,255,255,0.15); display:flex; align-items:center; justify-content:center; border:1.5px solid rgba(255,255,255,0.25); }' +
    '#sr-chat-hinfo { flex:1; min-width:0; }' +
    '#sr-chat-title { font-size:15px; font-weight:700; }' +
    '#sr-chat-status { font-size:11px; opacity:.85; margin-top:2px; display:flex; align-items:center; gap:5px; }' +
    '#sr-chat-status::before { content:""; width:7px; height:7px; border-radius:50%; background:#4CAF50; display:inline-block; flex-shrink:0; animation:srBlink 2s infinite; }' +
    '@keyframes srBlink { 0%,100%{opacity:1} 50%{opacity:.35} }' +
    '.sr-header-btn { background:rgba(255,255,255,0.12); border:none; color:#fff; cursor:pointer; width:32px; height:32px; border-radius:8px; font-size:14px; display:flex; align-items:center; justify-content:center; flex-shrink:0; }' +
    '.sr-header-btn:hover { background:rgba(255,255,255,0.22); }' +
    '#sr-chat-messages { flex:1; overflow-y:auto; padding:18px 16px; background:rgba(240,244,255,0.7); display:flex; flex-direction:column; gap:14px; }' +
    '#sr-chat-messages::-webkit-scrollbar { width:4px; }' +
    '#sr-chat-messages::-webkit-scrollbar-thumb { background:rgba(13,71,161,0.2); border-radius:2px; }' +
    '.sr-msg { max-width:85%; display:flex; flex-direction:column; gap:4px; animation:srMsgIn .25s ease; }' +
    '@keyframes srMsgIn { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }' +
    '.sr-msg.user { align-self:flex-end; align-items:flex-end; }' +
    '.sr-msg.ai { align-self:flex-start; align-items:flex-start; }' +
    '.sr-msg-row { display:flex; align-items:flex-end; gap:8px; }' +
    '.sr-av-sm { width:28px; height:28px; border-radius:50%; background:#1565C0; display:flex; align-items:center; justify-content:center; flex-shrink:0; }' +
    '.sr-bubble { padding:12px 16px; font-size:13.5px; line-height:1.65; white-space:pre-wrap; word-break:break-word; }' +
    '.sr-msg.user .sr-bubble { background:linear-gradient(135deg,#1565C0,#0D47A1); color:#fff; border-radius:18px 18px 4px 18px; }' +
    '.sr-msg.ai .sr-bubble { background:#fff; color:#1a1a2e; border-radius:4px 18px 18px 18px; box-shadow:0 2px 10px rgba(0,0,0,0.08); border:1px solid rgba(13,71,161,0.1); cursor:text; user-select:text; }' +
    '.sr-msg-time { font-size:10px; color:#94a3b8; padding:0 4px; }' +
    '#sr-selection-popup { position:fixed; z-index:10000; background:#1565C0; color:#fff; border-radius:20px; padding:6px 14px; font-size:12px; font-weight:600; cursor:pointer; box-shadow:0 4px 16px rgba(13,71,161,0.4); display:none; align-items:center; gap:6px; border:none; }' +
    '.sr-typing { display:flex; gap:5px; padding:14px 16px; background:#fff; border-radius:4px 18px 18px 18px; width:fit-content; box-shadow:0 2px 10px rgba(0,0,0,0.08); }' +
    '.sr-dot { width:8px; height:8px; border-radius:50%; background:#1565C0; animation:srBounce 1.4s ease infinite; opacity:.7; }' +
    '.sr-dot:nth-child(2){animation-delay:.2s} .sr-dot:nth-child(3){animation-delay:.4s}' +
    '@keyframes srBounce { 0%,60%,100%{transform:translateY(0)} 30%{transform:translateY(-9px);opacity:1} }' +
    '#sr-chat-suggestions { padding:10px 14px; display:flex; gap:6px; flex-wrap:wrap; background:rgba(255,255,255,0.85); border-top:1px solid rgba(227,238,255,0.8); flex-shrink:0; max-height:90px; overflow-y:auto; }' +
    '.sr-sug { padding:6px 13px; border-radius:20px; font-size:11.5px; font-weight:600; border:1.5px solid #1565C0; background:#EEF4FF; color:#1565C0; cursor:pointer; transition:all .2s; white-space:nowrap; }' +
    '.sr-sug:hover { background:#1565C0; color:#fff; }' +
    '#sr-chat-input-row { padding:12px 14px; display:flex; gap:10px; align-items:flex-end; background:rgba(255,255,255,0.85); border-top:1px solid rgba(227,238,255,0.8); flex-shrink:0; }' +
    '#sr-chat-input { flex:1; border:1.5px solid #E3EEFF; border-radius:18px; padding:11px 16px; font-size:13.5px; outline:none; resize:none; font-family:inherit; max-height:120px; background:#F5F8FF; transition:all .2s; line-height:1.5; }' +
    '#sr-chat-input:focus { border-color:#1565C0; background:#fff; box-shadow:0 0 0 3px rgba(21,101,192,0.1); }' +
    '#sr-chat-input::placeholder { color:#94a3b8; }' +
    '#sr-chat-send { width:44px; height:44px; border-radius:50%; border:none; cursor:pointer; background:linear-gradient(135deg,#42A5F5,#1565C0); color:#fff; display:flex; align-items:center; justify-content:center; flex-shrink:0; font-size:18px; }' +
    '#sr-chat-send:disabled { background:#cbd5e1; cursor:not-allowed; }' +
    '#sr-chat-box.fullscreen #sr-chat-messages { padding:24px 20%; }' +
    '#sr-chat-box.fullscreen .sr-msg { max-width:70%; }' +
    '#sr-chat-box.fullscreen #sr-chat-suggestions { padding:12px 20%; }' +
    '#sr-chat-box.fullscreen #sr-chat-input-row { padding:14px 20%; }' +
    '@media(max-width:600px){#sr-chat-box.normal{width:calc(100vw - 16px);right:8px;bottom:100px;height:520px;}#sr-chat-box.fullscreen{bottom:16px;right:16px;left:16px;top:16px;width:calc(100vw - 32px);height:calc(100vh - 32px);}#sr-chat-box.fullscreen #sr-chat-messages,#sr-chat-box.fullscreen #sr-chat-suggestions,#sr-chat-box.fullscreen #sr-chat-input-row{padding-left:12px;padding-right:12px;}.sr-msg{max-width:92%;}}' +
    '</style>' +
    '<button id="sr-selection-popup">💬 Ask AI about this</button>' +
    '<button id="sr-chat-btn" title="SwingRush AI"><div id="sr-chat-pulse"></div><svg viewBox="0 0 120 120" width="52" height="52"><g class="srb"><ellipse cx="60" cy="70" rx="22" ry="16" fill="#E3F2FD"/><g class="srwl"><path d="M50 64 Q28 38 24 50 Q36 66 50 67 Z" fill="#64B5F6"/><path d="M50 64 Q30 42 27 52 Q38 64 50 66 Z" fill="#90CAF9"/></g><g class="srwr"><path d="M70 64 Q92 38 96 50 Q84 66 70 67 Z" fill="#64B5F6"/><path d="M70 64 Q90 42 93 52 Q82 64 70 66 Z" fill="#90CAF9"/></g><path d="M38 70 Q22 60 20 70 Q28 78 38 73 Z" fill="#42A5F5"/><circle cx="78" cy="56" r="15" fill="#E3F2FD"/><circle cx="83" cy="52" r="4" fill="#1a237e"/><circle cx="84.5" cy="50.8" r="1.5" fill="white"/><path d="M92 53 L106 56 L92 57 Z" fill="#FF9800"/><path d="M92 57 L104 58.5 L92 59 Z" fill="#F57C00"/><ellipse cx="79" cy="58" rx="5" ry="3" fill="#FF8A80" opacity="0.4"/><line x1="55" y1="85" x2="50" y2="98" stroke="#FFB74D" stroke-width="3" stroke-linecap="round"/><line x1="65" y1="85" x2="70" y2="98" stroke="#FFB74D" stroke-width="3" stroke-linecap="round"/><line x1="50" y1="98" x2="44" y2="102" stroke="#FFB74D" stroke-width="2.5" stroke-linecap="round"/><line x1="50" y1="98" x2="50" y2="103" stroke="#FFB74D" stroke-width="2.5" stroke-linecap="round"/><line x1="50" y1="98" x2="56" y2="102" stroke="#FFB74D" stroke-width="2.5" stroke-linecap="round"/><line x1="70" y1="98" x2="64" y2="102" stroke="#FFB74D" stroke-width="2.5" stroke-linecap="round"/><line x1="70" y1="98" x2="70" y2="103" stroke="#FFB74D" stroke-width="2.5" stroke-linecap="round"/><line x1="70" y1="98" x2="76" y2="102" stroke="#FFB74D" stroke-width="2.5" stroke-linecap="round"/></g></svg><span id="sr-chat-badge"></span></button>' +
    '<div id="sr-chat-box" class="normal">' +
    '<div id="sr-chat-header"><div id="sr-chat-avatar"><svg viewBox="0 0 120 120" width="30" height="30"><ellipse cx="60" cy="70" rx="22" ry="16" fill="white" opacity="0.9"/><path d="M50 64 Q28 38 24 50 Q36 66 50 67 Z" fill="rgba(255,255,255,0.8)"/><path d="M70 64 Q92 38 96 50 Q84 66 70 67 Z" fill="rgba(255,255,255,0.8)"/><circle cx="78" cy="56" r="15" fill="white" opacity="0.9"/><circle cx="83" cy="52" r="4" fill="#0D47A1"/><path d="M92 53 L104 56 L92 57 Z" fill="#FFC107"/></svg></div><div id="sr-chat-hinfo"><div id="sr-chat-title">SwingRush AI</div><div id="sr-chat-status">Online — Ask about any stock</div></div><button class="sr-header-btn" id="sr-fullscreen-btn" title="Fullscreen">⛶</button><button class="sr-header-btn" id="sr-chat-close" title="Close">✕</button></div>' +
    '<div id="sr-chat-messages"></div>' +
    '<div id="sr-chat-suggestions"><button class="sr-sug" onclick="srSuggest(\'Analyze AAPL with full signals\')">📊 Analyze AAPL</button><button class="sr-sug" onclick="srSuggest(\'Show top stocks today from scanner\')">🔥 Top stocks</button><button class="sr-sug" onclick="srSuggest(\'Is the market bullish or bearish?\')">📈 Market mood</button><button class="sr-sug" onclick="srSuggest(\'Explain RSI and how it works\')">📚 What is RSI?</button><button class="sr-sug" onclick="srSuggest(\'What stocks have best risk reward today?\')">🎯 Best R:R</button></div>' +
    '<div id="sr-chat-input-row"><textarea id="sr-chat-input" placeholder="Ask about any stock, indicator, or market..." rows="1"></textarea><button id="sr-chat-send">➤</button></div>' +
    '</div>';

  document.body.appendChild(widget);

  var btn      = document.getElementById('sr-chat-btn');
  var box      = document.getElementById('sr-chat-box');
  var closeBtn = document.getElementById('sr-chat-close');
  var fsBtn    = document.getElementById('sr-fullscreen-btn');
  var input    = document.getElementById('sr-chat-input');
  var sendBtn  = document.getElementById('sr-chat-send');
  var messages = document.getElementById('sr-chat-messages');
  var selPopup = document.getElementById('sr-selection-popup');

  // Add welcome message
  addMessage('ai', 'Hi! I am SwingRush AI.\n\nI have full access to our live signal engine and scanner.\n\nAsk me anything:\n- "Analyze NVDA" — full engine analysis\n- "Latest news for AAPL with links" — real news\n- "Who is Tesla CEO?" — company info\n- "Top stocks today" — scanner results\n\nTip: Select any text in my answers to ask a follow-up!');

  function openChat() {
    isOpen = true;
    isFullscreen = true;
    box.classList.remove('normal');
    box.classList.add('fullscreen');
    fsBtn.textContent = '⛷';
    box.style.display = 'flex';
    input.focus();
    document.getElementById('sr-chat-badge').style.display = 'none';
  }

  function closeChat() {
    isOpen = false;
    isFullscreen = false;
    box.style.display = 'none';
    box.classList.remove('fullscreen');
    box.classList.add('normal');
    fsBtn.textContent = '⛶';
  }

  btn.addEventListener('click', function() { isOpen ? closeChat() : openChat(); });
  closeBtn.addEventListener('click', closeChat);

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

  selPopup.addEventListener('click', function() {
    var text = selPopup.dataset.text;
    selPopup.style.display = 'none';
    window.getSelection().removeAllRanges();
    if (text) {
      input.value = 'Explain this in more detail: "' + text + '"';
      if (!isOpen) openChat();
      sendMessage();
    }
  });

  document.addEventListener('mousedown', function(e) {
    if (e.target !== selPopup) selPopup.style.display = 'none';
  });

  function sendMessage() {
    var text = input.value.trim();
    if (!text || isTyping) return;

    if (!Auth.token()) {
      if (window.Paywall) Paywall.showRegisterPrompt();
      return;
    }

    addMessage('user', text);
    input.value = '';
    input.style.height = 'auto';
    history.push({ role: 'user', content: text });
    isTyping = true;
    sendBtn.disabled = true;
    var typingEl = addTyping();

    var stockContextStr = '';
    if (currentStock) {
      stockContextStr = currentStock.symbol + ' @ $' + currentStock.price + ' | ' + currentStock.direction + ' | Score: ' + currentStock.score + '/24 | ' + currentStock.confidence + ' | TP: $' + currentStock.takeProfit + ' | SL: $' + currentStock.stopLoss;
    }

    fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + Auth.token() },
      body: JSON.stringify({ message: text, history: history.slice(-8), stockContext: stockContextStr }),
    })
    .then(function(res) { return res.json().then(function(data) { return { ok: res.ok, data: data }; }); })
    .then(function(result) {
      typingEl.remove();
      if (!result.ok) throw new Error(result.data.message);
      addMessage('ai', result.data.response);
      history.push({ role: 'assistant', content: result.data.response });
      if (!isOpen) {
        var badge = document.getElementById('sr-chat-badge');
        badge.style.display = 'flex';
        badge.textContent = '1';
      }
    })
    .catch(function(err) {
      typingEl.remove();
      if (err.message && err.message.indexOf('Subscribe') !== -1) {
        addMessage('ai', 'You have used your 2 free AI chat messages.\n\nUpgrade to SwingRush Pro for unlimited AI trading assistant!');
        setTimeout(function() { if (window.Paywall) Paywall.showSubscribePaywall('chat'); }, 500);
      } else {
        addMessage('ai', 'Connection error. Please try again in a moment.');
      }
    })
    .finally(function() {
      isTyping = false;
      sendBtn.disabled = false;
      input.focus();
    });
  }

  var birdSvg = '<svg viewBox="0 0 120 120" width="18" height="18"><ellipse cx="60" cy="70" rx="22" ry="16" fill="white"/><circle cx="78" cy="56" r="15" fill="white"/><circle cx="83" cy="52" r="4" fill="#0D47A1"/><path d="M92 53 L104 56 L92 57 Z" fill="#FFC107"/></svg>';

  function addMessage(role, text) {
    var now = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    var div = document.createElement('div');
    div.className = 'sr-msg ' + role;
    var escaped = text.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
    if (role === 'ai') {
      div.innerHTML = '<div class="sr-msg-row"><div class="sr-av-sm">' + birdSvg + '</div><div class="sr-bubble">' + escaped + '</div></div><span class="sr-msg-time">' + now + '</span>';
    } else {
      div.innerHTML = '<div class="sr-msg-row"><div class="sr-bubble">' + escaped + '</div></div><span class="sr-msg-time">' + now + '</span>';
    }
    messages.appendChild(div);
    messages.scrollTop = messages.scrollHeight;
    return div;
  }

  function addTyping() {
    var div = document.createElement('div');
    div.className = 'sr-msg ai';
    div.innerHTML = '<div class="sr-msg-row"><div class="sr-av-sm">' + birdSvg + '</div><div class="sr-typing"><div class="sr-dot"></div><div class="sr-dot"></div><div class="sr-dot"></div></div></div>';
    messages.appendChild(div);
    messages.scrollTop = messages.scrollHeight;
    return div;
  }

})();
