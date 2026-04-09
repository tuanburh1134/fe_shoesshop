// Simple client-side auth for demo purposes
(function(){
  const BACKEND = 'https://be-shoesshop.onrender.com'
  const AUTH_API = BACKEND + '/api/auth'
  const GOOGLE_CLIENT_ID = '213568517226-ac26ekl9ngmsh2agc1i3qmtspnajd78c.apps.googleusercontent.com'

  function applySavedTheme(){
    try{
      var isDark = localStorage.getItem('ui_dark_mode') === '1'
      document.body.classList.toggle('app-dark', isDark)
    }catch(e){}
  }
  applySavedTheme()

  function $(sel){return document.querySelector(sel)}
  function getUsers(){
    try{return JSON.parse(localStorage.getItem('users')||'[]')||[];}catch(e){return[]}
  }
  function saveUsers(u){localStorage.setItem('users',JSON.stringify(u))}
  function setCurrent(user){
    localStorage.setItem('currentUser',JSON.stringify(user))
    try{ window.dispatchEvent(new Event('currentUserChanged')) }catch(e){}
  }
  function getCurrent(){try{return JSON.parse(localStorage.getItem('currentUser')||'null')}catch(e){return null}}
  function notify(title, msg){
    if(window.showNotification) window.showNotification(title, msg || '', 'error', 2600)
    else alert(title + (msg ? ('\n' + msg) : ''))
  }
  function success(title, msg){
    if(window.showNotification) window.showNotification(title, msg || '', 'success', 1800)
    else alert(title + (msg ? ('\n' + msg) : ''))
  }
  function apiMessage(err, fallback){
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
  function isInvalidCredentialsError(err, msg){
    try{
      var status = err && err.response ? err.response.status : null
      var text = String(msg || '').toLowerCase()
      if(text.indexOf('pin.required') >= 0 || text.indexOf('pin.invalid') >= 0 || text.indexOf('account.locked') >= 0) return false
      if(status === 401 || status === 403) return true
      if(text.indexOf('bad credentials') >= 0 || text.indexOf('invalid credentials') >= 0 || text.indexOf('unauthorized') >= 0) return true
    }catch(e){}
    return false
  }
  function createLoadingOverlay(text){
    var old = document.getElementById('login-loading-overlay')
    if(old && old.parentNode) old.parentNode.removeChild(old)

    var overlay = document.createElement('div')
    overlay.id = 'login-loading-overlay'
    overlay.style.position = 'fixed'
    overlay.style.inset = '0'
    overlay.style.background = 'rgba(15,23,42,.45)'
    overlay.style.display = 'flex'
    overlay.style.alignItems = 'center'
    overlay.style.justifyContent = 'center'
    overlay.style.zIndex = '100005'
    overlay.innerHTML = '' +
      '<div style="background:#fff;padding:14px 16px;border-radius:12px;box-shadow:0 14px 28px rgba(0,0,0,.2);display:flex;align-items:center;gap:10px;min-width:220px;justify-content:center">' +
      '  <span class="spinner-border spinner-border-sm text-primary" role="status" aria-hidden="true"></span>' +
      '  <span style="font-weight:600;color:#1f2937">' + (text || 'Đang đăng nhập...') + '</span>' +
      '</div>'
    document.body.appendChild(overlay)
    return overlay
  }
  function isGoogleClientConfigured(){
    return GOOGLE_CLIENT_ID && GOOGLE_CLIENT_ID.indexOf('YOUR_GOOGLE_CLIENT_ID') === -1
  }
  function getHeaderAvatar(cur){
    if(!cur) return ''
    if(cur.avatarDataUrl) return cur.avatarDataUrl
    if(cur.avatarUrl) return cur.avatarUrl
    return ''
  }
  function updateHeaderAvatar(cur){
    var acct = document.getElementById('account-link')
    if(!acct) return
    var avatar = getHeaderAvatar(cur)
    var oldImg = acct.querySelector('#account-avatar')
    var icon = acct.querySelector('i.fa-user-circle')

    if(avatar){
      if(!oldImg){
        oldImg = document.createElement('img')
        oldImg.id = 'account-avatar'
        oldImg.alt = 'avatar'
        oldImg.className = 'header-avatar me-1'
        acct.insertBefore(oldImg, acct.firstChild)
      }
      oldImg.src = avatar
      if(icon) icon.style.display = 'none'
    } else {
      if(oldImg && oldImg.parentNode) oldImg.parentNode.removeChild(oldImg)
      if(icon) icon.style.display = ''
    }
  }

  function askForPinDialog(title, message){
    return new Promise(function(resolve){
      var old = document.getElementById('pin-verify-backdrop')
      if(old && old.parentNode) old.parentNode.removeChild(old)

      var backdrop = document.createElement('div')
      backdrop.id = 'pin-verify-backdrop'
      backdrop.style.position = 'fixed'
      backdrop.style.inset = '0'
      backdrop.style.background = 'rgba(15,23,42,.5)'
      backdrop.style.zIndex = '100001'
      backdrop.style.display = 'flex'
      backdrop.style.alignItems = 'center'
      backdrop.style.justifyContent = 'center'
      backdrop.style.padding = '16px'

      var card = document.createElement('div')
      card.style.width = 'min(92vw, 460px)'
      card.style.background = '#fff'
      card.style.borderRadius = '14px'
      card.style.padding = '16px'
      card.style.boxShadow = '0 18px 40px rgba(0,0,0,.25)'
      card.innerHTML = '' +
        '<div style="font-size:20px;font-weight:800;color:#1f2937;margin-bottom:8px"></div>' +
        '<div style="color:#475569;margin-bottom:12px"></div>' +
        '<input id="pin-verify-input" type="password" inputmode="numeric" maxlength="6" placeholder="Nhập mã PIN 6 số" style="width:100%;height:42px;border:1px solid #cbd5e1;border-radius:10px;padding:0 12px;outline:none" />' +
        '<div id="pin-verify-error" style="font-size:13px;color:#dc2626;min-height:18px;margin-top:6px"></div>' +
        '<div style="display:flex;justify-content:flex-end;gap:8px;margin-top:8px">' +
        '  <button id="pin-verify-cancel" type="button" style="border:none;background:#e2e8f0;color:#1f2937;border-radius:9px;padding:8px 14px;font-weight:700">Hủy</button>' +
        '  <button id="pin-verify-ok" type="button" style="border:none;background:#0b69a3;color:#fff;border-radius:9px;padding:8px 14px;font-weight:700">Xác nhận</button>' +
        '</div>'

      backdrop.appendChild(card)
      document.body.appendChild(backdrop)

      var titleEl = card.querySelector('div')
      var msgEl = card.querySelectorAll('div')[1]
      var input = card.querySelector('#pin-verify-input')
      var errEl = card.querySelector('#pin-verify-error')
      var cancelBtn = card.querySelector('#pin-verify-cancel')
      var okBtn = card.querySelector('#pin-verify-ok')
      titleEl.textContent = title || 'Xác thực 2 lớp'
      msgEl.textContent = message || 'Vui lòng nhập mã PIN 6 số'

      function done(val){
        try{ backdrop.parentNode && backdrop.parentNode.removeChild(backdrop) }catch(e){}
        resolve(val)
      }

      cancelBtn.addEventListener('click', function(){ done(null) })
      backdrop.addEventListener('click', function(e){ if(e.target === backdrop) done(null) })
      okBtn.addEventListener('click', function(){
        var pin = (input.value || '').trim()
        if(!/^\d{6}$/.test(pin)){
          errEl.textContent = 'Mã PIN phải gồm đúng 6 chữ số'
          return
        }
        done(pin)
      })
      input.addEventListener('keydown', function(e){
        if(e.key === 'Enter') okBtn.click()
      })
      setTimeout(function(){ try{ input.focus() }catch(e){} }, 0)
    })
  }

  function handlePinErrorMessage(msg){
    if(String(msg).toLowerCase().indexOf('pin.required') >= 0){
      notify('Thiếu mã PIN', 'Tài khoản này đã bật xác thực 2 lớp')
      return true
    }
    if(String(msg).toLowerCase().indexOf('pin.invalid') >= 0){
      notify('Mã PIN không đúng', 'Vui lòng kiểm tra lại mã PIN 6 số')
      return true
    }
    return false
  }

  async function doPasswordLogin(u, p, pin){
    const res = await axios.post(AUTH_API + '/login', { username: u, password: p, pin: pin || null })
    const role = res && res.data && res.data.role ? res.data.role : 'user'
    const twoFactorEnabled = !!(res && res.data && res.data.twoFactorEnabled)
    const avatarUrl = res && res.data ? (res.data.avatarUrl || '') : ''
    setCurrent({ username:u, password:p, role:role, authProvider:'password', twoFactorEnabled: twoFactorEnabled, avatarUrl: avatarUrl })
    try{
      const auth = 'Basic ' + btoa(u + ':' + p)
      const me = await axios.get(BACKEND + '/api/me', { headers: { Authorization: auth } })
      if(me && me.data){
        const cur = getCurrent() || {}
        cur.email = me.data.email || cur.email
        cur.addresses = me.data.addresses || cur.addresses || []
        cur.avatarUrl = me.data.avatarUrl || cur.avatarUrl
        setCurrent(cur)
      }
    }catch(err){ }
    success('Đăng nhập thành công', '')
    window.location.href = 'index.html'
  }
  async function confirmLogout(){
    try{
      if(window.showConfirm){
        return await window.showConfirm('Bạn có chắc muốn đăng xuất không?', 'Xác nhận đăng xuất')
      }
    }catch(e){}
    return confirm('Bạn có chắc muốn đăng xuất không?')
  }
  async function performLogout(){
    var ok = await confirmLogout()
    if(!ok) return
    localStorage.removeItem('currentUser')
    updateHeader()
    if(window.showNotification) window.showNotification('Đăng xuất thành công', '', 'success', 1200)
    else alert('Đăng xuất thành công')
    setTimeout(function(){ window.location.href = 'index.html' }, 300)
  }

  // Seed an admin user for demo if no users exist
  try{
    var _users = getUsers();
    if(!_users || _users.length === 0){
      _users = [{username:'admin',password:'admin',role:'admin'}];
      saveUsers(_users);
    }
  }catch(e){}

  // header update & account link behaviour
  function updateHeader(){
    var cur = getCurrent()
    var acctText = document.getElementById('account-text')
    var logoutLink = document.getElementById('logout-link')
    updateHeaderAvatar(cur)
    if(cur && cur.username){
      if(acctText) acctText.textContent = cur.username
      if(logoutLink) logoutLink.classList.add('d-none')
      // ensure account menu hidden by default
      var menu = document.getElementById('account-menu'); if(menu) menu.style.display = 'none';
    } else {
      if(acctText) acctText.textContent = 'Tài khoản'
      if(logoutLink) logoutLink.classList.add('d-none')
      var menu = document.getElementById('account-menu'); if(menu) menu.style.display = 'none';
    }
  }

  var acct = document.getElementById('account-link')
  if(acct){
    acct.addEventListener('click', function(e){
      e.preventDefault()
      var cur = getCurrent()
      var menu = document.getElementById('account-menu')
      if(!cur || !cur.username){
        // not logged in -> go to login
        window.location.href = 'login.html'
        return
      }

      // logged in
      // build a simple dropdown for logged-in users (admin gets manage link)
      if(!menu) return
      if(menu.style.display === 'block'){
        menu.style.display = 'none'
        return
      }

      // populate menu
      menu.innerHTML = ''
      var profile = document.createElement('a'); profile.href = 'profile.html'; profile.className = 'btn-menu'; profile.textContent = 'Trang cá nhân'
      menu.appendChild(profile)
      var orders = document.createElement('a'); orders.href = 'orders.html'; orders.className = 'btn-menu'; orders.textContent = 'Đơn hàng'
      menu.appendChild(orders)
      var settings = document.createElement('a'); settings.href = 'settings.html'; settings.className = 'btn-menu'; settings.textContent = 'Cài đặt'
      menu.appendChild(settings)
      if(cur.role === 'admin'){
        var manage = document.createElement('a'); manage.href = 'admin/manage-product.html'; manage.className = 'btn-menu'; manage.textContent = 'Quản lý hàng hóa'
        menu.appendChild(manage)
        var ordersAdmin = document.createElement('a'); ordersAdmin.href = 'admin/manage-orders.html'; ordersAdmin.className = 'btn-menu'; ordersAdmin.textContent = 'Quản lý hóa đơn'
        menu.appendChild(ordersAdmin)
      }
      var logoutInMenu = document.createElement('a'); logoutInMenu.href = '#'; logoutInMenu.className = 'btn-menu'; logoutInMenu.textContent = 'Đăng xuất'
      logoutInMenu.addEventListener('click', function(ev){
        ev.preventDefault()
        performLogout()
      })
      menu.appendChild(logoutInMenu)

      // position menu just under the account link (relative to #user-area)
      try{
        var acctLink = document.getElementById('account-link')
        // account-menu is inside #user-area which is position:relative
        var top = acctLink.offsetTop + acctLink.offsetHeight + 6
        var left = acctLink.offsetLeft
        menu.style.top = top + 'px'
        menu.style.left = left + 'px'
        menu.style.right = 'auto'
        menu.style.zIndex = '2000'
        // ensure visible
        menu.style.display = 'block'
      }catch(e){
        menu.style.display = 'block'
      }
      return
    })
    // hide menu when clicking outside
    document.addEventListener('click', function(e){
      var menu = document.getElementById('account-menu')
      var acctLink = document.getElementById('account-link')
      if(menu && menu.style.display === 'block'){
        if(!menu.contains(e.target) && !acctLink.contains(e.target)){
          menu.style.display = 'none'
        }
      }
    })
  }

  var logoutLink = document.getElementById('logout-link')
  if(logoutLink){
    logoutLink.addEventListener('click', async function(e){
      e.preventDefault()
      await performLogout()
    })
  }

  // call on load to set header state
  try{updateHeader()}catch(e){}
  window.addEventListener('currentUserChanged', function(){ try{ updateHeader() }catch(e){} })

  // If on login page, attach login handler
  if(document.getElementById('login-form')){
    initGoogleLogin()

    document.getElementById('login-form').addEventListener('submit', async function(e){
      e.preventDefault()
      var form = e.currentTarget
      var submitBtn = form.querySelector('button[type="submit"]')
      var oldBtnHtml = submitBtn ? submitBtn.innerHTML : ''
      var loadingOverlay = null
      var u = document.getElementById('login-username').value.trim()
      var p = document.getElementById('login-password').value
      if(!u || !p){ notify('Đăng nhập thất bại', 'Vui lòng nhập đầy đủ thông tin'); return }

      if(submitBtn){
        submitBtn.disabled = true
        submitBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>Đang đăng nhập...'
      }
      loadingOverlay = createLoadingOverlay('Đang đăng nhập...')

      try{
        var pin = null
        try{
          const statusRes = await axios.post(AUTH_API + '/2fa/status', { username: u })
          const enabled = !!(statusRes && statusRes.data && statusRes.data.enabled)
          if(enabled){
            if(loadingOverlay && loadingOverlay.parentNode) loadingOverlay.parentNode.removeChild(loadingOverlay)
            loadingOverlay = null
            pin = await askForPinDialog('Xác thực 2 lớp', 'Tài khoản đã bật xác thực 2 lớp, vui lòng nhập mã PIN 6 số')
            if(pin == null) return
            loadingOverlay = createLoadingOverlay('Đang đăng nhập...')
          }
        }catch(statusErr){ /* ignore and fall back to API error handling */ }

        await doPasswordLogin(u, p, pin)
      }catch(err){
        const msg = apiMessage(err, 'Thông tin đăng nhập không đúng')
        if(String(msg).toLowerCase().indexOf('account.locked') >= 0){
          notify('Tài khoản đang bị khóa', 'Bạn không thể đăng nhập lúc này')
        } else if(String(msg).toLowerCase().indexOf('pin.required') >= 0 && !pin){
          if(loadingOverlay && loadingOverlay.parentNode) loadingOverlay.parentNode.removeChild(loadingOverlay)
          loadingOverlay = null
          var retryPin = await askForPinDialog('Xác thực 2 lớp', 'Vui lòng nhập mã PIN để hoàn tất đăng nhập')
          if(retryPin == null) return
          loadingOverlay = createLoadingOverlay('Đang đăng nhập...')
          try{
            await doPasswordLogin(u, p, retryPin)
          }catch(err2){
            const msg2 = apiMessage(err2, 'Thông tin đăng nhập không đúng')
            if(!handlePinErrorMessage(msg2)) notify('Đăng nhập thất bại', msg2)
          }
        } else if(handlePinErrorMessage(msg)){
          return
        } else if(isInvalidCredentialsError(err, msg)) {
          notify('Đăng nhập thất bại', 'Sai tài khoản hoặc mật khẩu, vui lòng nhập lại')
        } else {
          notify('Đăng nhập thất bại', msg)
        }
      } finally {
        if(submitBtn){
          submitBtn.disabled = false
          submitBtn.innerHTML = oldBtnHtml || 'Đăng nhập'
        }
        if(loadingOverlay && loadingOverlay.parentNode) loadingOverlay.parentNode.removeChild(loadingOverlay)
      }
    })
  }

  function initGoogleLogin(){
    var googleBtn = document.getElementById('google-login-btn')
    if(!googleBtn) return

    if(!isGoogleClientConfigured()){
      googleBtn.innerHTML = '<div class="small text-muted">Google login chưa được cấu hình</div>'
      return
    }

    if(!window.google || !window.google.accounts || !window.google.accounts.id){
      setTimeout(initGoogleLogin, 300)
      return
    }

    window.google.accounts.id.initialize({
      client_id: GOOGLE_CLIENT_ID,
      callback: onGoogleCredentialResponse,
      auto_select: false
    })

    window.google.accounts.id.renderButton(googleBtn, {
      theme: 'outline',
      size: 'large',
      shape: 'pill',
      text: 'signin_with',
      locale: 'vi'
    })
  }

  async function onGoogleCredentialResponse(response){
    if(!response || !response.credential){
      notify('Đăng nhập Google thất bại', 'Không nhận được token từ Google')
      return
    }

    try{
      const res = await axios.post(AUTH_API + '/google', { credential: response.credential, pin: null })
      const data = res && res.data ? res.data : {}
      const username = data.username || 'google-user'
      const role = data.role || 'user'
      const twoFactorEnabled = !!data.twoFactorEnabled
      const avatarUrl = data.avatarUrl || ''
      setCurrent({ username: username, role: role, authProvider:'google', twoFactorEnabled: twoFactorEnabled, avatarUrl: avatarUrl })
      success('Đăng nhập thành công', 'Google')
      window.location.href = 'index.html'
    }catch(err){
      const msg = apiMessage(err, 'Không thể đăng nhập với Google')
      if(String(msg).toLowerCase().indexOf('pin.required') >= 0){
        var pin = await askForPinDialog('Xác thực 2 lớp', 'Tài khoản đã bật xác thực 2 lớp, vui lòng nhập mã PIN 6 số')
        if(pin == null) return
        try{
          const res2 = await axios.post(AUTH_API + '/google', { credential: response.credential, pin: pin })
          const data2 = res2 && res2.data ? res2.data : {}
          const username2 = data2.username || 'google-user'
          const role2 = data2.role || 'user'
          const twoFactorEnabled2 = !!data2.twoFactorEnabled
          const avatarUrl2 = data2.avatarUrl || ''
          setCurrent({ username: username2, role: role2, authProvider:'google', twoFactorEnabled: twoFactorEnabled2, avatarUrl: avatarUrl2 })
          success('Đăng nhập thành công', 'Google')
          window.location.href = 'index.html'
          return
        }catch(err2){
          const msg2 = apiMessage(err2, 'Không thể đăng nhập với Google')
          if(handlePinErrorMessage(msg2)) return
          notify('Đăng nhập Google thất bại', msg2)
          return
        }
      } else if(String(msg).toLowerCase().indexOf('pin.invalid') >= 0){
        notify('Mã PIN không đúng', 'Vui lòng kiểm tra lại mã PIN 6 số')
      } else {
        notify('Đăng nhập Google thất bại', msg)
      }
    }
  }

  // If on register page, attach register handler
  if(document.getElementById('register-form')){
    document.getElementById('register-form').addEventListener('submit', async function(e){
      e.preventDefault()
      var u = document.getElementById('reg-username').value.trim()
      var p = document.getElementById('reg-password').value
      var emailEl = document.getElementById('reg-email')
      var email = emailEl && emailEl.value ? emailEl.value.trim() : (u ? (u + '@example.com') : '')
      if(!u || !p){ notify('Đăng ký thất bại', 'Vui lòng nhập đầy đủ'); return }
      try{
        await axios.post(AUTH_API + '/register', { username: u, password: p, email: email })
        // keep local mirror for compatibility screens
        try{
          var users = getUsers()
          if(!users.find(x=>x.username===u)) users.push({username:u,password:p,role:'user',email:email,addresses:[]})
          saveUsers(users)
        }catch(er){}
        setCurrent({username:u, password:p, role:'user', email:email, addresses: []})
        success('Đăng ký thành công', '')
        window.location.href = 'index.html'
      }catch(err){
        notify('Đăng ký thất bại', apiMessage(err, 'Không thể tạo tài khoản'))
      }
    })
  }

})();
