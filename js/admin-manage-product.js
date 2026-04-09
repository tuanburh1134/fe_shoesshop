(function(){
  const BACKEND = 'http://localhost:8080'
  const API = BACKEND + '/api/products'

  function $(s){return document.querySelector(s)}
  function $all(s){return document.querySelectorAll(s)}

  let PRODUCTS = []

  async function loadList(){
    try{
      const res = await axios.get(API)
      PRODUCTS = Array.isArray(res.data) ? res.data : []
      renderList($('#admin-product-search') ? $('#admin-product-search').value.trim() : '')
      const searchEl = document.getElementById('admin-product-search')
      if(searchEl){
        searchEl.addEventListener('input', function(){ renderList(this.value.trim()) })
      }
    }catch(e){
      console.error(e);
      if(window.showNotification) showNotification('Không thể tải danh sách sản phẩm — xem console để biết chi tiết','error')
    }
  }

  function getProductTotalStock(product){
    if(!product) return 0
    let total = 0

    try{
      const inv = typeof product.inventory === 'string' ? JSON.parse(product.inventory) : product.inventory
      if(inv && typeof inv === 'object'){
        Object.keys(inv).forEach(color=>{
          const colorMap = inv[color]
          if(!colorMap || typeof colorMap !== 'object') return
          Object.keys(colorMap).forEach(size=>{
            total += parseInt(colorMap[size] || 0, 10) || 0
          })
        })
      }
    }catch(e){ /* ignore inventory parse errors and fallback below */ }

    if(total > 0) return total

    return (parseInt(product.qty39 || 0, 10) || 0)
      + (parseInt(product.qty40 || 0, 10) || 0)
      + (parseInt(product.qty41 || 0, 10) || 0)
      + (parseInt(product.qty42 || 0, 10) || 0)
      + (parseInt(product.qty43 || 0, 10) || 0)
      + (parseInt(product.qty44 || 0, 10) || 0)
  }

  function renderList(filter){
    const container = $('#admin-product-list')
    if(!container) return
    container.innerHTML = ''
    const items = (PRODUCTS || []).filter(p => !filter || (p.name || '').toLowerCase().indexOf(filter.toLowerCase()) !== -1)
    items.forEach(p => {
      const totalStock = getProductTotalStock(p)
      const el = document.createElement('div')
      el.className = 'list-group-item d-flex justify-content-between align-items-start'
      el.innerHTML = `
        <div>
          <div class="fw-bold">${p.name}</div>
          <div class="text-muted">${p.description}</div>
          <div class="text-muted">Hãng: ${p.brand || ''}</div>
          <div><strong>${(window.formatVND ? formatVND(p.price) : (p.price + ' VND'))}</strong> ${p.discount?`<span class="text-success">(-${p.discount}% )</span>`:''}</div>
          <div class="text-muted">Tồn kho còn lại: <strong>${totalStock}</strong></div>
        </div>
        <div>
          <button class="btn btn-sm btn-primary me-1 edit-btn" data-id="${p.id}">Sửa</button>
          <button class="btn btn-sm btn-danger del-btn" data-id="${p.id}">Xóa</button>
        </div>
      `
      container.appendChild(el)
    })
    // attach handlers
    document.querySelectorAll('.edit-btn').forEach(b=>b.addEventListener('click', onEdit))
    document.querySelectorAll('.del-btn').forEach(b=>b.addEventListener('click', onDelete))
  }

  function updateColorInventoryVisibility(){
    ['white','black','blue'].forEach(color=>{
      const cb = document.getElementById('color-' + color)
      const block = document.querySelector('.color-block[data-color="' + color + '"]')
      if(!block) return
      block.style.display = (cb && cb.checked) ? '' : 'none'
    })
  }

  function resetForm(){
    const setIf = (selector, prop, value='') => {
      const el = document.querySelector(selector)
      if(el) try{ el[prop] = value }catch(e){ /* ignore */ }
    }
    setIf('#prod-id','value','')
    setIf('#prod-name','value','')
    setIf('#prod-desc','value','')
    setIf('#prod-price','value','')
    setIf('#prod-discount','value','')
    setIf('#prod-detail','value','')
    const pb = document.getElementById('prod-brand')
    if(pb) try{ pb.value = '' }catch(e){}
    const fi = document.getElementById('prod-image')
    const fd = document.getElementById('prod-detail-images')
    if(fi) fi.value = ''
    if(fd) fd.value = ''
    const p1 = document.getElementById('prod-image-preview')
    const p2 = document.getElementById('prod-detail-images-preview')
    if(p1) p1.innerHTML = ''
    if(p2) p2.innerHTML = ''
    try{
      const sizes = ['39','40','41','42','43','44']
      for(let i=0;i<sizes.length;i++){
        const el = document.getElementById('qty-'+sizes[i])
        if(el) el.value = ''
      }
      // clear per-color quantities
      ['white','black','blue'].forEach(color=>{
        sizes.forEach(sz=>{
          const id = 'qty_' + color + '_' + sz
          const el = document.getElementById(id)
          if(el) el.value = ''
        })
      })
      // reset color checkboxes
      ['white','black','blue'].forEach(c=>{ const cb = document.getElementById('color-'+c); if(cb) cb.checked = true })
      updateColorInventoryVisibility()
    }catch(e){ }
  }

  async function onEdit(e){
    const id = e.currentTarget.dataset.id
    const btn = e.currentTarget
    try{
      // prevent double requests from double clicks
      if(btn.disabled) return
      btn.disabled = true
      const res = await axios.get(API + '/' + id)
      const prod = res.data
      if(!prod) return showNotification('Sản phẩm không tồn tại', 'error')
      $('#prod-id').value = prod.id
      $('#prod-name').value = prod.name
      $('#prod-desc').value = prod.description
      $('#prod-detail').value = prod.detail || ''
      try{
        $('#prod-price').value = (window.formatNumber ? formatNumber(prod.price) : (prod.price||''))
      }catch(err){ $('#prod-price').value = prod.price }
      $('#prod-discount').value = prod.discount || ''
      const q39 = document.getElementById('qty-39')
      const q40 = document.getElementById('qty-40')
      const q41 = document.getElementById('qty-41')
      const q42 = document.getElementById('qty-42')
      const q43 = document.getElementById('qty-43')
      const q44 = document.getElementById('qty-44')
      if(q39) q39.value = prod.qty39 || ''
      if(q40) q40.value = prod.qty40 || ''
      if(q41) q41.value = prod.qty41 || ''
      if(q42) q42.value = prod.qty42 || ''
      if(q43) q43.value = prod.qty43 || ''
      if(q44) q44.value = prod.qty44 || ''
      const pb = document.getElementById('prod-brand')
      if(pb) pb.value = prod.brand || ''
      const imgPreview = document.getElementById('prod-image-preview')
      const detPreview = document.getElementById('prod-detail-images-preview')
      if(imgPreview) imgPreview.innerHTML = prod.image ? `<img src="${(prod.image && prod.image.startsWith && prod.image.startsWith('/')? BACKEND+prod.image : prod.image)}" style="max-width:120px;max-height:80px">` : ''
      // detail images
      if(detPreview){
        detPreview.innerHTML = ''
        if(Array.isArray(prod.detailImages) && prod.detailImages.length){
          prod.detailImages.forEach(function(u){ const src = (u && u.startsWith && u.startsWith('/')? BACKEND+u : u); detPreview.innerHTML += `<img src="${src}" style="max-width:120px;max-height:100px;margin-right:8px">` })
        } else if(prod.detailImage){
          const src = (prod.detailImage && prod.detailImage.startsWith && prod.detailImage.startsWith('/')? BACKEND+prod.detailImage : prod.detailImage)
          detPreview.innerHTML = `<img src="${src}" style="max-width:180px;max-height:120px">`
        }
      }
      // populate inventory per-color if provided
      try{
        if(prod.inventory){
          const inv = (typeof prod.inventory === 'string') ? JSON.parse(prod.inventory) : prod.inventory
          ['white','black','blue'].forEach(color=>{
            const cb = document.getElementById('color-'+color)
            if(cb) cb.checked = !!inv[color]
            const sizes = ['39','40','41','42','43','44']
            sizes.forEach(sz=>{
              const el = document.getElementById('qty_'+color+'_'+sz)
              if(el) el.value = (inv[color] && inv[color][sz]) ? inv[color][sz] : ''
            })
          })
          // update totals in top-level qty fields as sum across colors
          const sizesArr = ['39','40','41','42','43','44']
          sizesArr.forEach(sz=>{
            let total = 0
            ['white','black','blue'].forEach(color=>{ if(inv[color] && inv[color][sz]) total += parseInt(inv[color][sz]||0) })
            const top = document.getElementById('qty-'+sz)
            if(top) top.value = total || ''
          })
          updateColorInventoryVisibility()
        }
      }catch(e){ console.warn('Failed to parse inventory', e) }
    }catch(e){
      console.error(e);
      var msg = 'Lấy sản phẩm thất bại'
      try{ if(e && e.response && e.response.data && e.response.data.message) msg = e.response.data.message }catch(ex){}
      if(window.showNotification) showNotification(msg, 'error')
    }
    finally{
      try{ btn.disabled = false }catch(e){}
      updateColorInventoryVisibility()
    }
  }

  async function onDelete(e){
    const id = e.currentTarget.dataset.id
    // use site-styled confirm dialog when available
    try{
      var ok = true
      if(window.showConfirm){
        ok = await window.showConfirm('Bạn có chắc muốn xóa sản phẩm này?', 'Xác nhận xóa')
      } else {
        ok = confirm('Bạn có chắc muốn xóa sản phẩm này?')
      }
      if(!ok) return
    }catch(err){ return }
    try{
      const cur = JSON.parse(localStorage.getItem('currentUser')||'null')
      const headers = cur && cur.username && cur.password ? { Authorization: 'Basic ' + btoa(cur.username+':'+cur.password) } : {}
      await axios.delete(API + '/' + id, { headers })
      localStorage.setItem('productsUpdated', Date.now())
      await loadList()
    }catch(e){console.error(e); if(window.showNotification) showNotification('Xóa thất bại', 'error') }
  }

  async function onSave(e){
    e.preventDefault()
    const id = $('#prod-id').value
    const form = new FormData()
    console.log('admin-manage-product: onSave start', {id: id})
    form.append('name', $('#prod-name').value.trim())
    form.append('description', $('#prod-desc').value.trim())
    form.append('detail', $('#prod-detail').value.trim())
    // parse formatted price (allow dots and spaces)
    const rawPrice = String($('#prod-price').value || '').replace(/[^0-9]/g,'')
    form.append('price', parseInt(rawPrice || '0', 10) || 0)
    form.append('discount', parseFloat($('#prod-discount').value) || 0)
    form.append('brand', $('#prod-brand').value || '')

    const fileImage = document.getElementById('prod-image')
    const fileDetail = document.getElementById('prod-detail-images')
    if(fileImage && fileImage.files && fileImage.files.length>0) form.append('image', fileImage.files[0])
    // append up to 10 detail images
    if(fileDetail && fileDetail.files && fileDetail.files.length>0){
      const max = Math.min(10, fileDetail.files.length)
      for(let i=0;i<max;i++){ form.append('detailImages', fileDetail.files[i]) }
      if(fileDetail.files.length>10) return showNotification && showNotification('Chỉ được chọn tối đa 10 ảnh chi tiết', 'error')
    }

    // build inventory object from per-color inputs (defensive)
    try{
      const inventory = {}
      const sizes = ['39','40','41','42','43','44']
      const colors = ['white','black','blue']
      if(!Array.isArray(sizes) || !Array.isArray(colors)) throw new Error('sizes or colors not defined')
      colors.forEach(color=>{
        const cb = document.getElementById('color-'+color)
        if(cb && cb.checked){
          inventory[color] = {}
          sizes.forEach(sz=>{
            const el = document.getElementById('qty_'+color+'_'+sz)
            const v = el && el.value ? parseInt(el.value||0) : 0
            if(v>0) inventory[color][sz] = v
          })
        }
      })

      // keep backward-compatible qty39..qty44 fields as totals across selected colors
      const totals = { '39':0, '40':0, '41':0, '42':0, '43':0, '44':0 }
      colors.forEach(color=>{
        sizes.forEach(sz=>{
          totals[sz] += (inventory[color] && inventory[color][sz]) ? parseInt(inventory[color][sz] || 0, 10) : 0
        })
      })
      form.append('qty39', totals['39'])
      form.append('qty40', totals['40'])
      form.append('qty41', totals['41'])
      form.append('qty42', totals['42'])
      form.append('qty43', totals['43'])
      form.append('qty44', totals['44'])

      form.append('inventory', JSON.stringify(inventory))
    }catch(err){
      console.error('Failed to build inventory', err)
      if(window.showNotification) showNotification('Lỗi form tồn kho: '+(err && err.message?err.message:''),'error')
    }

    try{
      const cur = JSON.parse(localStorage.getItem('currentUser')||'null')
      const headers = cur && cur.username && cur.password ? { Authorization: 'Basic ' + btoa(cur.username+':'+cur.password) } : {}
      let resp
      if(id){
        resp = await axios.put(API + '/' + id + '/upload', form, { headers: { ...headers, 'Content-Type': 'multipart/form-data' } })
      } else {
        resp = await axios.post(API + '/upload', form, { headers: { ...headers, 'Content-Type': 'multipart/form-data' } })
      }
      localStorage.setItem('productsUpdated', Date.now())
      try{ resetForm() }catch(e){ console.error('resetForm failed', e) }
      try{ await loadList() }catch(e){ console.error('loadList after save failed', e) }
      if(window.showNotification) showNotification('Lưu thành công','success')
    }catch(e){
      console.error(e)
      const status = e.response && e.response.status ? e.response.status : null
      const data = e.response && e.response.data ? e.response.data : null
      const msg = data && data.message ? data.message : (data ? JSON.stringify(data) : e.message)
      if(window.showNotification) showNotification('Lưu thất bại' + (status ? ' ('+status+')' : '') + ': ' + msg, 'error')
    }
  }

  // populate brand select using existing product brands from API
  async function loadBrands(){
    try{
      const res = await axios.get(API)
      const brands = Array.from(new Set((res.data || []).map(p=> (p.brand||'').trim()).filter(b=>b)))
      const sel = document.getElementById('prod-brand')
      if(!sel) return
      // keep placeholder if present
      const placeholder = sel.querySelector('option[value=""]')
      sel.innerHTML = ''
      if(placeholder) sel.appendChild(placeholder)
      brands.forEach(b=>{
        const opt = document.createElement('option')
        opt.value = b
        opt.textContent = (b === 'TheThao') ? 'Giày Thể Thao' : b
        sel.appendChild(opt)
      })
      const suggestions = ['Labubu','Nike','Adidas','Puma','Lacoste','Clarks','TheThao']
      suggestions.forEach(s=>{
        if(!brands.includes(s)){
          const opt = document.createElement('option')
          opt.value = s
          opt.textContent = (s === 'TheThao') ? 'Giày Thể Thao' : s
          sel.appendChild(opt)
        }
      })
    }catch(e){console.error('Could not load brands',e)}
  }

  document.addEventListener('DOMContentLoaded', function(){
    loadList()
    loadBrands()
    // format prod-price input while typing
    const priceInput = document.getElementById('prod-price')
    if(priceInput){
      priceInput.addEventListener('input', function(e){
        const digits = String(this.value).replace(/[^0-9]/g,'')
        this.value = digits ? (window.formatNumber ? formatNumber(digits) : digits) : ''
      })
      priceInput.addEventListener('focus', function(){ this.value = String(this.value).replace(/[^0-9]/g,'') })
      priceInput.addEventListener('blur', function(){ if(this.value) this.value = (window.formatNumber ? formatNumber(this.value) : this.value) })
    }
    const form = $('#product-form')
    if(form) form.addEventListener('submit', onSave)
    const resetBtn = $('#reset-btn')
    if(resetBtn) resetBtn.addEventListener('click', resetForm)

    ['white','black','blue'].forEach(color=>{
      const cb = document.getElementById('color-' + color)
      if(cb){
        cb.addEventListener('change', updateColorInventoryVisibility)
      }
    })
    updateColorInventoryVisibility()

    const imgInput = document.getElementById('prod-image')
    const detInput = document.getElementById('prod-detail-images')
    if(imgInput) imgInput.addEventListener('change', function(){
      const p = document.getElementById('prod-image-preview');
      if(this.files && this.files[0]) p.innerHTML = `<img src="${URL.createObjectURL(this.files[0])}" style="max-width:120px;max-height:80px">`
    })
    if(detInput) detInput.addEventListener('change', function(){
      const p = document.getElementById('prod-detail-images-preview');
      p.innerHTML = ''
      if(this.files && this.files.length){
        const max = Math.min(10, this.files.length)
        for(let i=0;i<max;i++){
          const img = document.createElement('img')
          img.src = URL.createObjectURL(this.files[i])
          img.style.maxWidth = '120px'
          img.style.maxHeight = '100px'
          img.style.marginRight = '8px'
          p.appendChild(img)
        }
        if(this.files.length>10) { if(window.showNotification) showNotification('Chỉ được chọn tối đa 10 ảnh chi tiết', 'error') }
      }
    })
  })

})();
