(function(){
  // Ensure a global queued showNotification exists early so pages can call it
  try{
    if(!window._notifyQueue) window._notifyQueue = [];
    if(!window.showNotification) window.showNotification = function(a,b,c,d){ try{ window._notifyQueue.push([a,b,c,d]); }catch(e){} };
  }catch(e){}
  const KEY = 'site_notifications_v1'
  const TS = 'notificationsUpdatedAt'
  function read(){ try{ return JSON.parse(localStorage.getItem(KEY)||'[]') }catch(e){return[]} }
  function write(list){ localStorage.setItem(KEY, JSON.stringify(list)); localStorage.setItem(TS, Date.now()); }

  function getCurrentUser(){
    try{ return JSON.parse(localStorage.getItem('currentUser')||'null') || null }catch(e){ return null }
  }

  function getRole(){
    try{
      const cur = getCurrentUser();
      const role = cur && cur.role ? String(cur.role).toLowerCase() : 'user';
      return role;
    }catch(e){ return 'user' }
  }

  function canSeeNotification(n){
    const target = n && n.target != null ? String(n.target).trim() : '';
    if(!target || target === 'all') return true;

    const cur = getCurrentUser();
    const role = getRole();
    const t = target.toLowerCase();

    if(t === role) return true;
    // Backward-compatible: notification for "user" should be visible to any non-admin account.
    if(t === 'user' && role !== 'admin') return true;

    if(cur){
      const candidates = [cur.username, cur.email, cur.id]
        .filter(Boolean)
        .map(v => String(v).toLowerCase());
      if(candidates.includes(t)) return true;
    }
    return false;
  }

  function addNotification(n){
    const list = read();
    n.id = n.id || ('n_' + Date.now())
    n.read = false
    n.createdAt = n.createdAt || Date.now()
    list.unshift(n)
    write(list)
    renderBadge()
  }

  function markRead(id){
    const list = read()
    const idx = list.findIndex(x=>x.id===id)
    if(idx>=0){
      // remove the notification from the list when user marks as read
      list.splice(idx,1)
      write(list)
      renderPanel()
    }
  }

  function renderBadge(){
    try{
      const btn = document.getElementById('notify-btn')
      if(!btn) return
      const list = read()
      const unread = list.filter(x=>!x.read && canSeeNotification(x)).length
      const badge = btn.querySelector('.notify-badge')
      if(badge) badge.textContent = unread>0?String(unread):''
    }catch(e){console.warn(e)}
  }

  function renderPanel(){
    try{
      let panel = document.getElementById('notify-panel')
      if(!panel){
        panel = document.createElement('div')
        panel.id = 'notify-panel'
        panel.className = 'notify-panel shadow'
        panel.style.position = 'fixed'
        panel.style.right = '16px'
        panel.style.top = '64px'
        panel.style.width = '360px'
        panel.style.maxHeight = '420px'
        panel.style.overflow = 'auto'
        panel.style.background = '#fff'
        panel.style.borderRadius = '8px'
        panel.style.display = 'none'
        panel.style.zIndex = 3000
        document.body.appendChild(panel)
      }
      // show only unread notifications in the panel
      let list = read().filter(x=> !x.read && canSeeNotification(x))
      // filter out notifications that reference orders already approved (so they disappear)
      try{
        const orders = JSON.parse(localStorage.getItem('orders_v1')||'[]') || []
        list = list.filter(n => {
          if(!n.orderId) return true
          const ord = orders.find(o => String(o.id) === String(n.orderId))
          if(!ord) return true
          // hide notifications for orders that are approved
          if(String(ord.status).toLowerCase() === 'approved') return false
          return true
        })
      }catch(e){ /* ignore */ }
      if(list.length===0){ panel.innerHTML = '<div class="p-3">Không có thông báo</div>'; return }
      panel.innerHTML = list.map(n=>{
        return `<div class="p-3 border-bottom notif-item" data-id="${n.id}" data-orderid="${n.orderId||''}"><div class="d-flex justify-content-between align-items-start"><div><strong>${escapeHtml(n.title||'')}</strong><div class="small text-muted">${new Date(n.createdAt).toLocaleString()}</div></div><div><span class="mark-read-wrap"><button class="btn btn-sm mark-read">Đã đọc</button></span></div></div><div class="mt-2">${escapeHtml(n.message||'')}</div></div>`
      }).join('')
      // attach handlers
      panel.querySelectorAll('.mark-read').forEach(b=>{
        b.addEventListener('click', function(ev){
          const id = ev.target.closest('[data-id]').getAttribute('data-id')
          markRead(id)
        })
      })
      // clicking a notification opens detail (for admin orders)
      panel.querySelectorAll('[data-id]').forEach(item => {
        item.addEventListener('click', function(ev){
          // ignore clicks on the mark-read button
          if(ev.target && ev.target.classList && ev.target.classList.contains('mark-read')) return
          const orderId = this.getAttribute('data-orderid')
          const nid = this.getAttribute('data-id')
          if(orderId){
            // For admin, navigate to manage-orders page and open the order there; otherwise open inline modal
            try{
              const role = getRole()
              if(role === 'admin'){
                const targetPath = '/admin/manage-orders.html'
                const alreadyOn = (function(){ try{ const p = location.pathname.replace(/\\/g,'/'); return p.indexOf('manage-orders.html') !== -1 }catch(e){return false} })()
                if(alreadyOn){
                  try{
                    const url = new URL(window.location.href)
                    url.searchParams.set('openOrder', orderId)
                    window.location.href = url.toString()
                  }catch(e){
                    window.location.href = 'manage-orders.html?openOrder=' + encodeURIComponent(orderId)
                  }
                  return
                }
                // build href robustly: fallback to relative if origin is null (file://)
                var href = ''
                try{ href = (location && location.origin && location.origin !== 'null') ? (location.origin + targetPath) : ('admin/manage-orders.html') }catch(e){ href = 'admin/manage-orders.html' }
                href += '?openOrder=' + encodeURIComponent(orderId)
                window.location.href = href
                return
              }
            }catch(e){ /* ignore and fallback */ }
            openOrderModal(orderId, nid)
          }
        })
      })
    }catch(e){console.warn(e)}
  }

  // open admin order modal for given orderId
  function openOrderModal(orderId, notificationId){
    try{
      const ordersKey = 'orders_v1'
      let orders = []
      try{ orders = JSON.parse(localStorage.getItem(ordersKey)||'[]') }catch(e){ orders = [] }
      const order = orders.find(o=>String(o.id)===String(orderId))
      if(!order){ if(window.showNotification) window.showNotification('Đơn không tồn tại','error'); return }
      // build modal
      const modal = document.createElement('div')
      modal.className = 'modal fade'
      modal.tabIndex = -1
      modal.innerHTML = `
        <div class="modal-dialog modal-lg modal-dialog-centered">
          <div class="modal-content">
            <div class="modal-header"><h5 class="modal-title">Chi tiết đơn ${escapeHtml(order.id)}</h5><button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button></div>
            <div class="modal-body">
              <div><strong>Trạng thái:</strong> ${escapeHtml(order.status)}</div>
              <div class="mt-2"><strong>Địa chỉ:</strong> ${escapeHtml(order.address)}</div>
              <div class="mt-2"><strong>SDT:</strong> ${escapeHtml(order.phone)}</div>
              <div class="mt-3"><strong>Sản phẩm:</strong><div class="list-group mt-2">${order.items.map(it=>`<div class="list-group-item d-flex justify-content-between"><div>${escapeHtml(it.name)} <div class="small text-muted">Size: ${escapeHtml(it.size||'-')} x ${it.qty}</div></div><div>${new Intl.NumberFormat('vi-VN').format((parseInt(String(it.price||'').replace(/[^0-9]/g,''),10)||0))}đ</div></div>`).join('')}</div></div>
              <div class="mt-3"><strong>Tổng:</strong> ${new Intl.NumberFormat('vi-VN').format(order.total)} đ</div>
              <div class="mt-2"><strong>Ghi chú:</strong> ${escapeHtml(order.cancelReason||'')}</div>
            </div>
            <div class="modal-footer">
              <button id="order-approve" class="btn btn-success">Duyệt</button>
              <button id="order-cancel" class="btn btn-danger">Hủy đơn</button>
              <button class="btn btn-secondary" data-bs-dismiss="modal">Đóng</button>
            </div>
          </div>
        </div>`
      document.body.appendChild(modal)
      const bs = new bootstrap.Modal(modal)
      bs.show()

      modal.querySelector('#order-approve').addEventListener('click', function(){
        order.status = 'approved'
        localStorage.setItem(ordersKey, JSON.stringify(orders))
        // mark admin notification read
        if(notificationId) markRead(notificationId)
        // notify admin about the approval
        try{ window.notifications.add({ title: 'Đơn đã duyệt', message: 'Đơn ' + order.id + ' đã được duyệt', target: 'admin' }) }catch(e){}
        // remove any user-targeted notification for this order so it disappears from user panel
        try{
          const nlist = read() || []
          const userTarget = order.userId || 'user'
          const filtered = nlist.filter(n => !(String(n.orderId) === String(order.id) && (n.target === userTarget || n.target === 'user' || !n.target)))
          write(filtered)
        }catch(e){ console.warn('failed to remove user notification on approve', e) }
        if(window.showNotification) window.showNotification('Đã duyệt đơn','success')
        bs.hide()
      })

      modal.querySelector('#order-cancel').addEventListener('click', function(){
        // replace footer with reason input
        const footer = modal.querySelector('.modal-footer')
        footer.innerHTML = `<div class="w-100"><div class="mb-2"><label>Lý do hủy</label><input id="cancel-reason" class="form-control"/></div><div class="text-end"><button id="cancel-confirm" class="btn btn-danger me-2">Xác nhận hủy</button><button id="cancel-cancel" class="btn btn-secondary">Quay lại</button></div></div>`
        modal.querySelector('#cancel-cancel').addEventListener('click', function(){ bs.hide() })
        modal.querySelector('#cancel-confirm').addEventListener('click', function(){
          const reason = modal.querySelector('#cancel-reason').value.trim()
          if(!reason){ if(window.showNotification) window.showNotification('Vui lòng nhập lý do','error'); return }
          order.status = 'cancelled'
          order.cancelReason = reason
          localStorage.setItem(ordersKey, JSON.stringify(orders))
          if(notificationId) markRead(notificationId)
          try{ window.notifications.add({ title: 'Đơn bị hủy', message: 'Đơn ' + order.id + ' bị hủy: ' + reason, target: 'admin' }) }catch(e){}
          // notify ordering user about cancellation as well
          try{
            const userTarget = order.userId || 'user'
            const nlist = read()
            const existing = nlist.find(n => String(n.orderId) === String(order.id) && (n.target === userTarget || n.target === 'user' || !n.target))
            if(existing){ existing.title = 'Đơn đã bị hủy'; existing.message = 'Đơn ' + order.id + ' bị hủy: ' + reason; existing.read = false; existing.createdAt = Date.now(); write(nlist) }
            else { addNotification({ title: 'Đơn đã bị hủy', message: 'Đơn ' + order.id + ' bị hủy: ' + reason, target: userTarget, orderId: order.id }) }
          }catch(e){ console.warn('failed to update user notification on cancel', e) }
          if(window.showNotification) window.showNotification('Đã hủy đơn','success')
          bs.hide()
        })
      })

      modal.addEventListener('hidden.bs.modal', function(){ try{ modal.parentNode && modal.parentNode.removeChild(modal) }catch(e){} renderPanel(); renderBadge() })
    }catch(e){ console.error('openOrderModal failed', e); if(window.showNotification) window.showNotification('Không thể mở chi tiết đơn','error') }
  }

  function escapeHtml(s){ return String(s||'').replace(/[&"'<>]/g, function(m){ return ({'&':'&amp;','"':'&quot;',"'":"&#39;","<":"&lt;",">":"&gt;"})[m] }) }

  // toggle panel
  function togglePanel(){ const p = document.getElementById('notify-panel'); if(!p) return; p.style.display = p.style.display==='block'?'none':'block' }

  // attach UI to header or create floating button
  function ensureButton(){
    if(document.getElementById('notify-btn')) return
    const headerActions = document.querySelector('.header-actions')
    const btn = document.createElement('button')
    btn.id = 'notify-btn'
    btn.className = 'btn btn-link text-white position-relative me-2'
    btn.style.border = 'none'
    btn.innerHTML = '<i class="fa fa-bell fa-lg"></i><span class="notify-badge badge bg-danger rounded-pill" style="position:absolute;top:-6px;right:-6px;font-size:11px;padding:3px 6px"></span>'
    btn.addEventListener('click', function(e){ e.preventDefault(); renderPanel(); togglePanel(); })
    if(headerActions){
      // try to place bell immediately before cart link so it appears next to cart
      const cartAnchor = headerActions.querySelector('a[href="cart.html"]')
      if(cartAnchor){ headerActions.insertBefore(btn, cartAnchor) }
      else { headerActions.appendChild(btn) }
    } else { // create floating
      btn.style.position = 'fixed'; btn.style.right='16px'; btn.style.top='16px'; btn.style.zIndex=3000; document.body.appendChild(btn)
    }
  }

  // listen for updates
  window.addEventListener('storage', function(e){ if(e.key === TS){ renderBadge(); renderPanel() } })

  document.addEventListener('DOMContentLoaded', function(){ ensureButton(); renderBadge() })

  // (initialization of last status is handled inside the toast IIFE)

  // expose API
  try{ window.notifications = { add: addNotification, list: read, markRead: markRead } }catch(e){}
  try{ window.openOrderModal = openOrderModal }catch(e){}
  // transient centered toast notification
  try{
    (function(){
      let toastEl = null
      let hideTimer = null
      let statusEl = null
      let lastStatus = null
      function ensureToast(){
        if(toastEl) return toastEl
        toastEl = document.createElement('div')
        toastEl.id = 'global-toast'
        toastEl.style.position = 'fixed'
        toastEl.style.left = '50%'
        toastEl.style.top = '40%'
        toastEl.style.transform = 'translate(-50%, -50%)'
        toastEl.style.zIndex = 99999
        toastEl.style.minWidth = '200px'
        toastEl.style.maxWidth = '90%'
        toastEl.style.padding = '14px 18px'
        toastEl.style.borderRadius = '8px'
        toastEl.style.boxShadow = '0 6px 20px rgba(0,0,0,0.2)'
        toastEl.style.color = '#fff'
        toastEl.style.fontSize = '15px'
        toastEl.style.textAlign = 'center'
        toastEl.style.opacity = '0'
        toastEl.style.transition = 'opacity 180ms ease, transform 180ms ease'
        toastEl.style.pointerEvents = 'none'
        document.body.appendChild(toastEl)
        return toastEl
      }

      function ensureStatus(){
        if(statusEl) return statusEl
        statusEl = document.createElement('div')
        statusEl.id = 'global-notify-status'
        statusEl.style.position = 'fixed'
        statusEl.style.left = '50%'
        statusEl.style.top = '12px'
        statusEl.style.transform = 'translateX(-50%)'
        statusEl.style.zIndex = 99998
        statusEl.style.width = '40px'
        statusEl.style.height = '40px'
        statusEl.style.borderRadius = '50%'
        statusEl.style.display = 'none'
        statusEl.style.alignItems = 'center'
        statusEl.style.justifyContent = 'center'
        statusEl.style.boxShadow = '0 4px 12px rgba(0,0,0,0.12)'
        statusEl.style.cursor = 'default'
        statusEl.title = ''
        statusEl.innerHTML = ''
        // do not append the persistent status indicator to the DOM to avoid showing the green tick
        // (keep the element detached so showNotification still works for transient toasts)
        return statusEl
      }

      function show(title, subtitle, type, duration){
        // flexible args parsing
        let t = title || ''
        let s = ''
        let ty = 'info'
        let dur = 1500
        // handle possible signatures used across files
        if(arguments.length === 1){ /* only title */ }
        else if(arguments.length === 2){
          if(typeof subtitle === 'number') dur = subtitle
          else if(['success','error','info','warning'].includes(String(subtitle))) ty = subtitle
          else s = subtitle
        } else if(arguments.length === 3){
          if(typeof arguments[2] === 'number'){ s = subtitle; dur = arguments[2] }
          else { s = subtitle; ty = arguments[2] }
        } else if(arguments.length >=4){ s = subtitle; ty = type; dur = duration }

        const el = ensureToast()
        // use site orange background for toast (keeps icons for success/error)
        const siteOrange = '#ff7a00'
        const icon = (ty === 'success') ? '<span style="font-size:18px;display:inline-block;margin-right:8px;">✔</span>' : (ty === 'error' ? '<span style="font-size:18px;display:inline-block;margin-right:8px;">✖</span>' : '<span style="font-size:18px;display:inline-block;margin-right:8px;">ℹ</span>')
        el.style.background = siteOrange
        el.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;gap:10px"><div style="font-size:20px">' + icon + '</div><div style="text-align:left"><div style="font-weight:600;margin-bottom:4px">' + escapeHtml(String(t)) + '</div>' + (s ? ('<div style="font-size:13px;opacity:0.95">' + escapeHtml(String(s)) + '</div>') : '') + '</div></div>'
        // update persistent status indicator
        try{ setStatus(ty, t || s) }catch(e){}
        // show
        window.requestAnimationFrame(function(){ el.style.opacity = '1'; el.style.transform = 'translate(-50%, -50%) scale(1)'; })
        // clear previous timer
        if(hideTimer) { clearTimeout(hideTimer); hideTimer = null }
        dur = parseInt(dur) || 1500
        hideTimer = setTimeout(function(){ try{ el.style.opacity = '0'; el.style.transform = 'translate(-50%, -60%) scale(0.98)'; }catch(e){}
          // remove after transition
          setTimeout(function(){ try{ /* keep element for reuse, don't remove to avoid reflow */ }catch(e){} }, 220)
        }, dur)
      }

      function setStatus(type, txt){
        try{
          const st = ensureStatus()
          lastStatus = type
          if(!type){ st.style.display = 'none'; st.title = ''; return }
          st.style.display = 'flex'
          st.title = txt || ''
          if(type === 'success'){
            st.style.background = '#198754'
            st.innerHTML = '<span style="color:#fff;font-size:18px">✔</span>'
          } else if(type === 'error'){
            st.style.background = '#dc3545'
            st.innerHTML = '<span style="color:#fff;font-size:18px">✖</span>'
          } else if(type === 'warning'){
            st.style.background = '#f39c12'
            st.innerHTML = '<span style="color:#fff;font-size:18px">!</span>'
          } else {
            st.style.background = '#0d6efd'
            st.innerHTML = '<span style="color:#fff;font-size:18px">i</span>'
          }
          // persist last status
          try{ localStorage.setItem('lastNotificationStatus', JSON.stringify({ type: type, title: (txt||''), message: (txt||'') })) }catch(er){}
        }catch(e){ console.warn('setStatus failed', e) }
      }

      function escapeHtml(s){ return String(s||'').replace(/[&"'<>]/g, function(m){ return ({'&':'&amp;','"':'&quot;',"'":"&#39;","<":"&lt;",">":"&gt;"})[m] }) }

      // restore persisted status (without showing toast)
      try{
        const stored = localStorage.getItem('lastNotificationStatus')
        if(stored){
          try{ const obj = JSON.parse(stored); if(obj && obj.type) setStatus(obj.type, obj.title || obj.message || '') }catch(e){}
        }
      }catch(e){}

      // flush queued notifications (if any callers invoked showNotification before this script loaded)
      try{
        if(window._notifyQueue && Array.isArray(window._notifyQueue) && window._notifyQueue.length){
          window._notifyQueue.forEach(function(args){ try{ show.apply(null, args); }catch(e){} })
          window._notifyQueue = []
        }
      }catch(e){}

      window.showNotification = function(a,b,c,d){ try{ return show(a,b,c,d) }catch(e){ console.warn('showNotification failed', e) } }
    })()
  }catch(e){ console.warn('could not attach transient notification', e) }
})();
