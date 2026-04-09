// Cart utility: stores cart in localStorage under 'cart'
(function(){
    const LEGACY_KEY = 'cart_items_v1';
    const KEY = 'cart_items_v1_scoped';
    const SELECTED_KEY = 'cart_selected_items_v1_scoped';
    const UPDATED_KEY = 'cartUpdatedAt_scoped';
    const BACKEND = (function(){
        try{
            const host = String(window.location.hostname || '').toLowerCase();
            if(host.includes('onrender.com')) return 'https://be-shoesshop.onrender.com';
        }catch(e){}
        return 'http://localhost:8080';
    })();

    function getCurrentUser(){
        try{ return JSON.parse(localStorage.getItem('currentUser') || 'null') || null; }catch(e){ return null; }
    }

    function getCartScope(){
        const cur = getCurrentUser();
        if(!cur) return 'guest';
        if(cur.id != null) return 'uid_' + String(cur.id);
        if(cur.username) return 'user_' + String(cur.username).trim().toLowerCase();
        if(cur.email) return 'mail_' + String(cur.email).trim().toLowerCase();
        return 'guest';
    }

    function getScopedCartKey(){
        return KEY + '__' + getCartScope();
    }

    function getScopedSelectedKey(){
        return SELECTED_KEY + '__' + getCartScope();
    }

    function getScopedUpdatedKey(){
        return UPDATED_KEY + '__' + getCartScope();
    }

    function getOrCreateDeviceId(){
        let deviceId = localStorage.getItem('device_id_v1');
        if(deviceId) return deviceId;

        try{
            deviceId = (window.crypto && typeof window.crypto.randomUUID === 'function')
                ? window.crypto.randomUUID()
                : ('dev-' + Date.now() + '-' + Math.random().toString(36).slice(2));
        }catch(e){
            deviceId = 'dev-' + Date.now();
        }
        localStorage.setItem('device_id_v1', deviceId);
        return deviceId;
    }

    function readCart(){
        try{
            const scopedKey = getScopedCartKey();
            const raw = localStorage.getItem(scopedKey);
            if(raw) return JSON.parse(raw);

            // Backward compatibility: only migrate old shared cart into guest scope.
            if(getCartScope() === 'guest'){
                const legacyRaw = localStorage.getItem(LEGACY_KEY);
                if(legacyRaw){
                    const legacy = JSON.parse(legacyRaw);
                    if(Array.isArray(legacy)){
                        localStorage.setItem(scopedKey, JSON.stringify(legacy));
                        return legacy;
                    }
                }
            }
            return [];
        }catch(e){
            console.error('Failed to read cart', e);
            return [];
        }
    }

    function writeCart(cart){
        try{
            localStorage.setItem(getScopedCartKey(), JSON.stringify(cart));
            // notify other tabs
            localStorage.setItem(getScopedUpdatedKey(), String(Date.now()));
            updateBadge();
        }catch(e){console.error('Failed to write cart', e)}
    }

    function getCartItemKey(item){
        return [String(item && item.id != null ? item.id : ''), String(item && item.size ? item.size : ''), String(item && item.color ? item.color : '')].join('||');
    }

    function readSelectedMap(){
        try{
            const raw = localStorage.getItem(getScopedSelectedKey());
            if(!raw) return null;
            const parsed = JSON.parse(raw);
            if(parsed && typeof parsed === 'object') return parsed;
        }catch(e){ /* ignore */ }
        return null;
    }

    function writeSelectedMap(map){
        try{ localStorage.setItem(getScopedSelectedKey(), JSON.stringify(map || {})); }catch(e){ /* ignore */ }
    }

    function clearSelectedMap(){
        try{ localStorage.removeItem(getScopedSelectedKey()); }catch(e){ /* ignore */ }
    }

    function ensureSelectedMapForCart(cart){
        const current = readSelectedMap();
        const keysInCart = new Set((cart || []).map(getCartItemKey));

        // first time: default all checked
        if(current == null){
            const init = {};
            (cart || []).forEach(function(it){ init[getCartItemKey(it)] = true; });
            writeSelectedMap(init);
            return init;
        }

        // prune removed items, keep existing choices
        const next = {};
        Object.keys(current).forEach(function(k){
            if(keysInCart.has(k)) next[k] = !!current[k];
        });

        // add new items as checked by default
        (cart || []).forEach(function(it){
            const k = getCartItemKey(it);
            if(next[k] == null) next[k] = true;
        });

        writeSelectedMap(next);
        return next;
    }

    function getTotalCount(cart){
        return cart.reduce((s,i)=>s + (i.qty || 0), 0);
    }

    function updateBadge(){
        const cart = readCart();
        const count = getTotalCount(cart);
        document.querySelectorAll('.cart-badge').forEach(el=>el.textContent = String(count));
    }

    function findItemIndex(cart, productId, size){
        return cart.findIndex(c=>String(c.id)===String(productId) && String(c.size||'')===String(size||''));
    }

    function addToCart(item){
        const cart = readCart();
        const idx = findItemIndex(cart, item.id, item.size);
        if(idx>=0){
            cart[idx].qty = (cart[idx].qty || 0) + (item.qty || 1);
        }else{
            cart.push(Object.assign({qty: item.qty||1}, item));
        }
        writeCart(cart);
    }

    function setQty(productId, size, qty){
        const cart = readCart();
        const idx = findItemIndex(cart, productId, size);
        if(idx>=0){
            if(qty<=0) cart.splice(idx,1); else cart[idx].qty = qty;
            writeCart(cart);
        }
    }

    function removeItem(productId, size){
        const cart = readCart();
        const idx = findItemIndex(cart, productId, size);
        if(idx>=0){ cart.splice(idx,1); writeCart(cart); }
    }

    function clearCart(){
        localStorage.removeItem(getScopedCartKey());
        clearSelectedMap();
        localStorage.setItem(getScopedUpdatedKey(), String(Date.now()));
        updateBadge();
    }

    function removeSelectedItemsFromCart(selectedItems){
        const cart = readCart();
        if(!cart.length) return;
        const selectedKeys = new Set((selectedItems || []).map(getCartItemKey));
        const remaining = cart.filter(function(it){ return !selectedKeys.has(getCartItemKey(it)); });
        writeCart(remaining);
        if(remaining.length === 0){
            clearSelectedMap();
        } else {
            ensureSelectedMapForCart(remaining);
        }
    }

    function addOrderNotifications(orderId){
        if(!window.notifications || typeof window.notifications.add !== 'function') return;
        const idText = orderId != null ? String(orderId) : ('o_' + Date.now());
        try{
            window.notifications.add({
                title: 'Đơn hàng mới',
                message: 'Đơn ' + idText + ' chờ duyệt',
                target: 'admin',
                orderId: idText
            });
            window.notifications.add({
                title: 'Đơn hàng đang chờ xác nhận',
                message: 'Đơn ' + idText + ' đã được tạo và đang chờ admin xác nhận',
                target: 'user',
                orderId: idText
            });
        }catch(e){ console.debug('Add order notifications failed', e); }
    }

    async function requireTwoFactorForCheckout(){
        const cur = (function(){
            try{ return JSON.parse(localStorage.getItem('currentUser')||'null')||null }catch(e){ return null }
        })();
        if(!cur || !cur.username) return true;

        try{
            const statusRes = await axios.post(BACKEND + '/api/auth/2fa/status', { username: cur.username });
            const enabled = !!(statusRes && statusRes.data && statusRes.data.enabled);
            if(!enabled) return true;

            const pin = prompt('Tài khoản đã bật xác thực 2 lớp. Vui lòng nhập mã PIN 6 số để thanh toán:');
            if(pin == null) return false;
            const pinText = String(pin).trim();
            if(!/^\d{6}$/.test(pinText)){
                if(window.showNotification) window.showNotification('Mã PIN không hợp lệ','PIN phải gồm đúng 6 số','error',2200);
                else alert('PIN phải gồm đúng 6 số');
                return false;
            }

            await axios.post(BACKEND + '/api/auth/2fa/verify', { username: cur.username, pin: pinText });
            return true;
        }catch(err){
            const msg = (function(){
                try{ return err && err.response && err.response.data && err.response.data.message ? err.response.data.message : '' }catch(e){ return '' }
            })();
            if(String(msg).toLowerCase().indexOf('pin.invalid') >= 0){
                if(window.showNotification) window.showNotification('Mã PIN không đúng','Vui lòng thử lại','error',2200);
                else alert('Mã PIN không đúng');
                return false;
            }
            if(window.showNotification) window.showNotification('Không thể xác thực 2 lớp','Vui lòng thử lại','error',2200);
            else alert('Không thể xác thực 2 lớp');
            return false;
        }
    }

    function getAuthHeaders(){
        try{
            const cur = JSON.parse(localStorage.getItem('currentUser')||'null')||null;
            if(cur && cur.username && cur.password){
                return { Authorization: 'Basic ' + btoa(cur.username + ':' + cur.password) };
            }
        }catch(e){ /* ignore */ }
        return {};
    }

    function is401(err){
        try{ return !!(err && err.response && err.response.status === 401) }catch(e){ return false }
    }

    function getApiErrorMessage(err, fallback){
        try{
            const d = err && err.response ? err.response.data : null;
            if(typeof d === 'string' && d.trim()) return d;
            if(d && d.message) return String(d.message);
            if(err && err.message) return String(err.message);
        }catch(e){ /* ignore */ }
        return fallback || 'Có lỗi xảy ra';
    }

    async function postWithOptionalAuthRetry(url, data, headers){
        try{
            return await axios.post(url, data, { headers: headers || {} });
        }catch(err){
            const hasAuth = !!(headers && headers.Authorization);
            const status = err && err.response ? err.response.status : 0;
            if(hasAuth && status === 401){
                // Stored credential may be stale on production; retry anonymous for guest-compatible endpoints.
                return await axios.post(url, data);
            }
            throw err;
        }
    }

    function parsePayAmount(total){
        const n = Number(total || 0);
        return Number.isFinite(n) ? Math.round(n) : 0;
    }

    async function showPayOsQrModal(orderId, amount, payInfo, headers){
        return new Promise(function(resolve){
            let timer = null;
            let settled = false;
            const qrRaw = (payInfo && payInfo.qrCode) ? String(payInfo.qrCode) : '';
            let checkoutUrl = (payInfo && payInfo.checkoutUrl) ? String(payInfo.checkoutUrl) : '';
            const paymentLinkId = (payInfo && payInfo.paymentLinkId) ? String(payInfo.paymentLinkId) : '';
            if(!checkoutUrl && paymentLinkId){
                checkoutUrl = 'https://pay.payos.vn/web/' + encodeURIComponent(paymentLinkId);
            }
            let qrSrc = '';
            if(qrRaw){
                qrSrc = qrRaw.startsWith('http') || qrRaw.startsWith('data:')
                    ? qrRaw
                    : ('https://api.qrserver.com/v1/create-qr-code/?size=260x260&data=' + encodeURIComponent(qrRaw));
            } else if(checkoutUrl) {
                qrSrc = 'https://api.qrserver.com/v1/create-qr-code/?size=260x260&data=' + encodeURIComponent(checkoutUrl);
            }

            const modal = document.createElement('div');
            modal.className = 'modal fade';
            modal.tabIndex = -1;
            modal.innerHTML = `
                <div class="modal-dialog modal-dialog-centered">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title">Quét QR để thanh toán</h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                        </div>
                        <div class="modal-body text-center">
                            <p class="mb-2">Đơn #${orderId}</p>
                            <p class="mb-2">Số tiền cần chuyển:</p>
                            <h4 class="text-danger mb-3">${new Intl.NumberFormat('vi-VN').format(parsePayAmount(amount))} đ</h4>
                            ${qrSrc ? `<img src="${qrSrc}" alt="PayOS QR" style="max-width:260px;width:100%;height:auto;"/>` : '<div class="alert alert-warning">Không lấy được QR từ PayOS</div>'}
                            ${checkoutUrl ? `<div class="mt-3"><a href="${checkoutUrl}" target="_blank" rel="noopener" class="btn btn-outline-primary btn-sm">Mở trang thanh toán</a></div>` : ''}
                            ${!qrSrc && !checkoutUrl ? `<details class="mt-3 text-start"><summary class="small text-muted">Chi tiết debug PayOS</summary><pre class="small mb-0">${JSON.stringify(payInfo || {}, null, 2)}</pre></details>` : ''}
                            <div class="small text-muted mt-3" id="payos-status-text">Đang chờ xác nhận giao dịch...</div>
                        </div>
                    </div>
                </div>`;
            document.body.appendChild(modal);
            const bs = new bootstrap.Modal(modal);

            function cleanupAndResolve(status){
                if(settled) return;
                settled = true;
                if(timer) clearInterval(timer);
                try{ bs.hide(); }catch(e){ /* ignore */ }
                try{ modal.parentNode && modal.parentNode.removeChild(modal); }catch(e){ /* ignore */ }
                resolve(status);
            }

            async function checkStatus(){
                try{
                    let res
                    try{
                        res = await axios.get(BACKEND + '/api/payments/' + orderId + '/status', { headers });
                    }catch(err){
                        if(is401(err)){
                            res = await axios.get(BACKEND + '/api/payments/' + orderId + '/status');
                        } else {
                            throw err;
                        }
                    }
                    const st = res && res.data && res.data.paymentStatus ? String(res.data.paymentStatus).toLowerCase() : '';
                    const stText = modal.querySelector('#payos-status-text');
                    if(stText) stText.textContent = 'Trạng thái: ' + (st || 'pending');
                    if(st === 'paid') cleanupAndResolve('paid');
                    if(st === 'expired') cleanupAndResolve('expired');
                }catch(e){
                    console.debug('Poll payment status failed', e);
                }
            }

            bs.show();
            timer = setInterval(checkStatus, 3000);
            checkStatus();
            modal.addEventListener('hidden.bs.modal', function(){ cleanupAndResolve('closed'); });
        });
    }

    // render cart page if present
    function renderCartPage(){
        const el = document.getElementById('cart-items');
        if(!el) return;
        const cart = readCart();
        const selectedMap = ensureSelectedMapForCart(cart);
        el.innerHTML = '';
        if(cart.length===0){
            el.innerHTML = '<div class="alert alert-info">Giỏ hàng đang rỗng.</div>';
            return;
        }

        function fmtMoney(v){
            if(window.formatVND) return window.formatVND(v);
            return new Intl.NumberFormat('vi-VN').format(v) + 'đ';
        }

        // compute numeric price helper (use global if available)
        function parsePrice(p){
            if(window.parsePrice) return window.parsePrice(p);
            if(p==null) return 0;
            if(typeof p === 'number') return p;
            const digits = String(p).replace(/[^0-9]/g,'');
            return digits ? parseInt(digits,10) : 0;
        }

        let selectedTotal = 0;
        const table = document.createElement('div');
        table.className = 'list-group';
        cart.forEach(item=>{
            const price = parsePrice(item.price);
            const subtotal = price * (item.qty || 1);
            const itemKey = getCartItemKey(item);
            const checked = !!selectedMap[itemKey];
            if(checked) selectedTotal += subtotal;

            const row = document.createElement('div');
            row.className = 'list-group-item';
            row.innerHTML = `
                <div class="d-flex gap-3 align-items-center">
                    <div class="form-check m-0">
                        <input class="form-check-input cart-item-check" type="checkbox" ${checked ? 'checked' : ''} data-item-key="${itemKey.replace(/"/g, '&quot;')}">
                    </div>
                    <img src="${item.img||''}" style="width:84px;height:84px;object-fit:contain"/>
                    <div class="flex-fill">
                        <div class="fw-bold">${item.name}</div>
                        <div class="small text-muted">Size: ${item.size||'-'}</div>
                        <div class="mt-2">${fmtMoney(price)} x <input type="number" value="${item.qty||1}" min="1" style="width:72px" data-id="${item.id}" data-size="${item.size||''}" class="cart-qty-input form-control d-inline-block"/> <button class="btn btn-sm btn-link text-danger btn-remove" data-id="${item.id}" data-size="${item.size||''}">Xóa</button></div>
                    </div>
                    <div class="text-end">
                        <div class="fw-bold">${fmtMoney(subtotal)}</div>
                    </div>
                </div>
            `;
            table.appendChild(row);
        });

        const footer = document.createElement('div');
        footer.className = 'mt-3';
        footer.innerHTML = `
            <div class="d-flex justify-content-between align-items-center">
                <div class="fs-5">Tổng (đã chọn):</div>
                <div class="fs-4 text-danger">${fmtMoney(selectedTotal)}</div>
            </div>
            <div class="mt-3 d-flex gap-2">
                <button id="checkout-btn" class="btn btn-success">Thanh toán</button>
                <button id="clear-cart-btn" class="btn btn-outline-secondary">Xóa toàn bộ</button>
            </div>
        `;

        el.appendChild(table);
        el.appendChild(footer);

        // attach events
        el.querySelectorAll('.cart-qty-input').forEach(inp=>{
            inp.addEventListener('change', e=>{
                const v = parseInt(e.target.value,10) || 1;
                const id = e.target.getAttribute('data-id');
                const size = e.target.getAttribute('data-size');
                setQty(id,size,v);
                renderCartPage();
            })
        });
        el.querySelectorAll('.cart-item-check').forEach(chk=>{
            chk.addEventListener('change', function(){
                const map = ensureSelectedMapForCart(readCart());
                const itemKey = chk.getAttribute('data-item-key') || '';
                map[itemKey] = !!chk.checked;
                writeSelectedMap(map);
                renderCartPage();
            });
        });
        el.querySelectorAll('.btn-remove').forEach(btn=>btn.addEventListener('click', e=>{
            const id = btn.getAttribute('data-id');
            const size = btn.getAttribute('data-size');
            removeItem(id,size);
            renderCartPage();
        }));

        document.getElementById('clear-cart-btn').addEventListener('click', async ()=>{
            try{
                var ok = true
                if(window.showConfirm){
                    ok = await window.showConfirm('Xóa toàn bộ giỏ hàng?', 'Xác nhận')
                } else {
                    ok = confirm('Xóa toàn bộ giỏ hàng?')
                }
                if(ok){ clearCart(); renderCartPage(); }
            }catch(e){/* ignore */}
        });
        document.getElementById('checkout-btn').addEventListener('click', async ()=>{
            const cartNow = readCart();
            if(cartNow.length===0) return;
            const map = ensureSelectedMapForCart(cartNow);
            const selectedItems = cartNow.filter(function(i){ return !!map[getCartItemKey(i)]; });
            if(selectedItems.length===0){
                if(window.showNotification) window.showNotification('Vui lòng tick sản phẩm cần thanh toán','error');
                else alert('Vui lòng tick sản phẩm cần thanh toán');
                return;
            }
            const total = selectedItems.reduce((s,i)=> s + (parseInt(String(i.price||'').replace(/[^0-9]/g,''),10)||0) * (i.qty||1), 0);
            try{
                const payload = await showCheckoutModal(selectedItems, total)
                if(!payload) return
                const twoFactorOk = await requireTwoFactorForCheckout()
                if(!twoFactorOk) return
                // payload: { address, phone, method, discount }
                // attempt server-side checkout first (will decrement inventory)
                const deviceId = getOrCreateDeviceId();
                const orderPayload = {
                    items: selectedItems.map(i=>({ name: i.name, color: i.color || null, size: i.size, qty: i.qty, price: i.price, productId: i.id })),
                    total: total,
                    address: payload.address,
                    phone: payload.phone,
                    method: payload.method,
                    deviceId: deviceId
                }
                try{
                    const cur = JSON.parse(localStorage.getItem('currentUser')||'null')||null
                    const headers = getAuthHeaders();
                    const res = await postWithOptionalAuthRetry(BACKEND + '/api/orders', orderPayload, headers)
                    const createdOrderId = res && res.data && res.data.id ? res.data.id : ('o_' + Date.now())
                    try{
                        if(cur && cur.username && cur.password && deviceId){
                            await postWithOptionalAuthRetry(BACKEND + '/api/devices/register', { deviceId }, headers)
                        }
                    }catch(e){ console.debug('Device register skipped/failed', e) }

                    if(payload.method === 'bank_transfer'){
                        const payRes = await postWithOptionalAuthRetry(BACKEND + '/api/payments/payos/create', { orderId: createdOrderId }, headers);
                        const paymentInfo = payRes && payRes.data ? payRes.data : {};
                        try{
                            localStorage.setItem('last_payos_create_debug', JSON.stringify({
                                at: Date.now(),
                                orderId: createdOrderId,
                                response: paymentInfo
                            }));
                        }catch(e){ /* ignore */ }
                        try{ console.log('[PayOS create response]', paymentInfo); }catch(e){ /* ignore */ }
                        const finalStatus = await showPayOsQrModal(createdOrderId, total, paymentInfo, headers);
                        if(finalStatus === 'paid'){
                            removeSelectedItemsFromCart(selectedItems); renderCartPage();
                            addOrderNotifications(createdOrderId)
                            if(window.showNotification) window.showNotification('Thanh toán thành công','Đơn hàng đã được xác nhận thanh toán','success',2600)
                        }else if(finalStatus === 'expired'){
                            if(window.showNotification) window.showNotification('Thanh toán hết hạn','Đơn hàng đã chuyển trạng thái hết hạn sau 10 phút','error',3000)
                        }
                        return;
                    }

                    // cash on delivery
                    removeSelectedItemsFromCart(selectedItems); renderCartPage();
                    addOrderNotifications(createdOrderId)
                    if(window.showNotification) window.showNotification('Đặt hàng thành công','Đơn hàng đã được gửi','success',2200)
                    return;
                }catch(err){
                    console.debug('Server checkout failed, falling back to local orders', err)
                    if(payload.method === 'bank_transfer'){
                        if(window.showNotification) window.showNotification('Không thể tạo thanh toán PayOS', getApiErrorMessage(err, 'Vui lòng đăng nhập lại rồi thử tiếp'), 'error', 3200)
                        return;
                    }

                    // fallback local order (if server fails)
                    const ordersKey = 'orders_v1'
                    let orders = []
                    try{ orders = JSON.parse(localStorage.getItem(ordersKey)||'[]') }catch(e){ orders = [] }
                    const order = {
                        id: 'o_' + Date.now(),
                        items: selectedItems,
                        total: total,
                        address: payload.address,
                        phone: payload.phone,
                        method: payload.method,
                        discount: payload.discount || null,
                        deviceId: deviceId,
                        status: 'pending',
                        userId: (function(){ try{ const cu = JSON.parse(localStorage.getItem('currentUser')||'null'); return cu && (cu.id || cu.email) ? (cu.id || cu.email) : null }catch(e){return null} })(),
                        userName: (function(){ try{ const cu = JSON.parse(localStorage.getItem('currentUser')||'null'); return cu && (cu.name || cu.fullName || cu.username) ? (cu.name || cu.fullName || cu.username) : null }catch(e){return null} })(),
                        createdAt: Date.now()
                    }
                    orders.unshift(order)
                    localStorage.setItem(ordersKey, JSON.stringify(orders))
                    addOrderNotifications(order.id)
                    removeSelectedItemsFromCart(selectedItems); renderCartPage();
                    if(window.showNotification) window.showNotification('Đặt hàng thành công','Đơn hàng chờ xác nhận','success',2200)
                }
            }catch(err){ console.error('Checkout flow failed', err); if(window.showNotification) window.showNotification('Thanh toán thất bại','Vui lòng thử lại','error',2500) }
        });
    }

    /* mini-cart dropdown */
    let miniEl = null;
    function renderMiniCart(){
        if(!miniEl){
            miniEl = document.createElement('div');
            miniEl.className = 'mini-cart shadow';
            miniEl.style.position = 'fixed';
            miniEl.style.right = '16px';
            miniEl.style.top = '56px';
            miniEl.style.width = '320px';
            miniEl.style.background = '#fff';
            miniEl.style.borderRadius = '8px';
            miniEl.style.zIndex = 2000;
            miniEl.style.display = 'none';
            miniEl.style.boxShadow = '0 8px 24px rgba(0,0,0,0.12)';
            document.body.appendChild(miniEl);
        }
        const cart = readCart();
        if(cart.length===0){
            miniEl.innerHTML = '<div class="p-3">Giỏ hàng trống</div>';
            return;
        }
        const items = cart.slice(0,4).map(i=>{
            const sub = (parsePrice(i.price) || 0) * (i.qty||1);
            return `<div class="d-flex gap-2 align-items-center p-2 border-bottom"><img src="${i.img||''}" style="width:56px;height:56px;object-fit:contain"/><div class="flex-fill"><div class="fw-bold">${i.name}</div><div class="small text-muted">Size: ${i.size||'-'} x ${i.qty}</div></div><div class="text-end">${fmtMoney(sub)}</div></div>`
        }).join('');
        const total = cart.reduce((s,i)=> s + (parsePrice(i.price) || 0) * (i.qty||1), 0);
        miniEl.innerHTML = `<div>${items}</div><div class="p-3"><div class="d-flex justify-content-between align-items-center"><strong>Tổng</strong><strong>${fmtMoney(total)}</strong></div><div class="mt-2 d-flex gap-2"><a href="cart.html" class="btn btn-sm btn-outline-primary flex-fill">Xem giỏ</a><button id="mini-checkout" class="btn btn-sm btn-primary flex-fill">Thanh toán</button></div></div>`;
        // attach checkout
        miniEl.querySelector('#mini-checkout').addEventListener('click', ()=>{ document.getElementById('checkout-btn') && document.getElementById('checkout-btn').click(); });
    }

    // show/hide on hover
    let hideTimer = null;
    document.addEventListener('mouseover', function(e){
        const cartAnchor = e.target.closest && e.target.closest('a[href="cart.html"]');
        if(cartAnchor){ renderMiniCart(); miniEl.style.display = 'block'; if(hideTimer) clearTimeout(hideTimer); }
    });
    document.addEventListener('mouseout', function(e){
        if(!miniEl) return;
        if(hideTimer) clearTimeout(hideTimer);
        hideTimer = setTimeout(()=>{ miniEl.style.display = 'none'; }, 350);
    });

    // expose API
    window.cart = {
        add: addToCart,
        remove: removeItem,
        setQty: setQty,
        get: readCart,
        clear: clearCart
    };

    // expose checkout modal to other scripts so single-product "Mua ngay" can reuse it
    window.showCheckoutModal = showCheckoutModal;

        // checkout modal builder
        async function showCheckoutModal(cartNow, total){
                return new Promise(function(resolve){
                        try{
                                const modal = document.createElement('div')
                                modal.className = 'modal fade'
                                modal.tabIndex = -1
                                modal.innerHTML = `
                                <div class="modal-dialog modal-dialog-centered">
                                    <div class="modal-content">
                                        <div class="modal-header"><h5 class="modal-title">Thanh toán</h5><button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button></div>
                                        <div class="modal-body">
                                            <div class="mb-2"><label class="form-label">Địa chỉ</label>
                                                <select id="checkout-saved-address" class="form-select mb-2"><option value="">-- Chọn địa chỉ đã lưu --</option></select>
                                                <textarea id="checkout-address" class="form-control" rows="2" placeholder="Nhập địa chỉ nhận hàng"></textarea></div>
                                            <div class="mb-2"><label class="form-label">Số điện thoại</label><input id="checkout-phone" class="form-control"/></div>
                                            <div class="mb-2"><label class="form-label">Phương thức thanh toán</label><div><div class="form-check form-check-inline"><input class="form-check-input" type="radio" name="payMethod" id="pay-cash" value="cash" checked><label class="form-check-label" for="pay-cash">Tiền mặt</label></div><div class="form-check form-check-inline"><input class="form-check-input" type="radio" name="payMethod" id="pay-account" value="bank_transfer"><label class="form-check-label" for="pay-account">Chuyển khoản ngân hàng (PayOS)</label></div></div></div>
                                            <div class="mb-2"><label class="form-label">Mã giảm giá</label><input id="checkout-discount" class="form-control" placeholder="Nhập mã nếu có"/></div>
                                            <div class="small text-muted">Tổng: <strong>${new Intl.NumberFormat('vi-VN').format(total)} đ</strong></div>
                                        </div>
                                        <div class="modal-footer"><button class="btn btn-secondary" data-bs-dismiss="modal">Hủy</button><button id="checkout-confirm" class="btn btn-primary">Xác nhận thanh toán</button></div>
                                    </div>
                                </div>`
                                document.body.appendChild(modal)
                                const bs = new bootstrap.Modal(modal)
                                bs.show()
                                // populate saved addresses
                                try{
                                    const cur = JSON.parse(localStorage.getItem('currentUser')||'null') || {}
                                    const sel = modal.querySelector('#checkout-saved-address')
                                    if(cur.addresses && Array.isArray(cur.addresses)){
                                        cur.addresses.forEach((a,idx)=>{
                                            const opt = document.createElement('option')
                                            // store index as value, display label (fallback to full)
                                            opt.value = String(idx)
                                            opt.textContent = a.label || a.full || ('Địa chỉ '+(idx+1))
                                            sel.appendChild(opt)
                                        })
                                    }
                                    if(cur.phone) modal.querySelector('#checkout-phone').value = cur.phone
                                }catch(e){}

                                modal.querySelector('#checkout-saved-address').addEventListener('change', function(){ 
                                    const v=this.value; 
                                    if(v){
                                        try{
                                            const cur = JSON.parse(localStorage.getItem('currentUser')||'null')||{}
                                            const a = (cur.addresses||[])[parseInt(v,10)]
                                            if(a){
                                                modal.querySelector('#checkout-address').value = a.full || ''
                                                if(a.phone) modal.querySelector('#checkout-phone').value = a.phone
                                            }
                                        }catch(e){ modal.querySelector('#checkout-address').value = v }
                                    }
                                })
                                function cleanup(){ try{ bs.hide() }catch(e){} try{ modal.parentNode && modal.parentNode.removeChild(modal) }catch(e){} }
                                modal.querySelector('#checkout-confirm').addEventListener('click', function(){
                                    const address = modal.querySelector('#checkout-address').value.trim()
                                    const phone = modal.querySelector('#checkout-phone').value.trim()
                                    const method = modal.querySelector('input[name="payMethod"]:checked').value
                                    const discount = modal.querySelector('#checkout-discount').value.trim()
                                    if(!address){ 
                                        if(window.showNotification) window.showNotification('Vui lòng nhập địa chỉ','error');
                                        else alert('Vui lòng nhập địa chỉ');
                                        return;
                                    }
                                    if(!phone){ 
                                        if(window.showNotification) window.showNotification('Vui lòng nhập số điện thoại','error');
                                        else alert('Vui lòng nhập số điện thoại');
                                        return;
                                    }
                                    cleanup(); resolve({ address, phone, method, discount })
                                })
                                modal.addEventListener('hidden.bs.modal', function(){ try{ modal.parentNode && modal.parentNode.removeChild(modal) }catch(e){} resolve(null) })
                        }catch(e){ console.error('checkout modal failed', e); resolve(null) }
                })
        }

    // init
    document.addEventListener('DOMContentLoaded', ()=>{
        updateBadge();
        renderCartPage();
    });

    // listen to storage updates from other tabs
    window.addEventListener('storage', (e)=>{
        if(e.key === getScopedUpdatedKey() || e.key === 'currentUser'){
            updateBadge();
            renderCartPage();
        }
    });

})();