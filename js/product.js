const BACKEND = 'http://localhost:8080';
const API_URL = BACKEND + "/api/products";
function escapeHtml(s){ return String(s||'').replace(/[&"'<>]/g, function(m){ return ({'&':'&amp;','"':'&quot;',"'":"&#39;",'<':'&lt;','>':'&gt;'})[m] }) }
let CURRENT_BRAND_FILTER = null;

// Removed sampleProducts() to avoid shipping demo data in production.

let ALL_PRODUCTS = [];
const ITEMS_PER_ROW = 3;
const ROWS_PER_PAGE = 15; // as requested
const PAGE_SIZE = ITEMS_PER_ROW * ROWS_PER_PAGE; // 45 items per page
let currentPage = 1;
// advanced filter state
let ADV_FILTER = { brand: null, min: null, max: null, size: null, hasDiscount: false };
let SEARCH_QUERY = '';

function computeHotProducts(){
        const ordersKey = 'orders_v1';
        let counts = {};
        try{
                const orders = JSON.parse(localStorage.getItem(ordersKey)||'[]') || [];
                orders.forEach(o=>{
                        (o.items||[]).forEach(it=>{
                                const pid = it.productId || it.id;
                                if(!pid) return;
                                const qty = parseInt(it.qty||1,10)||1;
                                counts[pid] = (counts[pid]||0) + qty;
                        })
                })
        }catch(e){ counts = {}; }
        const ranked = Object.entries(counts).sort((a,b)=> b[1]-a[1]).slice(0,5).map(([id])=>String(id));
        return { hotIds: new Set(ranked), counts };
}

function addBadge(list, badge){
        if(!list) list = [];
        if(!list.includes(badge)) list.push(badge);
        return list;
}

async function loadProducts() {
        const container = document.getElementById("product-list");
        if(!container) return;
        container.innerHTML = "";

        const { hotIds, counts } = computeHotProducts();

        try{
                const response = await axios.get(API_URL);
                // map backend ProductDTO to frontend product model
                ALL_PRODUCTS = (response.data || []).map(p => ({
                        id: p.id,
                        name: p.name,
                        description: p.description,
                        price: p.price,
                        img: p.image || 'https://via.placeholder.com/240x140?text=Product',
                        detailImage: p.detailImage || '',
                        badges: p.hot ? ['HOT'] : [],
                        brand: p.brand || '',
                        qty39: p.qty39 || 0,
                        qty40: p.qty40 || 0,
                        qty41: p.qty41 || 0,
                        qty42: p.qty42 || 0,
                        qty43: p.qty43 || 0,
                        qty44: p.qty44 || 0,
                        purchaseCount: counts[p.id] || 0
                }));
        }catch(e){
                // If backend not available, do not populate with demo/sample products.
                ALL_PRODUCTS = [];
                console.warn('Failed to load products from API; no sample products will be used.', e);
        }

        // tag hot and sort to top
        ALL_PRODUCTS = ALL_PRODUCTS.map(p=>{
                if(hotIds.has(String(p.id))) p.badges = addBadge(p.badges||[], 'HOT');
                return p;
        }).sort((a,b)=>{
                const ah = hotIds.has(String(a.id)), bh = hotIds.has(String(b.id));
                if(ah !== bh) return ah? -1 : 1;
                return (b.purchaseCount||0) - (a.purchaseCount||0);
        });

        renderPage(currentPage);
        renderPagination();
        renderCategories();
}

function renderCategories(){
        const container = document.querySelector('.categories-nav .container');
        if(!container) return;

        // Default types requested by user (these will appear even if no product yet)
        const defaultTypes = [
                {brand: 'Nike', label: 'Giày Nike'},
                {brand: 'Adidas', label: 'Giày Adidas'},
                {brand: 'Lacoste', label: 'Giày Lacoste'},
                {brand: 'Puma', label: 'Giày Puma'},
                {brand: 'Clarks', label: 'Giày Clarks'},
                {brand: 'Labubu', label: 'giày labubu'},
                {brand: 'TheThao', label: 'Giày Thể Thao'}
        ];

        // compute unique brands from ALL_PRODUCTS (preserve original spelling)
        const foundBrands = Array.from(new Set(ALL_PRODUCTS.map(p=> (p.brand||'').trim() ).filter(b=>b)));

        // Merge defaultTypes and foundBrands into a single ordered list without duplicates
        const merged = [];
        const seen = new Set();

        // first add defaults (use brand key for filtering)
        defaultTypes.forEach(d => {
                if(!seen.has(d.brand)){
                        merged.push({brand: d.brand, label: d.label});
                        seen.add(d.brand);
                }
        });

        // then add any discovered brands from products (if different / new)
        foundBrands.forEach(b => {
                if(!seen.has(b)){
                        merged.push({brand: b, label: 'Giày ' + b});
                        seen.add(b);
                }
        });

        container.innerHTML = '';

        // add "Tất cả" button to clear brand filter
        const allEl = document.createElement('div');
        allEl.className = 'category-item all-item' + (CURRENT_BRAND_FILTER? '' : ' active');
        allEl.setAttribute('data-brand', '');
        allEl.textContent = 'Tất cả';
        container.appendChild(allEl);


        merged.forEach(item => {
                const b = item.brand;
                const label = item.label;
                const el = document.createElement('div');
                el.className = 'category-item';
                el.setAttribute('data-brand', b);
                el.textContent = label;

                // add special badges for Labubu and Adidas (case-insensitive match)
                if(String(b).toLowerCase() === 'labubu'){
                        const span = document.createElement('span'); span.className = 'badge badge-new'; span.textContent = 'New'; el.appendChild(span)
                }
                if(String(b).toLowerCase() === 'adidas'){
                        const span = document.createElement('span'); span.className = 'badge badge-sale'; span.textContent = 'Sale'; el.appendChild(span)
                }

                container.appendChild(el);
        });

        // actions area (right aligned) - filter button
        const actions = document.createElement('div');
        actions.className = 'categories-actions';
        actions.innerHTML = `<button id="open-filter-btn" class="btn btn-sm btn-outline-secondary">Lọc ▾</button>`;
        container.appendChild(actions);

        // attach click handlers to filter by brand
        const cats = container.querySelectorAll('.category-item[data-brand]');
        cats.forEach(c=>{
                c.addEventListener('click', function(){
                        const b = this.getAttribute('data-brand') || '';
                        // toggle filter: clicking same brand clears filter
                        if(!b) { CURRENT_BRAND_FILTER = null; } else { if(CURRENT_BRAND_FILTER === b) CURRENT_BRAND_FILTER = null; else CURRENT_BRAND_FILTER = b; }
                        // highlight selected
                        cats.forEach(x=> x.classList.toggle('active', (CURRENT_BRAND_FILTER? x.getAttribute('data-brand') === CURRENT_BRAND_FILTER : x.getAttribute('data-brand')==='' )));
                        // also update filter select if open
                        const sel = document.getElementById('filter-brand'); if(sel) sel.value = CURRENT_BRAND_FILTER || '';
                        // reset to page 1
                        currentPage = 1;
                        renderPage(currentPage);
                        renderPagination();
                })
        });

        // open filter panel when clicking button
        const filterBtn = document.getElementById('open-filter-btn');
        if(filterBtn){ filterBtn.addEventListener('click', ()=>{ toggleFilterPanel(); }); }

        // ensure clicking "Tất cả" clears brand filter
        allEl.addEventListener('click', function(){ CURRENT_BRAND_FILTER = null; cats.forEach(x=> x.classList.toggle('active', x.getAttribute('data-brand')==='' )); const sel = document.getElementById('filter-brand'); if(sel) sel.value = ''; currentPage = 1; renderPage(currentPage); renderPagination(); });

        // do not add extra right-side SALE label (removed per UI request)
}

// -- Filter panel UI and logic --
function toggleFilterPanel(){
        let panel = document.querySelector('.filter-panel');
        if(panel && panel.style.display === 'block'){ panel.style.display = 'none'; return; }
        if(!panel){
                panel = document.createElement('div');
                panel.className = 'filter-panel shadow';
                panel.innerHTML = `
                        <div class="filter-head d-flex justify-content-between align-items-center p-2 border-bottom"><strong>Bộ lọc nâng cao</strong><button id="filter-close" class="btn btn-sm btn-light">×</button></div>
                        <div class="p-3">
                                <div class="mb-2"><label class="form-label">Hãng</label><select id="filter-brand" class="form-select"><option value="">Tất cả</option></select></div>
                                <div class="mb-2"><label class="form-label">Giá (VNĐ)</label><div class="d-flex gap-2"><input id="filter-min" type="text" class="form-control" placeholder="từ"/><input id="filter-max" type="text" class="form-control" placeholder="đến"/></div></div>
                                <div class="mb-2"><label class="form-label">Cỡ giày</label><select id="filter-size" class="form-select"><option value="">Tất cả</option><option>39</option><option>40</option><option>41</option><option>42</option><option>43</option><option>44</option></select></div>
                                <div class="form-check mb-3"><input id="filter-discount" class="form-check-input" type="checkbox"><label class="form-check-label">Chỉ hiển thị đang giảm giá</label></div>
                                <div class="d-flex gap-2"><button id="apply-filter" class="btn btn-primary flex-fill">Áp dụng</button><button id="reset-filter" class="btn btn-outline-secondary flex-fill">Đặt lại</button></div>
                        </div>
                `;
                document.body.appendChild(panel);

                // populate brand select with merged brands
                const sel = panel.querySelector('#filter-brand');
                const brands = Array.from(new Set(ALL_PRODUCTS.map(p=> (p.brand||'').trim()).filter(b=>b))).sort();
                brands.forEach(b=>{ const opt = document.createElement('option'); opt.value = b; opt.textContent = b; sel.appendChild(opt); });

                panel.querySelector('#filter-close').addEventListener('click', ()=>{ panel.style.display='none'; });
                panel.querySelector('#apply-filter').addEventListener('click', ()=>{
                        ADV_FILTER.brand = panel.querySelector('#filter-brand').value || null;
                        ADV_FILTER.min = panel.querySelector('#filter-min').value ? parseInt(String(panel.querySelector('#filter-min').value).replace(/[^0-9]/g,''),10) : null;
                        ADV_FILTER.max = panel.querySelector('#filter-max').value ? parseInt(String(panel.querySelector('#filter-max').value).replace(/[^0-9]/g,''),10) : null;
                        ADV_FILTER.size = panel.querySelector('#filter-size').value || null;
                        ADV_FILTER.hasDiscount = !!panel.querySelector('#filter-discount').checked;
                        // sync brand category selection
                        if(ADV_FILTER.brand){ CURRENT_BRAND_FILTER = ADV_FILTER.brand; }
                        else { CURRENT_BRAND_FILTER = null; }
                        // update category active states
                        const cats = document.querySelectorAll('.categories-nav .container .category-item');
                        cats.forEach(x=> x.classList.toggle('active', (CURRENT_BRAND_FILTER? x.getAttribute('data-brand')===CURRENT_BRAND_FILTER : x.getAttribute('data-brand')==='')));
                        panel.style.display='none';
                        currentPage = 1; renderPage(currentPage); renderPagination();
                });
                panel.querySelector('#reset-filter').addEventListener('click', ()=>{
                        panel.querySelector('#filter-brand').value = '';
                        panel.querySelector('#filter-min').value = '';
                        panel.querySelector('#filter-max').value = '';
                        panel.querySelector('#filter-size').value = '';
                        panel.querySelector('#filter-discount').checked = false;
                        ADV_FILTER = { brand: null, min: null, max: null, size: null, hasDiscount: false };
                        CURRENT_BRAND_FILTER = null;
                        const cats = document.querySelectorAll('.categories-nav .container .category-item');
                        cats.forEach(x=> x.classList.toggle('active', x.getAttribute('data-brand')===''));
                        panel.style.display='none';
                        currentPage = 1; renderPage(currentPage); renderPagination();
                });
                // add formatting for min/max inputs
                const minIn = panel.querySelector('#filter-min');
                const maxIn = panel.querySelector('#filter-max');
                [minIn, maxIn].forEach(inp=>{
                        if(!inp) return;
                        inp.addEventListener('input', function(){ const d = String(this.value).replace(/[^0-9]/g,''); this.value = d? (window.formatNumber? formatNumber(d) : d) : '' });
                        inp.addEventListener('focus', function(){ this.value = String(this.value).replace(/[^0-9]/g,'') });
                        inp.addEventListener('blur', function(){ if(this.value) this.value = (window.formatNumber? formatNumber(this.value): this.value) });
                });
        }
        // position and show
        panel.style.display = 'block';
        panel.style.right = '16px';
        panel.style.top = '64px';
}

function productMatchesAdvancedFilters(p){
        // brand handled separately via CURRENT_BRAND_FILTER
        const price = parseInt(String(p.price||'').replace(/[^0-9]/g,''),10) || 0;
        if(ADV_FILTER.min != null && price < ADV_FILTER.min) return false;
        if(ADV_FILTER.max != null && price > ADV_FILTER.max) return false;
        if(ADV_FILTER.size){
                const sizeKey = 'qty' + ADV_FILTER.size;
                if(!(p[sizeKey] && p[sizeKey] > 0)) return false;
        }
        if(ADV_FILTER.hasDiscount){
                const hasDisc = !!(p.oldPrice || p.discount || (p.badges && p.badges.includes && p.badges.some(b=>/sale|sale/i.test(b))));
                if(!hasDisc) return false;
        }
        return true;
}

function renderProductCard(product){
                const badgesHtml = (product.badges||[]).map(b=>`<div class="badge-custom">${b}</div>`).join('');
        const ratingStars = Array.from({length: product.rating||0}).map(()=>'<i class="fa fa-star"></i>').join('');
        return `
                                <div class="product-item">
                                        <div class="product-card position-relative" style="cursor:pointer" onclick="window.location.href='product-detail.html?id=${product.id}'">
                                                <div class="badges">${badgesHtml}</div>
                                                                                <div class="media"><img src="${(product.img && product.img.startsWith && product.img.startsWith('/') ? BACKEND+product.img : product.img)||'https://via.placeholder.com/240x140?text=Product'}" alt="${product.name}"></div>
                                        ${((product.qty39||0)+(product.qty40||0)+(product.qty41||0)+(product.qty42||0)+(product.qty43||0)+(product.qty44||0))<=0?'<div class="badge-custom out-of-stock">Hết hàng</div>':''}
                        <div class="body">
                                                        <div class="mb-1" style="font-size:13px;color:#777">${product.brand||''}</div>
                            <div class="title">${product.name}</div>
                            <div class="rating">${ratingStars}</div>
                            <div class="meta">${product.description||''}</div>
                            <div class="mt-auto">
                                                        <span class="price">${formatVND(product.price)}</span>
                                                        ${product.oldPrice?`<span class="old-price">${formatVND(product.oldPrice)}</span>`:''}
                                                                <div class="mt-2 d-flex gap-2">
                                                                        <button class="btn btn-sm btn-outline-primary btn-add-list" data-id="${product.id}">Thêm vào giỏ</button>
                                                                </div>
                            </div>
                        </div>
                    </div>
                </div>
        `;
}

// attach delegated event for add buttons (handles dynamic content)
document.addEventListener('click', function(e){
        const btn = e.target.closest && e.target.closest('.btn-add-list');
        if(!btn) return;
        e.stopPropagation(); // prevent navigating to detail
        const id = btn.getAttribute('data-id');
        const product = ALL_PRODUCTS.find(p=>String(p.id)===String(id));
        if(!product) return;
                // open quick size selector modal before adding
                const imgEl = btn.closest('.product-card').querySelector('.media img');
                const imgUrl = imgEl && imgEl.src ? imgEl.src : (product.img || '');
                showQuickSizeModal(product, imgUrl, function(selected){
                        if(!selected) return;
                        const item = { id: product.id, name: product.name, price: parsePrice(product.price), img: imgUrl, size: selected.size || '', qty: selected.qty || 1 };
                        if(window.cart && typeof window.cart.add === 'function') window.cart.add(item);
                        else {
                                const raw = localStorage.getItem('cart_items_v1');
                                let list = raw ? JSON.parse(raw) : [];
                                const idx = list.findIndex(c=>String(c.id)===String(item.id) && String(c.size||'')===String(item.size||''));
                                if(idx>=0) list[idx].qty = (list[idx].qty||0) + item.qty; else list.push(item);
                                localStorage.setItem('cart_items_v1', JSON.stringify(list));
                                localStorage.setItem('cartUpdatedAt', String(Date.now()));
                        }
                        // animate
                        animateImageToCart(imgEl);
                        window.showNotification && window.showNotification('Đã thêm vào giỏ', product.name || '', 'success', 1200);
                })
});

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

        let destX = window.innerWidth - 40, destY = 20;
        if(cartRect){
                destX = cartRect.left + cartRect.width/2;
                destY = cartRect.top + cartRect.height/2;
        }

        const deltaX = destX - (imgRect.left + imgRect.width/2);
        const deltaY = destY - (imgRect.top + imgRect.height/2);

        requestAnimationFrame(()=>{
                clone.style.transform = `translate(${deltaX}px, ${deltaY}px) scale(0.14) rotate(8deg)`;
                clone.style.opacity = '0.95';
        });

        clone.addEventListener('transitionend', ()=>{ clone.remove(); const badge = document.querySelector('.cart-badge'); if(badge){ badge.animate([{transform:'scale(1)'},{transform:'scale(1.25)'},{transform:'scale(1)'}],{duration:300}); } }, { once:true });
}

function renderPage(page){
        const container = document.getElementById("product-list");
        if(!container) return;
        container.innerHTML = "";
        // apply brand filter if present
        let filtered = CURRENT_BRAND_FILTER ? ALL_PRODUCTS.filter(p=> (p.brand||'').toLowerCase() === String(CURRENT_BRAND_FILTER).toLowerCase()) : ALL_PRODUCTS.slice();
        // apply search by name
        if(SEARCH_QUERY){
                const q = SEARCH_QUERY.toLowerCase();
                filtered = filtered.filter(p=> (p.name||'').toLowerCase().includes(q));
        }
        // apply advanced filters
        filtered = filtered.filter(p => productMatchesAdvancedFilters(p));
        const start = (page - 1) * PAGE_SIZE;
        const end = start + PAGE_SIZE;
        const pageItems = filtered.slice(start, end);
        pageItems.forEach(p => container.innerHTML += renderProductCard(p));
}

function renderPagination(){
        const pag = document.getElementById('pagination');
        if(!pag) return;
        pag.innerHTML = '';
        // total should reflect any active brand filter
        let filtered = CURRENT_BRAND_FILTER ? ALL_PRODUCTS.filter(p=> (p.brand||'').toLowerCase() === String(CURRENT_BRAND_FILTER).toLowerCase()) : ALL_PRODUCTS;
        if(SEARCH_QUERY){
                const q = SEARCH_QUERY.toLowerCase();
                filtered = filtered.filter(p=> (p.name||'').toLowerCase().includes(q));
        }
        const total = filtered.length;
        const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

        function btn(label, disabled, dataPage){
                const el = document.createElement('button');
                el.className = 'btn btn-sm btn-outline-primary mx-1';
                if(disabled) el.classList.add('disabled');
                el.textContent = label;
                if(!disabled) el.addEventListener('click', ()=>{ currentPage = dataPage; renderPage(currentPage); renderPagination(); window.scrollTo({top:200,behavior:'smooth'}) });
                return el;
        }

        pag.appendChild(btn('‹ Prev', currentPage<=1, currentPage-1));

        // show page numbers with limit
        const maxButtons = 7;
        let startPage = Math.max(1, currentPage - Math.floor(maxButtons/2));
        let endPage = Math.min(totalPages, startPage + maxButtons - 1);
        if(endPage - startPage < maxButtons -1) startPage = Math.max(1, endPage - maxButtons +1);

        for(let i=startPage;i<=endPage;i++){
                const el = document.createElement('button');
                el.className = 'btn btn-sm mx-1 ' + (i===currentPage ? 'btn-primary' : 'btn-outline-primary');
                el.textContent = String(i);
                if(i!==currentPage) el.addEventListener('click', ()=>{ currentPage = i; renderPage(currentPage); renderPagination(); window.scrollTo({top:200,behavior:'smooth'}) });
                pag.appendChild(el);
        }

        pag.appendChild(btn('Next ›', currentPage>=totalPages, currentPage+1));
}

function initSearch(){
        const form = document.querySelector('.search-wrap form');
        const input = document.querySelector('.search-wrap .search-input');
        if(!form || !input) return;
        form.addEventListener('submit', function(e){
                e.preventDefault();
                SEARCH_QUERY = (input.value||'').trim();
                currentPage = 1;
                renderPage(currentPage);
                renderPagination();
        });
}

initSearch();
loadProducts();

// quick size modal used when adding from product list
function showQuickSizeModal(product, imgUrl, cb){
                try{
                                const sizes = ['39','40','41','42','43','44'];
                                const modal = document.createElement('div'); modal.className='modal fade'; modal.tabIndex=-1;
                                modal.innerHTML = `
                                                <div class="modal-dialog modal-dialog-centered"><div class="modal-content">
                                                        <div class="modal-header"><h5 class="modal-title">Chọn cỡ - ${escapeHtml(product.name||'')}</h5><button type="button" class="btn-close" data-bs-dismiss="modal"></button></div>
                                                        <div class="modal-body">
                                                                <div class="mb-2"><label class="form-label">Cỡ</label><div id="quick-sizes" class="d-flex gap-2 flex-wrap"></div></div>
                                                                <div class="mb-2"><label class="form-label">Số lượng</label><input id="quick-qty" type="number" min="1" value="1" class="form-control"/></div>
                                                        </div>
                                                        <div class="modal-footer"><button class="btn btn-secondary" data-bs-dismiss="modal">Hủy</button><button id="quick-add" class="btn btn-primary">Thêm vào giỏ</button></div>
                                                </div></div>`;
                                document.body.appendChild(modal);
                                const bs = new bootstrap.Modal(modal); bs.show();
                                const sizesContainer = modal.querySelector('#quick-sizes');
                                sizes.forEach(s=>{ const b = document.createElement('button'); b.className='btn btn-outline-secondary'; b.textContent=s; b.dataset.size=s; b.addEventListener('click', ()=>{ sizesContainer.querySelectorAll('button').forEach(x=>x.classList.remove('btn-primary')); b.classList.add('btn-primary'); }); sizesContainer.appendChild(b); });
                                modal.querySelector('#quick-add').addEventListener('click', function(){ const sel = modal.querySelector('#quick-sizes button.btn-primary'); const size = sel ? sel.dataset.size : ''; const qty = parseInt(modal.querySelector('#quick-qty').value,10) || 1; if(!size){ if(window.showNotification) window.showNotification('Vui lòng chọn cỡ giày','error'); return } bs.hide(); cb({ size:size, qty: qty }); });
                                modal.addEventListener('hidden.bs.modal', function(){ try{ modal.parentNode && modal.parentNode.removeChild(modal) }catch(e){} });
                }catch(e){ console.warn('quick size modal failed', e); cb(null) }
}

// Reload products when another tab/page signals an update
window.addEventListener('storage', function(e){
        if(e.key === 'productsUpdated'){
                // reload data and go back to first page
                currentPage = 1;
                loadProducts().catch(console.error)
        }
});

// Reload products when another tab/page signals an update
window.addEventListener('storage', function(e){
    if(e.key === 'productsUpdated'){
        loadProducts().catch(console.error)
    }
});
