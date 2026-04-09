const BACKEND = 'https://be-shoesshop.onrender.com';
const API_URL = BACKEND + '/api/products';

// Helpers to parse inventory and stock
function parseInventory(raw){
    if(!raw) return null;
    try{
        return typeof raw === 'string' ? JSON.parse(raw) : raw;
    }catch(e){ console.warn('Cannot parse inventory', e); return null; }
}

function getAvailableSizesFromInventory(inv){
    if(!inv) return null;
    const set = new Set();
    Object.values(inv).forEach(colorMap => {
        if(!colorMap || typeof colorMap !== 'object') return;
        Object.keys(colorMap).forEach(size => set.add(String(size)));
    });
    return Array.from(set).sort();
}

function qs(name){
    const u = new URL(window.location.href);
    return u.searchParams.get(name);
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

function notifyMsg(title, message, type, duration){
    if(window.showNotification) window.showNotification(title, message || '', type || 'info', duration || 1800);
    else if(title) alert(title + (message ? ('\n' + message) : ''));
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
    }catch(e){ console.debug('Add notification failed', e); }
}

async function loadProduct(){
    const id = qs('id');
    if(!id) return;
    let product = null;
    let items = [];
    try{
        const res = await axios.get(API_URL);
        items = res.data || [];
        product = items.find(p => String(p.id) === String(id));
    }catch(e){
        console.error(e);
    }
    if(!product){
        // No product found — show friendly message instead of sample data
        const crumb = document.getElementById('crumb-name'); if(crumb) crumb.textContent = 'Sản phẩm không tồn tại';
        const main = document.getElementById('main-image'); if(main) main.innerHTML = '<div class="alert alert-warning">Sản phẩm không tồn tại hoặc đã bị xóa.</div>';
        const nameEl = document.getElementById('pd-name'); if(nameEl) nameEl.textContent = '';
        const brandEl = document.getElementById('pd-brand'); if(brandEl) brandEl.textContent = '';
        const priceEl = document.getElementById('pd-price'); if(priceEl) priceEl.textContent = '';
        const oldEl = document.getElementById('pd-oldprice'); if(oldEl) oldEl.textContent = '';
        const detailEl = document.getElementById('pd-detail'); if(detailEl) detailEl.innerHTML = '';
        return;
    }

    renderProduct(product, items);
}

function renderProduct(p, allProducts){
    const inventory = parseInventory(p.inventory);
    const colors = inventory ? Object.keys(inventory) : [];
    let selectedColor = null;
    let selectedSize = null;
    const addBtn = document.getElementById('pd-add');
    const buyBtn = document.getElementById('pd-buy');

    function updateActionButtons(){
        const hasColorSelection = colors.length > 0 ? !!selectedColor : true;
        const canSubmit = hasColorSelection && !!selectedSize;
        if(addBtn) addBtn.disabled = !canSubmit;
        if(buyBtn) buyBtn.disabled = !canSubmit;
    }

    document.getElementById('pd-name').textContent = p.name || '';
    document.getElementById('pd-brand').textContent = p.brand || '';
    document.getElementById('pd-price').textContent = (window.formatVND ? formatVND(p.price) : (p.price||''));
    document.getElementById('pd-oldprice').textContent = (p.oldPrice ? (window.formatVND ? formatVND(p.oldPrice) : p.oldPrice) : '');
    document.getElementById('pd-detail').innerHTML = p.detail || p.description || '';
    document.getElementById('crumb-name').textContent = p.name || 'Sản phẩm';

    const main = document.getElementById('main-image');
    main.innerHTML = '';
    const imgUrl = (p.image && p.image.startsWith && p.image.startsWith('/') ? BACKEND + p.image : p.image) || 'https://via.placeholder.com/640x420?text=Product';
    const img = document.createElement('img'); img.src = imgUrl; img.style.maxWidth = '100%'; img.style.maxHeight = '520px'; img.style.objectFit='contain';
    main.appendChild(img);

    const thumbs = document.getElementById('thumbs'); thumbs.innerHTML = '';
    const thumbUrls = [];
    // primary image first
    if(p.image) thumbUrls.push((p.image && p.image.startsWith('/')? BACKEND + p.image : p.image));
    // detailImage fallback
    if(p.detailImage) thumbUrls.push((p.detailImage && p.detailImage.startsWith('/')? BACKEND + p.detailImage : p.detailImage));
    // parse detailImages JSON (array of urls) and append all
    try{
        if(p.detailImages){
            let arr = [];
            if(typeof p.detailImages === 'string') arr = JSON.parse(p.detailImages || '[]');
            else if(Array.isArray(p.detailImages)) arr = p.detailImages;
            arr.forEach(u => { if(u) thumbUrls.push((u && u.startsWith('/')? BACKEND + u : u)); })
        }
    }catch(e){ /* ignore parse errors */ }
    // remove duplicates while preserving order
    const seen = new Set();
    const uniq = thumbUrls.filter(u => { if(!u) return false; if(seen.has(u)) return false; seen.add(u); return true; });
    if(uniq.length === 0) uniq.push('https://via.placeholder.com/240x140?text=Product');

    uniq.forEach(u => {
        const t = document.createElement('div');
        t.className = 'p-1 border me-2';
        t.style.cursor = 'pointer';
        t.style.width = '72px';
        t.innerHTML = `<img src="${u}" style="width:100%;height:64px;object-fit:contain">`;
        t.addEventListener('click', ()=>{ main.querySelector('img').src = u });
        thumbs.appendChild(t);
    });

    // Color picker (if inventory provides colors)
    const colorWrap = document.getElementById('pd-colors') || (()=>{
        const host = document.getElementById('pd-color-block');
        if(host) return host;
        const cont = document.createElement('div');
        cont.id = 'pd-colors';
        const label = document.createElement('div'); label.className='mb-1 fw-semibold'; label.textContent = 'Màu sắc';
        cont.appendChild(label);
        const btnRow = document.createElement('div'); btnRow.id='pd-color-row'; btnRow.className='d-flex gap-2 flex-wrap'; cont.appendChild(btnRow);
        const sizesBlock = document.getElementById('pd-sizes-block') || document.getElementById('pd-sizes');
        if(sizesBlock && sizesBlock.parentNode){ sizesBlock.parentNode.insertBefore(cont, sizesBlock); }
        else document.body.appendChild(cont);
        return cont;
    })();
    const colorRow = document.getElementById('pd-color-row'); if(colorRow) colorRow.innerHTML='';
    if(colorRow && colors.length){
        colors.forEach(c=>{
            const b = document.createElement('button');
            b.className='btn btn-outline-secondary';
            b.textContent = c;
            b.addEventListener('click', ()=>{
                selectedColor = c;
                selectedSize = null;
                colorRow.querySelectorAll('button').forEach(x=>x.classList.remove('btn-primary'));
                b.classList.add('btn-primary');
                renderSizes();
                updateActionButtons();
            });
            colorRow.appendChild(b);
        });
    }

    // sizes and add handlers with per-color stock
    const pdSizes = document.getElementById('pd-sizes');
    function renderSizes(){
        if(!pdSizes) return;
        pdSizes.innerHTML = '';

        // If product has color variants, require selecting color first before showing sizes.
        if(colors.length > 0 && !selectedColor){
            pdSizes.innerHTML = '<div class="small text-muted">Vui lòng chọn màu trước để hiển thị size.</div>';
            return;
        }

        const derivedSizes = getAvailableSizesFromInventory(inventory) || ['39','40','41','42','43','44'];
        derivedSizes.forEach(s => {
            const btn = document.createElement('button');
            btn.className = 'btn btn-outline-secondary d-flex flex-column align-items-center justify-content-center';
            const sizeSpan = document.createElement('span'); sizeSpan.textContent = s; sizeSpan.className = 'fw-bold';
            const stockSpan = document.createElement('small'); stockSpan.className = 'text-muted';

            // compute available
            let available = null;
            if(inventory && selectedColor && inventory[selectedColor]){
                const val = inventory[selectedColor][s];
                available = (val == null) ? 0 : Number(val);
            } else {
                const qtyKey = 'qty' + s;
                if(typeof p[qtyKey] !== 'undefined') available = p[qtyKey] || 0;
            }

            if(available === null){
                stockSpan.textContent = '';
            } else if(available <= 0){
                stockSpan.textContent = 'Hết hàng';
                btn.disabled = true;
                btn.classList.add('disabled');
            } else {
                stockSpan.textContent = 'Còn ' + available;
            }

            btn.appendChild(sizeSpan);
            btn.appendChild(stockSpan);
            btn.dataset.size = s;
            if(selectedSize && selectedSize === s && !btn.disabled){
                btn.classList.add('btn-primary');
            }
            btn.addEventListener('click', ()=>{
                if(btn.disabled) return;
                selectedSize = s;
                pdSizes.querySelectorAll('button').forEach(b=>b.classList.remove('btn-primary'));
                btn.classList.add('btn-primary');
                updateActionButtons();
            });
            pdSizes.appendChild(btn);
        });
    }
    renderSizes();
    updateActionButtons();

    function ensureSelectedVariant(actionLabel){
        const selectedColorBtn = colors.length > 0 ? document.querySelector('#pd-color-row .btn-primary') : null;
        const selectedSizeBtn = document.querySelector('#pd-sizes button.btn-primary');

        if(colors.length > 0 && !selectedColorBtn){
            notifyMsg('Vui lòng chọn màu sắc', 'Bạn cần chọn màu trước khi ' + actionLabel, 'error', 2200);
            return false;
        }
        if(!selectedSizeBtn){
            notifyMsg('Vui lòng chọn size', 'Bạn cần chọn size trước khi ' + actionLabel, 'error', 2200);
            return false;
        }

        // Sync state from DOM to avoid stale variable issues.
        if(colors.length > 0) selectedColor = selectedColorBtn ? (selectedColorBtn.textContent || '').trim() : selectedColor;
        selectedSize = selectedSizeBtn ? selectedSizeBtn.dataset.size : selectedSize;
        return true;
    }

    document.getElementById('pd-add').addEventListener('click', ()=>{
        if(!ensureSelectedVariant('thêm vào giỏ')) return;
        const size = selectedSize || '';
        const color = selectedColor || '';
        const qty = parseInt(document.getElementById('pd-qty').value,10) || 1;
        // if selected size has no stock, block adding
        if(size){
            let available = null;
            if(inventory && color && inventory[color]){
                const v = inventory[color][size];
                available = (v == null) ? 0 : Number(v);
            } else {
                const qtyKey = 'qty' + size; available = (typeof p[qtyKey] !== 'undefined') ? (p[qtyKey] || 0) : null;
            }
            if(available !== null && available <= 0){ alert('Sản phẩm size ' + size + ' đã hết'); return }
        }
        const item = { id: p.id, name: p.name, price: parsePrice(p.price || p.priceText || ''), img: imgUrl, size: size, color: color, qty: qty };
        // add to cart storage
        if(window.cart && typeof window.cart.add === 'function'){
            window.cart.add(item);
        }else{
            // fallback: store minimal info in localStorage
            const raw = localStorage.getItem('cart_items_v1');
            let list = raw ? JSON.parse(raw) : [];
            const idx = list.findIndex(c=>String(c.id)===String(item.id) && String(c.size||'')===String(item.size||''));
            if(idx>=0) list[idx].qty = (list[idx].qty||0) + item.qty; else list.push(item);
            localStorage.setItem('cart_items_v1', JSON.stringify(list));
            // notify other tabs
            localStorage.setItem('cartUpdatedAt', String(Date.now()));
        }

        // animate image to cart and show notification
        const imgEl = main.querySelector('img');
        animateImageToCart(imgEl);
        window.showNotification && window.showNotification('Đã thêm vào giỏ', p.name || '', 'success', 1400);
    });
    document.getElementById('pd-buy').addEventListener('click', async ()=>{
        // open the same checkout modal used by the cart, pre-filled for this single product
        if(!ensureSelectedVariant('mua hàng')) return;
        const size = selectedSize || '';
        const color = selectedColor || '';
        const qty = parseInt(document.getElementById('pd-qty').value,10) || 1;
        if(size){
            let available = null;
            if(inventory && color && inventory[color]){
                const v = inventory[color][size];
                available = (v == null) ? 0 : Number(v);
            } else {
                const qtyKey = 'qty' + size; available = (typeof p[qtyKey] !== 'undefined') ? (p[qtyKey] || 0) : null;
            }
            if(available !== null && available <= 0){ alert('Sản phẩm size ' + size + ' đã hết'); return }
        }
        const item = { id: p.id, name: p.name, price: parsePrice(p.price || p.priceText || ''), img: imgUrl, size: size, color: color, qty: qty };
        try{
            if(typeof window.showCheckoutModal === 'function'){
                const payload = await window.showCheckoutModal([item], (item.qty||1) * (parseInt(String(item.price||'').replace(/[^0-9]/g,''),10)||0));
                if(!payload) return;
                // use the same server checkout flow as cart checkout first
                if(payload.method === 'cash'){
                    const total = (parseInt(String(item.price||'').replace(/[^0-9]/g,''),10)||0) * (item.qty||1);
                    const deviceId = getOrCreateDeviceId();
                    const cur = JSON.parse(localStorage.getItem('currentUser')||'null')||null;
                    const orderPayload = {
                        items: [{ name: item.name, color: item.color || null, size: item.size, qty: item.qty, price: item.price, productId: item.id }],
                        total: total,
                        address: payload.address,
                        phone: payload.phone,
                        method: payload.method,
                        deviceId: deviceId
                    };

                    try{
                        const headers = {};
                        if(cur && cur.username && cur.password){
                            headers['Authorization'] = 'Basic ' + btoa(cur.username + ':' + cur.password);
                        }

                        const created = await axios.post(BACKEND + '/api/orders', orderPayload, { headers });
                        const createdOrderId = created && created.data && created.data.id ? created.data.id : ('o_' + Date.now());

                        // Register device for current account so notification scoping per machine works reliably
                        try{
                            if(cur && cur.username && cur.password && deviceId){
                                await axios.post(BACKEND + '/api/devices/register', { deviceId }, { headers });
                            }
                        }catch(e){
                            console.debug('Device register skipped/failed', e);
                        }

                        addOrderNotifications(createdOrderId);
                        notifyMsg('Bạn đã thanh toán thành công', 'Đơn hàng đang chờ xác nhận', 'success', 2200);
                        return;
                    }catch(err){
                        console.debug('Buy-now server checkout failed, fallback to local order', err);
                    }

                    // fallback local order
                    const ordersKey = 'orders_v1';
                    let orders = [];
                    try{ orders = JSON.parse(localStorage.getItem(ordersKey)||'[]'); }catch(e){ orders = []; }
                    const order = {
                        id: 'o_' + Date.now(),
                        items: [item],
                        total: total,
                        address: payload.address,
                        phone: payload.phone,
                        method: payload.method,
                        discount: payload.discount || null,
                        status: 'pending',
                        createdAt: Date.now(),
                        deviceId: deviceId,
                        userId: (cur && (cur.id || cur.email)) ? (cur.id || cur.email) : null,
                        userName: (cur && (cur.name || cur.fullName || cur.username)) ? (cur.name || cur.fullName || cur.username) : null
                    };
                    orders.unshift(order);
                    localStorage.setItem(ordersKey, JSON.stringify(orders));
                    localStorage.setItem('ordersUpdatedAt', String(Date.now()));
                    addOrderNotifications(order.id);
                    notifyMsg('Bạn đã thanh toán thành công', 'Đơn hàng chờ xác nhận', 'success', 2200);
                } else {
                    notifyMsg('Phương thức chưa phát triển', 'Vui lòng chọn tiền mặt', 'error', 2200);
                }
            } else {
                // fallback: redirect to checkout page
                notifyMsg('Chuyển đến thanh toán', p.name || '', 'info', 800);
                setTimeout(()=>{ window.location.href = 'checkout.html' }, 800);
            }
        }catch(e){ console.error('Mua ngay failed', e); notifyMsg('Thanh toán thất bại', 'Vui lòng thử lại', 'error', 2500); }
    });

        renderSimilarProducts(p, allProducts || []);
}

function renderSimilarProducts(current, allProducts){
        const container = document.getElementById('similar-products');
        const note = document.getElementById('similar-products-note');
        if(!container) return;

        const brand = (current && current.brand ? String(current.brand) : '').trim().toLowerCase();
        const list = (allProducts || []).filter(x => {
                if(!x) return false;
                if(String(x.id) === String(current.id)) return false;
                const b = (x.brand ? String(x.brand) : '').trim().toLowerCase();
                return !!brand && b === brand;
        }).slice(0, 8);

        if(note){
                if(!brand) note.textContent = 'Sản phẩm liên quan';
                else note.textContent = 'Cùng hãng ' + (current.brand || '');
        }

        if(list.length === 0){
                container.innerHTML = '<div class="col-12"><div class="alert alert-light border">Chưa có sản phẩm tương tự để hiển thị.</div></div>';
                return;
        }

        container.innerHTML = list.map(function(item){
                const img = (item.image && item.image.startsWith && item.image.startsWith('/')) ? (BACKEND + item.image) : (item.image || 'https://via.placeholder.com/240x140?text=Product');
                const name = item.name || 'Sản phẩm';
                const price = window.formatVND ? formatVND(item.price) : (item.price || '');
                return `
                        <div class="col-12 col-sm-6 col-md-4 col-lg-3">
                            <div class="card h-100 shadow-sm">
                                <a href="product-detail.html?id=${item.id}" class="text-decoration-none text-dark">
                                    <img src="${img}" class="card-img-top" alt="${name}" style="height:180px;object-fit:contain;background:#fff;padding:10px;">
                                    <div class="card-body d-flex flex-column">
                                        <h6 class="card-title mb-1" style="min-height:38px;">${name}</h6>
                                        <div class="small text-muted mb-2">${item.brand || ''}</div>
                                        <div class="fw-bold text-danger mt-auto">${price}</div>
                                    </div>
                                </a>
                            </div>
                        </div>
                `;
        }).join('');
}

loadProduct().catch(console.error);

// animate cloned image from product to cart icon in header
function animateImageToCart(imgEl){
    if(!imgEl) return;
    const cartAnchor = document.querySelector('a[href="cart.html"]');
    const cartRect = cartAnchor ? cartAnchor.getBoundingClientRect() : null;
    const imgRect = imgEl.getBoundingClientRect();

    const clone = imgEl.cloneNode(true);
    clone.style.position = 'fixed';
    clone.style.left = imgRect.left + 'px';
    clone.style.top = imgRect.top + 'px';
    clone.style.width = imgRect.width + 'px';
    clone.style.height = imgRect.height + 'px';
    clone.style.transition = 'transform 700ms cubic-bezier(.2,.8,.2,1), opacity 700ms';
    clone.style.zIndex = 9999;
    clone.style.pointerEvents = 'none';
    clone.style.objectFit = 'contain';
    document.body.appendChild(clone);

    // compute destination center (cart badge center)
    let destX = window.innerWidth - 40, destY = 20;
    if(cartRect){
        destX = cartRect.left + cartRect.width/2;
        destY = cartRect.top + cartRect.height/2;
    }

    const deltaX = destX - (imgRect.left + imgRect.width/2);
    const deltaY = destY - (imgRect.top + imgRect.height/2);

    requestAnimationFrame(()=>{
        clone.style.transform = `translate(${deltaX}px, ${deltaY}px) scale(0.18) rotate(10deg)`;
        clone.style.opacity = '0.95';
    });

    clone.addEventListener('transitionend', ()=>{
        clone.remove();
        // small pop on badge
        const badge = document.querySelector('.cart-badge');
        if(badge){
            badge.animate([
                { transform: 'scale(1)' },
                { transform: 'scale(1.25)' },
                { transform: 'scale(1)' }
            ], { duration: 360, easing: 'cubic-bezier(.2,.8,.2,1)' });
        }
    }, { once: true });
}
