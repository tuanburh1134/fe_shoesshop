(function(){
  const BACKEND = 'https://be-shoesshop.onrender.com';
  const FIVE_DAYS = 5 * 24 * 60 * 60 * 1000;
  const tabs = ['pending', 'approved', 'completed', 'history'];
  let productImageMap = {};

  function getCurrent(){
    try{return JSON.parse(localStorage.getItem('currentUser')||'null')}catch(e){return null}
  }

  function getAuthHeader(){
    const cur = getCurrent();
    if(cur && cur.username && cur.password){
      return { Authorization: 'Basic ' + btoa(cur.username + ':' + cur.password) };
    }
    return {};
  }

  function escapeHtml(s){
    return String(s||'').replace(/[&"'<>]/g, function(m){
      return ({'&':'&amp;','"':'&quot;',"'":'&#39;','<':'&lt;','>':'&gt;'})[m];
    });
  }

  function fmtMoney(v){
    const n = Number(v||0) || 0;
    return new Intl.NumberFormat('vi-VN').format(n) + ' đ';
  }

  function fmtDate(ts){
    if(!ts) return '-';
    try{return new Date(ts).toLocaleString('vi-VN')}catch(e){return '-'}
  }

  function resolveImageUrl(url){
    const raw = String(url || '').trim();
    if(!raw) return '';
    if(/^https?:\/\//i.test(raw) || /^data:/i.test(raw)) return raw;
    if(raw.startsWith('/uploads/')) return BACKEND + raw;
    if(raw.startsWith('uploads/')) return BACKEND + '/' + raw;
    return raw;
  }

  function normalizeLocalOrder(o){
    return {
      id: o.id,
      status: o.status || 'pending',
      createdAt: o.createdAt || Date.now(),
      approvedAt: o.approvedAt || null,
      shipper: o.shipper || '',
      method: o.method || '',
      address: o.address || '',
      total: Number(o.total) || 0,
      items: Array.isArray(o.items) ? o.items : []
    };
  }

  function classify(orders){
    const now = Date.now();
    const pending = [];
    const approved = [];
    const completed = [];

    orders.forEach(function(o){
      const st = String(o.status || '').toLowerCase();
      const approvedAt = Number(o.approvedAt || 0) || 0;
      const etaAt = approvedAt ? approvedAt + FIVE_DAYS : 0;
      const isCompletedByTime = approvedAt && now >= etaAt;

      if(st === 'pending'){
        pending.push(o);
        return;
      }

      if(st === 'approved'){
        if(isCompletedByTime) completed.push(o);
        else approved.push(o);
        return;
      }

      if(st === 'completed') completed.push(o);
    });

    return { pending: pending, approved: approved, completed: completed, history: orders };
  }

  function sumItems(order){
    const items = Array.isArray(order.items) ? order.items : [];
    return items.reduce(function(s, it){ return s + (Number(it.qty)||0); }, 0);
  }

  function getItemImage(item){
    if(item && item.img) return resolveImageUrl(item.img);
    if(item && item.image) return resolveImageUrl(item.image);
    const pid = item && item.productId != null ? String(item.productId) : '';
    if(pid && productImageMap[pid]) return resolveImageUrl(productImageMap[pid]);
    return 'assets/logo.jpg';
  }

  function renderItemsLines(order){
    const items = Array.isArray(order.items) ? order.items : [];
    if(!items.length) return '<div class="small text-muted">Không có sản phẩm</div>';

    return items.map(function(it){
      const img = getItemImage(it);
      return '' +
        '<div class="order-line">' +
        '  <img class="order-thumb" src="' + escapeHtml(img) + '" alt="item" onerror="this.onerror=null;this.src=\'assets/logo.jpg\'" />' +
        '  <div class="flex-fill">' +
        '    <div><strong>' + escapeHtml(it.name || 'Sản phẩm') + '</strong></div>' +
        '    <div class="small text-muted">Size: ' + escapeHtml(it.size || '-') + ' x ' + escapeHtml(it.qty || 0) + '</div>' +
        '  </div>' +
        '</div>';
    }).join('');
  }

  function renderEmpty(el, text){
    el.innerHTML = '<div class="text-muted small">' + escapeHtml(text) + '</div>';
  }

  function renderGroup(el, orders, type){
    if(!el) return;
    if(!orders.length){
      const msg = type === 'pending' ? 'Chưa có đơn chờ duyệt.'
        : (type === 'approved' ? 'Chưa có đơn đang giao.'
        : (type === 'completed' ? 'Chưa có đơn hoàn thành.' : 'Chưa có lịch sử mua hàng.'));
      renderEmpty(el, msg);
      return;
    }

    el.innerHTML = orders.map(function(o){
      const approvedAt = Number(o.approvedAt || 0) || 0;
      const etaAt = approvedAt ? approvedAt + FIVE_DAYS : 0;
      const transport = o.shipper || 'Đang cập nhật đơn vị vận chuyển';
      const extraApproved = type === 'approved'
        ? ('<div class="small text-muted">Trạng thái: Đơn đang trên đường giao đến bạn</div>' +
           '<div class="small text-muted">Đơn vị vận chuyển: ' + escapeHtml(transport) + '</div>' +
           '<div class="small text-muted">Ngày duyệt: ' + escapeHtml(fmtDate(approvedAt)) + '</div>' +
           '<div class="small text-muted">Ngày dự kiến giao: ' + escapeHtml(fmtDate(etaAt)) + '</div>')
        : '';

      return '' +
        '<div class="border rounded p-3 mb-2">' +
        '  <div class="d-flex justify-content-between align-items-start gap-3 mb-2">' +
        '    <div>' +
        '      <div><strong>Mã đơn:</strong> ' + escapeHtml(o.id) + '</div>' +
        '      <div class="small text-muted">Ngày đặt: ' + escapeHtml(fmtDate(o.createdAt)) + '</div>' +
        '      <div class="small text-muted">Số lượng sản phẩm: ' + escapeHtml(sumItems(o)) + '</div>' +
        '      ' + extraApproved +
        '    </div>' +
        '    <div class="text-end">' +
        '      <div class="fw-bold">' + escapeHtml(fmtMoney(o.total)) + '</div>' +
        '      <div class="small text-muted text-capitalize">' + escapeHtml(o.status) + '</div>' +
        '    </div>' +
        '  </div>' +
        '  <div class="mt-2">' + renderItemsLines(o) + '</div>' +
        '</div>';
    }).join('');
  }

  function switchTab(target){
    tabs.forEach(function(tab){
      const panel = document.getElementById('orders-panel-' + tab);
      if(panel) panel.classList.toggle('d-none', tab !== target);
    });
    document.querySelectorAll('#orders-tabs [data-orders-tab]').forEach(function(btn){
      btn.classList.toggle('active', btn.getAttribute('data-orders-tab') === target);
    });
  }

  async function preloadProductImages(){
    try{
      const res = await axios.get(BACKEND + '/api/products');
      const list = Array.isArray(res.data) ? res.data : [];
      productImageMap = {};
      list.forEach(function(p){
        if(p && p.id != null){
          productImageMap[String(p.id)] = p.image || '';
        }
      });
    }catch(e){
      productImageMap = {};
    }
  }

  async function fetchOrders(){
    const cur = getCurrent();
    if(!cur || !cur.username) return [];

    const headers = getAuthHeader();
    try{
      if(headers.Authorization){
        const res = await axios.get(BACKEND + '/api/orders', { headers: headers });
        if(Array.isArray(res.data)) return res.data;
      }
    }catch(e){ }

    try{
      const localOrders = JSON.parse(localStorage.getItem('orders_v1')||'[]') || [];
      return localOrders.filter(function(o){
        return String(o.userName || '').toLowerCase() === String(cur.username).toLowerCase();
      }).map(normalizeLocalOrder);
    }catch(e){
      return [];
    }
  }

  async function render(){
    const ordersRaw = await fetchOrders();
    const orders = (ordersRaw || []).slice().sort(function(a,b){ return (Number(b.createdAt)||0) - (Number(a.createdAt)||0); });
    const groups = classify(orders);

    renderGroup(document.getElementById('orders-pending'), groups.pending, 'pending');
    renderGroup(document.getElementById('orders-approved'), groups.approved, 'approved');
    renderGroup(document.getElementById('orders-completed'), groups.completed, 'completed');
    renderGroup(document.getElementById('orders-history'), groups.history, 'history');
  }

  document.addEventListener('DOMContentLoaded', async function(){
    document.querySelectorAll('#orders-tabs [data-orders-tab]').forEach(function(btn){
      btn.addEventListener('click', function(){
        switchTab(btn.getAttribute('data-orders-tab'));
      });
    });

    switchTab('pending');
    await preloadProductImages();
    await render();

    window.setInterval(render, 60 * 1000);
    window.addEventListener('storage', function(e){
      if(e.key === 'ordersUpdatedAt' || e.key === 'orders_v1') render();
    });
  });
})();
