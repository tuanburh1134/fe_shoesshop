// profile.js: load/save avatar and addresses, populate stats
(function(){
  try{ console.log('profile.js loaded') }catch(e){}
  function qs(sel){return document.querySelector(sel)}
  function qsa(sel){return Array.from(document.querySelectorAll(sel))}

  const avatarImg = qs('#profile-avatar')
  const avatarInput = qs('#avatar-input')
  const addressesList = qs('#addresses-list')
  const addAddrBtn = qs('#add-address')
  const statsTotalItems = qs('#total-purchased')
  const statsFirstPurchase = qs('#first-purchase')
  // Use absolute backend URL when frontend is opened via file:// (no dev static server)
  const BACKEND = window.location.protocol === 'file:' ? 'https://be-shoesshop.onrender.com' : ''

  function persistToUsers(cur){
    try{
      const users = JSON.parse(localStorage.getItem('users')||'[]')
      const idx = users.findIndex(u=>u.username===cur.username)
      if(idx>=0){
        users[idx] = Object.assign({}, users[idx], {
          addresses: cur.addresses||[],
          avatarUrl: cur.avatarUrl,
          avatarDataUrl: cur.avatarDataUrl,
          email: cur.email
        })
        localStorage.setItem('users', JSON.stringify(users))
      }
    }catch(err){ console.debug('profile: persistToUsers failed', err) }
  }

  async function loadCurrentUser(){
    try{
      console.log('profile: loadCurrentUser')
      let cur = JSON.parse(localStorage.getItem('currentUser')||'null') || {}
      // merge data from local users list if present (addresses/avatar)
      try{
        const users = JSON.parse(localStorage.getItem('users')||'[]')
        const u = users.find(x=>x.username===cur.username)
        if(u){ cur = Object.assign({}, u, cur, { addresses: u.addresses||cur.addresses||[] }) }
      }catch(err){ console.debug('profile: could not merge from users', err) }
      // try to fetch server profile if credentials present
      try{
        if(cur && cur.username && cur.password){
          const auth = 'Basic ' + btoa(cur.username + ':' + cur.password)
          console.debug('profile: fetching /api/me', { auth, url: BACKEND + '/api/me' })
          const res = await axios.get(BACKEND + '/api/me', { headers: { Authorization: auth } })
          if(res && res.data){
            // merge server data into local currentUser
            cur = Object.assign({}, cur, res.data)
            localStorage.setItem('currentUser', JSON.stringify(cur))
          }
        }
      }catch(err){ console.debug('Could not load server profile or not authenticated', err) }

      // avatar
      if(avatarImg && (cur.avatarUrl || cur.avatarDataUrl)){
        avatarImg.src = cur.avatarUrl || cur.avatarDataUrl
      }
      // addresses (server-backed if available)
      try{ renderAddresses(Array.isArray(cur.addresses) ? cur.addresses : JSON.parse(cur.addresses || '[]')) }catch(e){ renderAddresses(cur.addresses || []) }

      // stats from orders_v (still client-side)
      const orders = JSON.parse(localStorage.getItem('orders_v1')||'[]')
      const myOrders = orders.filter(o=>o.userId==cur.id || o.userName==cur.username)
      const totalItems = myOrders.reduce((s,o)=> s + (o.items? o.items.reduce((a,i)=>a+i.qty,0):0),0)
      if(statsTotalItems) statsTotalItems.textContent = totalItems
      if(myOrders.length){
        const first = myOrders.reduce((a,b)=> new Date(a.createdAt) < new Date(b.createdAt)? a: b)
        if(statsFirstPurchase) statsFirstPurchase.textContent = new Date(first.createdAt).toLocaleDateString()
      } else { statsFirstPurchase.textContent = '-'}
    }catch(e){console.error(e)}
  }

  function saveCurrentUser(cur){
    localStorage.setItem('currentUser', JSON.stringify(cur))
    try{ window.dispatchEvent(new Event('currentUserChanged')) }catch(e){}
  }

  function renderAddresses(addrs){
    if(!addressesList) return
    addressesList.innerHTML = ''
    addrs.forEach((ad, idx)=>{
      const div = document.createElement('div')
      div.className = 'address-item p-2 border rounded mb-2'
      div.innerHTML = `
        <div class="d-flex justify-content-between align-items-start">
          <div>
            <strong>${ad.label||('Địa chỉ '+(idx+1))}</strong>
            <div class="text-muted small">${ad.full}</div>
            <div class="text-muted small">${ad.phone||''}</div>
          </div>
          <div class="btn-group-vertical ms-2">
            <button class="btn btn-sm btn-outline-primary edit-addr" data-idx="${idx}">Sửa</button>
            <button class="btn btn-sm btn-outline-danger del-addr" data-idx="${idx}">Xóa</button>
          </div>
        </div>`
      addressesList.appendChild(div)
    })
    qsa('.edit-addr').forEach(b=> b.addEventListener('click', onEditAddr))
    qsa('.del-addr').forEach(b=> b.addEventListener('click', onDelAddr))
  }

  function onEditAddr(e){
    const idx = parseInt(e.currentTarget.dataset.idx)
    showAddressForm({mode:'edit', idx})
  }

  function onDelAddr(e){
    if(!confirm('Xóa địa chỉ này?')) return
    const idx = parseInt(e.currentTarget.dataset.idx)
    const cur = JSON.parse(localStorage.getItem('currentUser')||'null')||{}
    cur.addresses = cur.addresses||[]
    cur.addresses.splice(idx,1)
    saveCurrentUser(cur); persistToUsers(cur); renderAddresses(cur.addresses)
  }

  function onAddAddr(){
    showAddressForm({mode:'add'})
  }

  function showAddressForm(opts){
    const mode = opts.mode || 'add'
    const idx = typeof opts.idx === 'number' ? opts.idx : -1
    const cur = JSON.parse(localStorage.getItem('currentUser')||'null')||{}
    const existing = (cur.addresses||[])[idx] || {}
    const formWrap = document.createElement('div')
    formWrap.className = 'address-form p-3 border rounded mb-2'
    formWrap.innerHTML = `
      <div class="row g-2">
        <div class="col-md-4"><label class="form-label">Nhãn</label><input class="form-control" id="addr-label" value="${existing.label||''}"></div>
        <div class="col-md-8"><label class="form-label">Số nhà / Đường</label><input class="form-control" id="addr-house" value="${existing.house||existing.full||''}"></div>
        <div class="col-md-4 mt-2"><label class="form-label">Thành phố</label><input class="form-control" id="addr-city" value="${existing.city||''}"></div>
        <div class="col-md-4 mt-2"><label class="form-label">Huyện</label><input class="form-control" id="addr-district" value="${existing.district||''}"></div>
        <div class="col-md-4 mt-2"><label class="form-label">Xã</label><input class="form-control" id="addr-ward" value="${existing.ward||''}"></div>
        <div class="col-md-6 mt-2"><label class="form-label">Số điện thoại</label><input class="form-control" id="addr-phone" value="${existing.phone||''}"></div>
        <div class="col-12 mt-3 d-flex gap-2">
          <button id="addr-save" class="btn btn-primary btn-sm">Lưu</button>
          <button id="addr-cancel" class="btn btn-secondary btn-sm">Hủy</button>
        </div>
      </div>`

    const formContainer = qs('#address-form-container') || addressesList
    if(mode === 'add'){
      formContainer.innerHTML = ''
      formContainer.appendChild(formWrap)
    } else {
      const items = addressesList.querySelectorAll('.address-item')
      if(items && items[idx]){
        items[idx].style.display = 'none'

        formContainer.innerHTML = ''
        formContainer.appendChild(formWrap)
      } else {
        formContainer.appendChild(formWrap)
      }
    }

    function cleanup(){
      const items = addressesList.querySelectorAll('.address-item')
      if(items && items[idx]) items[idx].style.display = ''
      formWrap.remove()
    }

    formWrap.querySelector('#addr-cancel').addEventListener('click', function(){ cleanup() })
    formWrap.querySelector('#addr-save').addEventListener('click', function(){
      const label = formWrap.querySelector('#addr-label').value.trim()
      const house = formWrap.querySelector('#addr-house').value.trim()
      const city = formWrap.querySelector('#addr-city').value.trim()
      const district = formWrap.querySelector('#addr-district').value.trim()
      const ward = formWrap.querySelector('#addr-ward').value.trim()
      const phone = formWrap.querySelector('#addr-phone').value.trim()
      if(!house || !city){ alert('Vui lòng nhập Thành phố và Số nhà/đường'); return }
      const full = [house, ward, district, city].filter(Boolean).join(', ')
      cur.addresses = cur.addresses||[]
      const newAddr = { label: label||('Địa chỉ '+(cur.addresses.length+1)), full, phone, city, district, ward, house }
      if(mode === 'add'){
        cur.addresses.unshift(newAddr)
      } else {
        cur.addresses[idx] = newAddr
      }
      // save locally first and mirror to users list so login keeps addresses
      saveCurrentUser(cur)
      persistToUsers(cur)
      // attempt to persist to backend if authenticated
      try{
        if(cur && cur.username && cur.password){
          const auth = 'Basic ' + btoa(cur.username + ':' + cur.password)
          // payload: update only addresses and avatarUrl/email if present
          const payload = { addresses: JSON.stringify(cur.addresses) }
          if(cur.avatarUrl) payload.avatarUrl = cur.avatarUrl
          if(cur.email) payload.email = cur.email
          console.debug('profile: PUT /api/me', { url: BACKEND + '/api/me', payload })
          axios.put(BACKEND + '/api/me', payload, { headers: { Authorization: auth } }).then(r=>{
            // merge server return
            const server = r.data
            try{ cur.addresses = Array.isArray(server.addresses) ? server.addresses : JSON.parse(server.addresses||'[]') }catch(e){}
            saveCurrentUser(cur)
          }).catch(err=>{ console.debug('Failed to persist addresses to server', err) })
        }
      }catch(err){ console.debug('persist addresses error', err) }
      cleanup()
      renderAddresses(cur.addresses)
    })
  }

  function onAvatarChange(e){
    const f = e.target.files && e.target.files[0]
    if(!f) return
    const reader = new FileReader()
    reader.onload = function(ev){
      const url = ev.target.result
      avatarImg.src = url
      const cur = JSON.parse(localStorage.getItem('currentUser')||'null')||{}
      cur.avatarDataUrl = url
      saveCurrentUser(cur); persistToUsers(cur)
    }
    reader.readAsDataURL(f)
  }

  // init
  if(avatarInput) avatarInput.addEventListener('change', onAvatarChange)
  // wire change-avatar button to open file dialog
  const changeAvatarBtn = qs('#change-avatar')
  if(changeAvatarBtn && avatarInput) changeAvatarBtn.addEventListener('click', ()=> avatarInput.click())
  if(addAddrBtn) addAddrBtn.addEventListener('click', onAddAddr)
  loadCurrentUser()
})();
