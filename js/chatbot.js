(function(){
  const BACKEND = (function(){
    try{
      const host = String(window.location.hostname || '').toLowerCase();
      if(host.includes('onrender.com')) return 'https://be-shoesshop.onrender.com';
    }catch(e){}
    return window.BACKEND || 'http://localhost:8080';
  })();
  const CHAT_ENDPOINT = BACKEND + '/api/ai/chat'; // backend should forward to Gemini using stored token
  const STORE_KEY = 'ai_chat_history_v1';

  function loadHistory(){ try{ return JSON.parse(localStorage.getItem(STORE_KEY)||'[]') }catch(e){ return [] } }
  function saveHistory(list){ localStorage.setItem(STORE_KEY, JSON.stringify(list.slice(-50))) }

  function createUI(){
    const toggle = document.createElement('button');
    toggle.className = 'ai-chat-toggle';
    toggle.title = 'Trợ lí thời trang của bạn';
    toggle.innerHTML = '<i class="fa fa-shirt"></i>';
    // inline fallback styles in case CSS cache chưa cập nhật
    Object.assign(toggle.style, {
      position:'fixed', bottom:'18px', right:'18px', width:'58px', height:'58px', borderRadius:'50%', border:'none',
      background:'linear-gradient(135deg,#ff7a18,#ff3d54)', color:'#fff', boxShadow:'0 10px 28px rgba(0,0,0,0.22)', zIndex:'3000', display:'flex',
      alignItems:'center', justifyContent:'center', fontSize:'22px', cursor:'pointer'
    });

    const win = document.createElement('div');
    win.className = 'ai-chat-window';
    Object.assign(win.style, {
      position:'fixed', bottom:'86px', right:'18px', width:'360px', maxHeight:'70vh', minHeight:'360px', height:'520px', background:'#fff', borderRadius:'12px',
      boxShadow:'0 18px 40px rgba(0,0,0,0.25)', display:'none', flexDirection:'column', overflow:'hidden', zIndex:'3000',
      border:'1px solid #ff7a18'
    });
    win.innerHTML = `
      <div class="ai-chat-header">
        <div class="ai-chat-title"><span class="ai-chat-avatar">AI</span><span>Trợ lí thời trang của bạn</span></div>
        <div class="d-flex align-items-center gap-2">
          <small id="ai-chat-status" class="text-muted" style="font-weight:400"></small>
          <button id="ai-chat-close" class="btn btn-sm btn-light ai-chat-close" type="button">×</button>
        </div>
      </div>
      <div class="ai-chat-body" id="ai-chat-body"></div>
      <div class="ai-chat-input">
        <div class="input-group">
          <input id="ai-chat-text" type="text" class="form-control" placeholder="Nhập câu hỏi..." aria-label="Chat with AI">
          <button id="ai-chat-send" class="btn btn-primary" type="button">Gửi</button>
        </div>
      </div>
    `;

    document.body.appendChild(toggle);
    document.body.appendChild(win);

    const body = win.querySelector('#ai-chat-body');
    const input = win.querySelector('#ai-chat-text');
    const sendBtn = win.querySelector('#ai-chat-send');
    const statusEl = win.querySelector('#ai-chat-status');
    const inputWrap = win.querySelector('.ai-chat-input');

    if(body){
      body.style.minHeight = '0';
    }
    if(inputWrap){
      Object.assign(inputWrap.style, { position:'sticky', bottom:'0', background:'#fff', padding:'12px', borderTop:'1px solid #eceff3', zIndex:'1' });
      const group = inputWrap.querySelector('.input-group');
      if(group){
        Object.assign(group.style, { display:'flex', gap:'8px', alignItems:'center' });
      }
    }
    if(input){
      Object.assign(input.style, { flex:'1', minHeight:'42px' });
    }
    if(sendBtn){
      Object.assign(sendBtn.style, { minWidth:'68px' });
    }

    function renderHistory(){
      const hist = loadHistory();
      body.innerHTML = '';
      hist.forEach(m => body.appendChild(renderMsg(m.role, m.text)));
      body.scrollTop = body.scrollHeight;
    }

    function renderMsg(role, text){
      const div = document.createElement('div');
      div.className = 'ai-chat-msg ' + (role === 'user' ? 'user' : 'bot');
      const bubble = document.createElement('div');
      bubble.textContent = text;
      // inline bubble style to avoid cache issues
      Object.assign(div.style, { display:'flex', flexDirection:'column', gap:'4px', maxWidth:'80%', fontSize:'14px', lineHeight:'1.5', wordBreak:'break-word' });
      if(role === 'user'){
        div.style.alignSelf = 'flex-end';
        div.style.marginLeft = 'auto';
        div.style.marginRight = '0';
        Object.assign(bubble.style, {
          padding:'12px 14px', borderRadius:'18px', boxShadow:'0 4px 12px rgba(0,0,0,0.06)',
          background:'linear-gradient(135deg,#a855f7,#7c3aed)', color:'#fff', border:'1px solid #8b5cf6',
          borderBottomRightRadius:'10px', borderTopRightRadius:'18px', borderTopLeftRadius:'18px', borderBottomLeftRadius:'18px'
        });
      } else {
        div.style.alignSelf = 'flex-start';
        div.style.marginRight = 'auto';
        div.style.marginLeft = '0';
        Object.assign(bubble.style, {
          padding:'12px 14px', borderRadius:'18px', boxShadow:'0 4px 12px rgba(0,0,0,0.06)',
          background:'#f2f3f6', color:'#1f2430', border:'1px solid #e0e2e8',
          borderBottomLeftRadius:'10px', borderTopLeftRadius:'18px', borderTopRightRadius:'18px', borderBottomRightRadius:'18px'
        });
      }
      const meta = document.createElement('div');
      meta.className = 'ai-chat-meta';
      meta.textContent = role === 'user' ? '' : '';
      div.appendChild(bubble);
      div.appendChild(meta);
      return div;
    }

    async function send(){
      const text = (input.value||'').trim();
      if(!text) return;
      const hist = loadHistory();
      hist.push({ role:'user', text });
      saveHistory(hist);
      renderHistory();
      input.value = '';
      setStatus('Đang trả lời...');
      const thinking = renderMsg('bot','Đang soạn trả lời...');
      body.appendChild(thinking); body.scrollTop = body.scrollHeight;
      try{
        const res = await fetch(CHAT_ENDPOINT, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: text })
        });
        if(res.ok){
          const data = await res.json();
          const reply = data && (data.reply || data.message || data.content || '');
          thinking.remove();
          const msg = { role:'bot', text: reply || 'Chưa có trả lời từ máy chủ.' };
          const newHist = loadHistory(); newHist.push(msg); saveHistory(newHist);
          body.appendChild(renderMsg('bot', msg.text)); body.scrollTop = body.scrollHeight;
        } else {
          let detail = 'Bad response';
          try{
            const errJson = await res.json();
            if(errJson && errJson.error) detail = errJson.error;
          }catch(e){ /* ignore parse */ }
          throw new Error(detail + ' (HTTP ' + res.status + ')');
        }
      }catch(err){
        thinking.remove();
        const fallback = 'Không thể trả lời lúc này: ' + (err && err.message ? err.message : 'Vui lòng thử lại sau.');
        const msg = { role:'bot', text: fallback };
        const newHist = loadHistory(); newHist.push(msg); saveHistory(newHist);
        body.appendChild(renderMsg('bot', msg.text)); body.scrollTop = body.scrollHeight;
      }
      setStatus('');
    }

    function setStatus(text){ statusEl.textContent = text||''; }

    toggle.addEventListener('click', ()=>{
      const shown = win.style.display === 'flex';
      win.style.display = shown ? 'none' : 'flex';
      if(!shown) renderHistory();
    });
    win.querySelector('#ai-chat-close').addEventListener('click', ()=>{ win.style.display='none'; });
    sendBtn.addEventListener('click', send);
    input.addEventListener('keydown', function(e){ if(e.key==='Enter'){ e.preventDefault(); send(); } });

    // render initial history
    renderHistory();

    // inline stylings for header/avatar/title to avoid cache issues
    const header = win.querySelector('.ai-chat-header');
    if(header){
      Object.assign(header.style, {
        padding:'14px 16px', borderBottom:'1px solid #ffd9c2', display:'flex', alignItems:'center', justifyContent:'space-between',
        fontWeight:'700', color:'#1f2933', background:'linear-gradient(135deg,#ffede0,#fff)'
      });
    }
    const title = win.querySelector('.ai-chat-title');
    if(title){
      Object.assign(title.style, { display:'flex', alignItems:'center', gap:'8px', fontWeight:'800', color:'#d34d1c', letterSpacing:'0.2px' });
    }
    const avatar = win.querySelector('.ai-chat-avatar');
    if(avatar){
      Object.assign(avatar.style, {
        width:'26px', height:'26px', borderRadius:'50%', background:'linear-gradient(135deg,#ff7a18,#ff3d54)', display:'inline-flex',
        alignItems:'center', justifyContent:'center', color:'#fff', fontSize:'14px', boxShadow:'0 4px 10px rgba(0,0,0,0.12)'
      });
    }
  }

  // bootstrap icons may not be present; rely on font-awesome already loaded in index
  document.addEventListener('DOMContentLoaded', createUI);
})();
