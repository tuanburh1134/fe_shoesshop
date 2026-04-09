(function(){
  const ORDERS_KEY = 'orders_v1'
  const BACKEND = (function(){
    try{
      const host = String(window.location.hostname || '').toLowerCase();
      if(host.includes('onrender.com')) return 'https://be-shoesshop.onrender.com';
    }catch(e){}
    return 'http://localhost:8080';
  })();
  function readOrders(){ try{ return JSON.parse(localStorage.getItem(ORDERS_KEY)||'[]') }catch(e){return[]} }
  function writeOrders(list){ localStorage.setItem(ORDERS_KEY, JSON.stringify(list)); localStorage.setItem('ordersUpdatedAt', Date.now()) }

  function getAuthHeader(){
    try{
      const cur = JSON.parse(localStorage.getItem('currentUser')||'null')
      if(cur && cur.username && cur.password){
        const token = btoa(cur.username + ':' + cur.password)
        return { 'Authorization': 'Basic ' + token }
      }
    }catch(e){}
    return {}
  }

  function fmt(v){ try{ return new Intl.NumberFormat('vi-VN').format(v) + ' đ' }catch(e){ return v } }

  let __pageLoader = null
  function ensurePageLoader(){
    if(__pageLoader) return __pageLoader
    const el = document.createElement('div')
    el.id = 'orders-page-loader'
    el.style.position = 'fixed'
    el.style.inset = '0'
    el.style.background = 'rgba(255,255,255,0.75)'
    el.style.backdropFilter = 'blur(1px)'
    el.style.display = 'none'
    el.style.alignItems = 'center'
    el.style.justifyContent = 'center'
    el.style.zIndex = '4000'
    el.innerHTML = `
      <div style="display:flex;flex-direction:column;align-items:center;gap:10px;">
        <div class="spinner-border text-primary" role="status" aria-hidden="true"></div>
        <div style="font-weight:600;color:#1f2937;">Đang tải dữ liệu...</div>
      </div>
    `
    document.body.appendChild(el)
    __pageLoader = el
    return el
  }

  function setPageLoading(show, text){
    try{
      const el = ensurePageLoader()
      const msg = el.querySelector('div div:last-child')
      if(msg && text) msg.textContent = text
      el.style.display = show ? 'flex' : 'none'
    }catch(e){}
  }

  function statusRank(status){
    const s = String(status || '').toLowerCase()
    if(s === 'pending') return 0
    if(s === 'cancelled') return 1
    if(s === 'approved') return 2
    return 1
  }

  function orderTimestamp(order){
    const ts = Number(order && order.createdAt)
    if(Number.isFinite(ts) && ts > 0) return ts
    const idNum = Number(order && order.id)
    if(Number.isFinite(idNum) && idNum > 0) return idNum
    return 0
  }

  function statusLabel(status){
    const s = String(status || '').toLowerCase()
    if(s === 'pending') return 'Chờ xác nhận'
    if(s === 'approved') return 'Đã xác nhận'
    if(s === 'cancelled') return 'Đã hủy'
    return String(status || '')
  }

  async function fetchOrderById(orderId){
    try{
      // Local fallback order ids (e.g. o_123...) are not backend numeric ids.
      if(!/^\d+$/.test(String(orderId || ''))){
        const local = (readOrders() || []).find(o => String(o.id) === String(orderId));
        return local || null;
      }
      const hdr = getAuthHeader()
      if(!hdr.Authorization) return null
      const resp = await fetch(BACKEND + '/api/orders/' + encodeURIComponent(orderId), { headers: Object.assign({'Content-Type':'application/json'}, hdr) })
      if(!resp.ok) return null
      return await resp.json()
    }catch(e){
      return null
    }
  }

  async function renderList(){
    const container = document.getElementById('orders-list')
    if(!container) return
    setPageLoading(true, 'Đang tải danh sách hóa đơn...')
    try{
      const q = (document.getElementById('orders-search') && document.getElementById('orders-search').value || '').toLowerCase()
      const statusFilter = document.getElementById('filter-status') ? document.getElementById('filter-status').value : 'all'
      let list = []
      // try fetch from backend first (requires login/admin)
      try{
        const hdr = getAuthHeader()
        if(hdr.Authorization){
          const resp = await fetch(BACKEND + '/api/orders', { headers: Object.assign({'Content-Type':'application/json'}, hdr) })
          if(resp.ok){ list = await resp.json() }
          else { list = readOrders() || [] }
        } else {
          list = readOrders() || []
        }
      }catch(e){ list = readOrders() || [] }
      // fallback to local if backend trả về rỗng (admin chưa login backend)
      if(!list || list.length === 0){
        try{ const localOrders = readOrders() || []; if(localOrders.length) list = localOrders; }catch(e){}
      }
      if(statusFilter !== 'all') list = list.filter(o=>String(o.status||'').toLowerCase()===statusFilter)
      if(q) list = list.filter(o=> String(o.id||'').toLowerCase().includes(q) || String(o.userName||'').toLowerCase().includes(q) )

      // Order display: newest first, and approved orders pushed lower.
      list.sort((a, b) => {
        const rankDiff = statusRank(a && a.status) - statusRank(b && b.status)
        if(rankDiff !== 0) return rankDiff
        return orderTimestamp(b) - orderTimestamp(a)
      })

      if(list.length===0){ container.innerHTML = '<div class="p-3">Không có hóa đơn</div>'; return }

      container.innerHTML = ''
      list.forEach(order => {
      const item = document.createElement('div')
      item.className = 'list-group-item'
      item.setAttribute('data-order-id', order.id)
      item.innerHTML = `
        <div class="d-flex justify-content-between align-items-start">
          <div>
            <div><strong>Mã:</strong> ${escapeHtml(order.id)}</div>
            <div><strong>Người đặt:</strong> ${escapeHtml(order.userName||order.userId||'Khách')}</div>
            <div class="small text-muted">Ngày: ${new Date(order.createdAt).toLocaleString()}</div>
            <div class="mt-2"><strong>Phương thức:</strong> ${escapeHtml(order.method||'')}</div>
            <div class="mt-2"><strong>Trạng thái:</strong> <span class="badge bg-${order.status==='approved'?'info':order.status==='cancelled'?'danger':'warning'}">${escapeHtml(statusLabel(order.status))}</span></div>
            ${order.shipper?`<div class="mt-1 small text-muted">Shipper: ${escapeHtml(order.shipper)}</div>`:''}
          </div>
          <div class="text-end">
            <div class="fw-bold">${fmt(order.total||0)}</div>
            <div class="mt-2">
              ${String(order.status||'').toLowerCase() === 'approved' ? '' : '<button class="btn btn-sm btn-success me-1 btn-approve">Xác nhận</button>'}
              <button class="btn btn-sm btn-danger me-1 btn-cancel">Hủy</button>
              <button class="btn btn-sm btn-outline-secondary btn-view">Xem</button>
            </div>
          </div>
        </div>
        <div class="mt-3">
          <div class="list-group">
            ${ (order.items||[]).map(it=>`<div class="list-group-item d-flex justify-content-between"><div>${escapeHtml(it.name)}<div class="small text-muted">Size: ${escapeHtml(it.size||'-')} x ${it.qty}</div></div><div>${fmt(parseInt(String(it.price||'').replace(/[^0-9]/g,''),10)||0)}</div></div>`).join('') }
          </div>
        </div>
      `

      // attach handlers
      const approveBtn = item.querySelector('.btn-approve')
      if(approveBtn){
        approveBtn.addEventListener('click', async function(){
          if(order.status === 'approved') return alert('Đã xác nhận')
        const ship = await openShipperModal(order)
        if(!ship) return
        order.shipper = ship.shipper
        order.address = ship.address
        order.status = 'approved'
        order.approvedAt = Date.now()
        setPageLoading(true, 'Đang cập nhật trạng thái đơn hàng...')
        try{
          const hdr = Object.assign({'Content-Type':'application/json'}, getAuthHeader())
          const url = BACKEND + '/api/orders/' + order.id + '/status?status=approved&shipper=' + encodeURIComponent(ship.shipper) + '&address=' + encodeURIComponent(ship.address||'')
          const resp = await fetch(url, { method: 'PUT', headers: hdr })
          if(resp.ok){
            try{ const updated = await resp.json(); order = Object.assign(order, updated) }catch(e){}
            writeOrders(readOrders().map(o=> String(o.id)===String(order.id)?order:o))
            await renderList()
            return
          }
        }catch(e){ console.warn(e) }

        // fallback to local update
        writeOrders(readOrders().map(o=> o.id===order.id?order:o))
        try{
          const userTarget = order.userId || 'user'
          if(window.notifications && window.notifications.add){
            window.notifications.add({
              title: 'Đơn hàng đang giao',
              message: 'Đơn ' + order.id + ' đang trên đường giao tới bạn trong thời gian sớm nhất.',
              target: userTarget,
              orderId: order.id
            })
          }
        }catch(e){ console.warn(e) }
        await renderList()
        })
      }

      item.querySelector('.btn-cancel').addEventListener('click', async function(){
        let reason = ''
        while(!reason){ reason = prompt('Lý do hủy đơn (bắt buộc)'); if(reason===null) return; reason = reason.trim() }
        setPageLoading(true, 'Đang hủy đơn hàng...')
        try{
          const hdr = Object.assign({'Content-Type':'application/json'}, getAuthHeader())
          const url = BACKEND + '/api/orders/' + order.id + '/status?status=cancelled&cancelReason=' + encodeURIComponent(reason)
          const resp = await fetch(url, { method: 'PUT', headers: hdr })
          if(resp.ok){
            try{ const updated = await resp.json(); order = Object.assign(order, updated) }catch(e){}
            writeOrders(readOrders().map(o=> String(o.id)===String(order.id)?order:o))
            await renderList()
            return
          }
        }catch(e){ console.warn(e) }

        // fallback
        order.status = 'cancelled'
        order.cancelReason = reason
        writeOrders(readOrders().map(o=> o.id===order.id?order:o))
        try{
          const userTarget = order.userId || 'user'
          if(window.notifications && window.notifications.add){
            const nlist = (window.notifications.list && window.notifications.list()) || []
            const existing = nlist.find(n => String(n.orderId) === String(order.id) && (n.target===userTarget || n.target==='user' || !n.target))
            if(existing){
              existing.title = 'Đơn đã bị hủy'
              existing.message = 'Đơn ' + order.id + ' bị hủy: ' + reason
              existing.read = false
              existing.createdAt = Date.now()
              localStorage.setItem('site_notifications_v1', JSON.stringify(nlist))
              localStorage.setItem('notificationsUpdatedAt', Date.now())
            } else {
              window.notifications.add({ title: 'Đơn đã bị hủy', message: 'Đơn ' + order.id + ' bị hủy: ' + reason, target: userTarget, orderId: order.id })
            }
          }
        }catch(e){ console.warn(e) }
        await renderList()
      })

      item.querySelector('.btn-view').addEventListener('click', function(){
        // Always use admin modal with current rendered order data.
        // notifications.js openOrderModal reads localStorage only and may miss DB-backed orders.
        showOrderModalInline(order)
      })

        container.appendChild(item)
      })
    } finally {
      setPageLoading(false)
    }
  }

  function showOrderModalInline(order){
    // fallback quick modal
    const modal = document.createElement('div')
    modal.className = 'modal fade'
    modal.tabIndex = -1
    modal.innerHTML = `
      <div class="modal-dialog modal-lg modal-dialog-centered"><div class="modal-content"><div class="modal-header"><h5 class="modal-title">Chi tiết ${escapeHtml(order.id)}</h5><button class="btn-close" data-bs-dismiss="modal"></button></div><div class="modal-body"><div><strong>Trạng thái:</strong> ${escapeHtml(statusLabel(order.status))}</div><div class="mt-2"><strong>Địa chỉ:</strong> ${escapeHtml(order.address)}</div><div class="mt-2"><strong>SDT:</strong> ${escapeHtml(order.phone)}</div><div class="mt-3"><strong>Sản phẩm:</strong><div class="list-group mt-2">${ (order.items||[]).map(it=>`<div class="list-group-item d-flex justify-content-between"><div>${escapeHtml(it.name)}<div class="small text-muted">Size: ${escapeHtml(it.size||'-')} x ${it.qty}</div></div><div>${fmt(parseInt(String(it.price||'').replace(/[^0-9]/g,''),10)||0)}</div></div>`).join('') }</div></div><div class="mt-3"><strong>Tổng:</strong> ${fmt(order.total||0)}</div><div class="mt-2"><strong>Ghi chú:</strong> ${escapeHtml(order.cancelReason||'')}</div></div><div class="modal-footer"><button class="btn btn-secondary" data-bs-dismiss="modal">Đóng</button></div></div></div>`
    document.body.appendChild(modal)
    const bs = new bootstrap.Modal(modal)
    bs.show()
    modal.addEventListener('hidden.bs.modal', ()=>{ try{ modal.parentNode.removeChild(modal) }catch(e){} })
  }

  function escapeHtml(s){ return String(s||'').replace(/[&"'<>]/g, function(m){ return ({'&':'&amp;','"':'&quot;',"'":'&#39;','<':'&lt;','>':'&gt;'})[m] }) }

  document.addEventListener('DOMContentLoaded', async function(){
    const search = document.getElementById('orders-search')
    const filter = document.getElementById('filter-status')
    search && search.addEventListener('input', debounce(renderList, 220))
    filter && filter.addEventListener('change', renderList)
    await renderList()
    // if page opened with ?openOrder=ID then open that order's modal
    try{
      const params = new URLSearchParams(window.location.search)
      const toOpen = params.get('openOrder')
      if(toOpen){
        const el = document.querySelector('[data-order-id="'+toOpen+'"]')
        if(el){
          const view = el.querySelector('.btn-view')
          if(view){ view.click() }
          else { el.scrollIntoView({behavior:'smooth', block:'center'}) }
        }else{
          // fallback: try fetching the order directly from backend
          const order = await fetchOrderById(toOpen)
          if(order){
            showOrderModalInline(order)
          } else if(window.showNotification){
            window.showNotification('Không tìm thấy hóa đơn', 'Có thể thông báo cũ thuộc đơn local trước khi kết nối server', 'warning', 2600)
          }
        }
      }
    }catch(e){}
    window.addEventListener('storage', function(e){ if(e.key==='ordersUpdatedAt' || e.key==='notificationsUpdatedAt'){ renderList() } })
  })

  // small debounce
  function debounce(fn, t){ let id; return function(){ clearTimeout(id); id = setTimeout(()=>fn.apply(this, arguments), t) } }

  // modal to pick shipper and confirm address
  async function openShipperModal(order){
    return new Promise(resolve=>{
      const modal = document.createElement('div');
      modal.className = 'modal fade';
      modal.tabIndex = -1;
      modal.innerHTML = `
        <div class="modal-dialog"><div class="modal-content">
          <div class="modal-header"><h5 class="modal-title">Xác nhận đơn ${escapeHtml(order.id)}</h5><button class="btn-close" data-bs-dismiss="modal"></button></div>
          <div class="modal-body">
            <div class="mb-2"><label class="form-label">Chọn hãng vận chuyển</label>
              <select id="shipper-select" class="form-select">
                <option value="SPX">SPX</option>
                <option value="JFX">JFX</option>
                <option value="GiaoHangNhanh">GiaoHangNhanh</option>
              </select>
            </div>
            <div class="mb-2"><label class="form-label">Địa chỉ giao</label><textarea id="shipper-address" class="form-control" rows="2">${escapeHtml(order.address||'')}</textarea></div>
          </div>
          <div class="modal-footer">
            <button class="btn btn-secondary" data-bs-dismiss="modal">Hủy</button>
            <button id="shipper-confirm" class="btn btn-primary">Xác nhận</button>
          </div>
        </div></div>`
      document.body.appendChild(modal)
      const bs = new bootstrap.Modal(modal); bs.show()
      modal.querySelector('#shipper-confirm').addEventListener('click', function(){
        const shipper = modal.querySelector('#shipper-select').value
        const address = modal.querySelector('#shipper-address').value.trim()
        if(!address){ alert('Vui lòng nhập địa chỉ'); return }
        bs.hide(); resolve({ shipper, address })
      })
      modal.addEventListener('hidden.bs.modal', ()=>{ try{ modal.remove() }catch(e){}; resolve(null) })
    })
  }

})();
