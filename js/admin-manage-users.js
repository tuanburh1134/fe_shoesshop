(function(){
  const API = 'http://localhost:8080/api/users'
  const REGISTER_API = 'http://localhost:8080/api/auth/register'

  function getApiErrorMessage(err, fallback){
    try{
      if(err && err.response && err.response.data){
        const d = err.response.data
        if(typeof d === 'string' && d.trim()) return d
        if(d.message) return d.message
      }
      if(err && err.message) return err.message
    }catch(e){}
    return fallback || 'Có lỗi xảy ra'
  }

  function getAuthHeaders(){
    try{
      const cur = JSON.parse(localStorage.getItem('currentUser')||'null')
      if(cur && cur.username && cur.password){
        const token = btoa(cur.username + ':' + cur.password)
        return { Authorization: 'Basic ' + token }
      }
    }catch(e){ }
    return {}
  }

  function readLegacyUsers(){
    try{ return JSON.parse(localStorage.getItem('users')||'[]') || [] }catch(e){ return [] }
  }

  async function migrateLegacyUsersToBackend(){
    const list = readLegacyUsers()
    if(!Array.isArray(list) || list.length === 0) return

    for(const u of list){
      try{
        if(!u || !u.username || !u.password) continue
        // admin is seeded on backend already
        if(String(u.username).toLowerCase() === 'admin') continue
        const email = u.email || (u.username + '@example.com')
        await axios.post(REGISTER_API, { username: u.username, password: u.password, email: email })
      }catch(e){
        // ignore duplicate/conflict and continue
      }
    }
  }

  function el(sel){return document.querySelector(sel)}
  function render(users){
    const tbody = el('#users-table tbody')
    tbody.innerHTML = ''
    users.forEach(u=>{
      const tr = document.createElement('tr')
      const banText = u.bannedForever ? 'Vĩnh viễn' : (u.bannedUntil ? new Date(u.bannedUntil).toLocaleString() : '---')
      tr.innerHTML = `
        <td>${u.id}</td>
        <td>${u.username}</td>
        <td>${u.email || ''}</td>
        <td>
          <select class="form-select form-select-sm role-select" data-id="${u.id}">
            <option value="user" ${u.role==='user'?'selected':''}>Người dùng</option>
            <option value="admin" ${u.role==='admin'?'selected':''}>Quản trị</option>
          </select>
        </td>
        <td>${banText}</td>
        <td>
          <div class="btn-group">
            <button class="btn btn-sm btn-primary btn-set-role" data-id="${u.id}">Cập nhật</button>
            <button class="btn btn-sm btn-warning btn-ban" data-id="${u.id}">Khóa</button>
            <button class="btn btn-sm btn-secondary btn-unban" data-id="${u.id}">Gỡ khóa</button>
          </div>
        </td>
      `
      tbody.appendChild(tr)
    })

    // attach handlers
    document.querySelectorAll('.btn-set-role').forEach(b=>b.addEventListener('click', onSetRole))
    document.querySelectorAll('.btn-ban').forEach(b=>b.addEventListener('click', onBan))
    document.querySelectorAll('.btn-unban').forEach(b=>b.addEventListener('click', onUnban))
  }

  async function load(){
    try{
      await migrateLegacyUsersToBackend()
      const r = await axios.get(API, { headers: getAuthHeaders() })
      render(r.data || [])
    }catch(e){
      console.error(e)
      showNotification('Không thể tải danh sách người dùng', getApiErrorMessage(e, 'Bạn cần đăng nhập admin'), 'error', 2600)
    }
  }

  async function onSetRole(e){
    const id = e.currentTarget.dataset.id
    const sel = document.querySelector('.role-select[data-id="'+id+'"]')
    if(!sel) return
    const role = sel.value
    try{
      await axios.put(API + '/' + id + '/role?role=' + encodeURIComponent(role), null, { headers: getAuthHeaders() })
      showNotification('Đã cập nhật quyền', 'Phân quyền đã được lưu', 'success', 2200)
      load()
    }catch(e){
      console.error(e)
      showNotification('Cập nhật quyền thất bại', getApiErrorMessage(e, 'Không đủ quyền hoặc dữ liệu không hợp lệ'), 'error', 2800)
    }
  }

  async function onBan(e){
    const id = e.currentTarget.dataset.id
    const choice = prompt('Nhập số ngày khóa tài khoản này . Nhập "lock" để khóa vĩnh viễn:')
    if(choice === null) return
    if(choice === 'lock'){
      try{
        await axios.put(API + '/' + id + '/ban?forever=true', null, { headers: getAuthHeaders() })
        showNotification('Khóa vĩnh viễn thành công', 'Tài khoản đã bị khóa', 'success', 2200)
        load()
      }catch(e){
        console.error(e)
        showNotification('Khóa tài khoản thất bại', getApiErrorMessage(e, 'Không đủ quyền hoặc người dùng không tồn tại'), 'error', 2800)
      }
      return
    }
    const days = parseInt(choice)
    if(!days || days<=0) return showNotification('Giá trị ngày không hợp lệ', 'error')
    try{
      await axios.put(API + '/' + id + '/ban?days=' + days, null, { headers: getAuthHeaders() })
      showNotification('Đã khóa ' + days + ' ngày', 'Khóa tài khoản thành công', 'success', 2200)
      load()
    }catch(e){
      console.error(e)
      showNotification('Khóa tài khoản thất bại', getApiErrorMessage(e, 'Không đủ quyền hoặc dữ liệu không hợp lệ'), 'error', 2800)
    }
  }

  async function onUnban(e){
    const id = e.currentTarget.dataset.id
    try{
      var ok = true
      if(window.showConfirm){
        ok = await window.showConfirm('Gỡ khóa tài khoản này?', 'Xác nhận')
      } else {
        ok = confirm('Gỡ khóa tài khoản này?')
      }
      if(!ok) return
      await axios.put(API + '/' + id + '/ban', null, { headers: getAuthHeaders() })
      showNotification('Đã gỡ khóa', 'Tài khoản có thể đăng nhập lại', 'success', 2200)
      load()
    }catch(e){
      console.error(e)
      showNotification('Gỡ khóa thất bại', getApiErrorMessage(e, 'Không đủ quyền hoặc người dùng không tồn tại'), 'error', 2800)
    }
  }

  document.addEventListener('DOMContentLoaded', load)
})();
