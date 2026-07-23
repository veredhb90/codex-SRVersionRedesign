const API = {
  _token: () => localStorage.getItem('sr_token'),
  _h() {
    const h = { 'Content-Type': 'application/json' };
    const t = this._token();
    if (t) h['Authorization'] = 'Bearer ' + t;
    return h;
  },
  async _req(path, opts) {
    opts = opts || {};
    const res  = await fetch('/api' + path, { headers: this._h(), ...opts });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.message || 'HTTP ' + res.status);
    return data;
  },
  register:            (b)       => API._req('/auth/register',        { method:'POST', body:JSON.stringify(b) }),
  verify:              (b)       => API._req('/auth/verify',          { method:'POST', body:JSON.stringify(b) }),
  login:               (b)       => API._req('/auth/login',           { method:'POST', body:JSON.stringify(b) }),
  forgotPassword:      (b)       => API._req('/auth/forgot-password', { method:'POST', body:JSON.stringify(b) }),
  changePassword:      (b)       => API._req('/auth/change-password', { method:'POST', body:JSON.stringify(b) }),
  onboarding:          (b)       => API._req('/auth/onboarding',      { method:'POST', body:JSON.stringify(b) }),
  checkUsername:       (u)       => API._req('/auth/check-username/'  + encodeURIComponent(u)),
  quote:               (sym)     => API._req('/stocks/quote/'         + encodeURIComponent(sym)),
  engine:              (sym)     => API._req('/stocks/engine/'        + encodeURIComponent(sym)),
  engineShare:         (b)       => API._req('/stocks/engine/share',  { method:'POST', body:JSON.stringify(b) }),
  feedAll:             (p)       => API._req('/recommendations/feed?page=' + (p||1)),
  feedFollowing:       ()        => API._req('/recommendations/following'),
  popular:             ()        => API._req('/recommendations/popular'),
  symbolRecs:          (sym)     => API._req('/recommendations/symbol/' + encodeURIComponent(sym)),
  postRec:             (b)       => API._req('/recommendations',      { method:'POST', body:JSON.stringify(b) }),
  engineSave:          (b)       => API._req('/recommendations/engine-save', { method:'POST', body:JSON.stringify(b) }),
  repost:              (id,c)    => API._req('/recommendations/'+id+'/repost', { method:'POST', body:JSON.stringify({ comment:c }) }),
  undoRepost:          (id)      => API._req('/recommendations/'+id+'/repost', { method:'DELETE' }),
  likeRec:             (id)      => API._req('/recommendations/'+id+'/like',   { method:'POST' }),
  postComment:         (id,text) => API._req('/recommendations/'+id+'/comment',{ method:'POST', body:JSON.stringify({ text }) }),
  deleteComment:       (id,cid)  => API._req('/recommendations/'+id+'/comment/'+cid, { method:'DELETE' }),
  subscribeInstrument: (sym)     => API._req('/recommendations/subscribe/'+encodeURIComponent(sym), { method:'POST' }),
  getWatchlist:        ()        => API._req('/recommendations/watchlist'),
  searchUsers:         (q)       => API._req('/users/search?q='+encodeURIComponent(q)),
  me:                  ()        => API._req('/users/me'),
  user:                (id)      => API._req('/users/'+id),
  follow:              (id)      => API._req('/users/'+id+'/follow',  { method:'POST' }),
  getNotifications:    ()        => API._req('/notifications'),
  markNotifRead:       ()        => API._req('/notifications/read',   { method:'POST' }),
  clearNotifs:         ()        => API._req('/notifications',        { method:'DELETE' }),
  scanTop5:            (refresh) => API._req('/scanner/top5'+(refresh?'?refresh=true':'')),
  leaderboard:         ()        => API._req('/leaderboard'),
  getChatSessions:     ()        => API._req('/chat/sessions'),
  saveChatMessage:     (b)       => API._req('/chat/save-message', { method:'POST', body:JSON.stringify(b) }),
  getChatSession:      (id)      => API._req('/chat/sessions/' + id),
  newChatSession:      ()        => API._req('/chat/sessions', { method:'POST' }),
  deleteChatSession:   (id)      => API._req('/chat/sessions/' + id, { method:'DELETE' }),
};
window.API = API;
