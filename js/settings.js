(function(){
  const BACKEND = 'https://be-shoesshop.onrender.com'
  const AUTH_API = BACKEND + '/api/auth'

  function notifyError(title, msg){
    if(window.showNotification) window.showNotification(title, msg || '', 'error', 2600)
    else alert(title + (msg ? ('\n' + msg) : ''))
  }

  function notifySuccess(title, msg){
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

  function getCurrent(){
    try{
      return JSON.parse(localStorage.getItem('currentUser') || 'null')
    }catch(e){
      return null
    }
  }

  function isGoogleLogin(cur){
    return !!(cur && cur.authProvider === 'google')
  }

  function isPinValid(pin){
    return /^\d{6}$/.test(pin || '')
  }

  const current = getCurrent()
  if(!current || !current.username){
    window.location.href = 'login.html'
    return
  }

  const form = document.getElementById('change-password-form')
  const disabledAlert = document.getElementById('password-disabled-alert')
  const submitBtn = document.getElementById('change-password-btn')

  const twoFaToggle = document.getElementById('twofa-toggle')
  const twoFaStateText = document.getElementById('twofa-state-text')
  const twoFaForm = document.getElementById('twofa-form')
  const twoFaEnableFields = document.getElementById('twofa-enable-fields')
  const twoFaDisableFields = document.getElementById('twofa-disable-fields')
  const twoFaSaveBtn = document.getElementById('twofa-save-btn')
  const twoFaPin = document.getElementById('twofa-pin')
  const twoFaPinConfirm = document.getElementById('twofa-pin-confirm')
  const twoFaCurrentPin = document.getElementById('twofa-current-pin')
  const navLinks = Array.from(document.querySelectorAll('.settings-nav-link'))
  const sections = {
    'twofa': document.getElementById('settings-section-twofa'),
    'account-security': document.getElementById('settings-section-account-security'),
    'delete-account': document.getElementById('settings-section-delete-account'),
    'support-center': document.getElementById('settings-section-support-center'),
    'dark-mode': document.getElementById('settings-section-dark-mode')
  }
  const requestDeleteBtn = document.getElementById('request-delete-account-btn')
  const deleteAccountNote = document.getElementById('delete-account-note')
  const supportForm = document.getElementById('support-form')
  const supportMessage = document.getElementById('support-message')
  const darkModeToggle = document.getElementById('dark-mode-toggle')
  const darkModeStateText = document.getElementById('dark-mode-state-text')

  var currentTwoFactorEnabled = false

  function showSection(key){
    Object.keys(sections).forEach(function(k){
      if(sections[k]) sections[k].classList.toggle('d-none', k !== key)
    })
    navLinks.forEach(function(link){
      link.classList.toggle('active', link.dataset.target === key)
    })
  }

  navLinks.forEach(function(link){
    link.addEventListener('click', function(e){
      e.preventDefault()
      showSection(link.dataset.target || 'twofa')
    })
  })
  showSection('twofa')

  function applyTheme(isDark){
    document.body.classList.toggle('app-dark', !!isDark)
    if(darkModeToggle) darkModeToggle.checked = !!isDark
    if(darkModeStateText) darkModeStateText.textContent = 'Giao diện hiện tại: ' + (isDark ? 'Tối' : 'Sáng')
  }

  try{
    applyTheme(localStorage.getItem('ui_dark_mode') === '1')
  }catch(e){ applyTheme(false) }

  if(darkModeToggle){
    darkModeToggle.addEventListener('change', function(){
      const isDark = !!darkModeToggle.checked
      localStorage.setItem('ui_dark_mode', isDark ? '1' : '0')
      applyTheme(isDark)
      notifySuccess('Đã cập nhật giao diện', isDark ? 'Đang dùng chế độ tối' : 'Đang dùng chế độ sáng')
    })
  }

  if(requestDeleteBtn){
    requestDeleteBtn.addEventListener('click', async function(){
      let ok = true
      try{
        if(window.showConfirm) ok = await window.showConfirm('Bạn có chắc chắn muốn xóa không? Tài khoản sẽ bị xóa vĩnh viễn.', 'Xác nhận xóa tài khoản')
        else ok = confirm('Bạn có chắc chắn muốn xóa không? Tài khoản sẽ bị xóa vĩnh viễn.')
      }catch(e){ ok = confirm('Bạn có chắc chắn muốn xóa không? Tài khoản sẽ bị xóa vĩnh viễn.') }
      if(!ok) return

      if(!current.password){
        notifyError('Không thể xóa tài khoản', 'Vui lòng đăng nhập bằng tài khoản mật khẩu để thực hiện thao tác này')
        return
      }

      try{
        const auth = 'Basic ' + btoa(current.username + ':' + current.password)
        await axios.delete(BACKEND + '/api/me', { headers: { Authorization: auth } })

        try{
          const users = JSON.parse(localStorage.getItem('users') || '[]')
          const filtered = users.filter(function(u){ return u.username !== current.username })
          localStorage.setItem('users', JSON.stringify(filtered))
        }catch(err){}

        localStorage.removeItem('currentUser')
        localStorage.removeItem('deleteAccountRequest_' + current.username)

        notifySuccess('Xóa tài khoản thành công', 'Bạn sẽ được đăng xuất ngay bây giờ')
        setTimeout(function(){ window.location.href = 'login.html' }, 500)
      }catch(err){
        notifyError('Xóa tài khoản thất bại', apiMessage(err, 'Không thể xóa tài khoản. Vui lòng thử lại'))
      }
    })

    const existingRequest = localStorage.getItem('deleteAccountRequest_' + current.username)
    if(existingRequest && deleteAccountNote){
      deleteAccountNote.textContent = 'Bạn đã gửi yêu cầu lúc: ' + existingRequest
    }
  }

  if(supportForm){
    supportForm.addEventListener('submit', function(e){
      e.preventDefault()
      const message = (supportMessage && supportMessage.value || '').trim()
      if(!message){
        notifyError('Gửi hỗ trợ thất bại', 'Vui lòng nhập nội dung cần hỗ trợ')
        return
      }
      const requests = (function(){
        try{ return JSON.parse(localStorage.getItem('support_requests_v1')||'[]')||[] }catch(err){ return [] }
      })()
      const req = { username: current.username, message: message, createdAt: Date.now() }
      requests.unshift(req)
      localStorage.setItem('support_requests_v1', JSON.stringify(requests))

      try{
        if(window.notifications && typeof window.notifications.add === 'function'){
          const shortMsg = message.length > 140 ? (message.slice(0, 140) + '...') : message
          window.notifications.add({
            title: 'Yêu cầu hỗ trợ mới',
            message: 'Từ ' + (current.username || 'người dùng') + ': ' + shortMsg,
            target: 'admin',
            supportRequest: true,
            requester: current.username || null,
            supportMessage: message
          })
        }
      }catch(err){ console.debug('Cannot push support notification to admin', err) }

      supportForm.reset()
      notifySuccess('Đã gửi yêu cầu hỗ trợ', 'Chúng tôi sẽ phản hồi sớm nhất')
    })
  }

  function setCurrentUserPatch(patch){
    const nextCurrent = Object.assign({}, getCurrent() || {}, patch)
    localStorage.setItem('currentUser', JSON.stringify(nextCurrent))
  }

  function renderTwoFaState(){
    if(!twoFaToggle || !twoFaStateText || !twoFaSaveBtn) return

    const targetEnabled = !!twoFaToggle.checked
    const changed = targetEnabled !== currentTwoFactorEnabled

    twoFaEnableFields.classList.add('d-none')
    twoFaDisableFields.classList.add('d-none')
    twoFaSaveBtn.classList.add('d-none')

    if(!changed){
      twoFaStateText.textContent = currentTwoFactorEnabled ? 'Xác thực 2 lớp đang bật' : 'Xác thực 2 lớp đang tắt'
      return
    }

    if(targetEnabled){
      twoFaStateText.textContent = 'Bạn đang bật xác thực 2 lớp. Vui lòng tạo mã PIN 6 số.'
      twoFaEnableFields.classList.remove('d-none')
      twoFaSaveBtn.classList.remove('d-none')
    } else {
      twoFaStateText.textContent = 'Bạn đang tắt xác thực 2 lớp. Vui lòng nhập mã PIN hiện tại để xác nhận.'
      twoFaDisableFields.classList.remove('d-none')
      twoFaSaveBtn.classList.remove('d-none')
    }
  }

  async function loadTwoFactorStatus(){
    if(!twoFaToggle || !twoFaStateText) return
    try{
      const res = await axios.post(AUTH_API + '/2fa/status', { username: current.username })
      currentTwoFactorEnabled = !!(res && res.data && res.data.enabled)
      twoFaToggle.checked = currentTwoFactorEnabled
      setCurrentUserPatch({ twoFactorEnabled: currentTwoFactorEnabled })
      renderTwoFaState()
    }catch(err){
      twoFaStateText.textContent = 'Không thể tải trạng thái xác thực 2 lớp'
      notifyError('Lỗi tải cài đặt', apiMessage(err, 'Không thể tải trạng thái xác thực 2 lớp'))
    }
  }

  if(twoFaToggle){
    twoFaToggle.addEventListener('change', renderTwoFaState)
  }

  if(twoFaForm){
    twoFaForm.addEventListener('submit', async function(e){
      e.preventDefault()
      const targetEnabled = !!twoFaToggle.checked

      if(targetEnabled === currentTwoFactorEnabled){
        notifySuccess('Không có thay đổi', '')
        return
      }

      if(targetEnabled){
        const pin = (twoFaPin && twoFaPin.value || '').trim()
        const confirmPin = (twoFaPinConfirm && twoFaPinConfirm.value || '').trim()

        if(!isPinValid(pin) || !isPinValid(confirmPin)){
          notifyError('Bật xác thực 2 lớp thất bại', 'Mã PIN phải gồm đúng 6 chữ số')
          return
        }
        if(pin !== confirmPin){
          notifyError('Bật xác thực 2 lớp thất bại', 'Mã PIN nhập lại không khớp')
          return
        }

        try{
          await axios.post(AUTH_API + '/2fa/configure', {
            username: current.username,
            enabled: true,
            pin: pin,
            confirmPin: confirmPin
          })
          currentTwoFactorEnabled = true
          setCurrentUserPatch({ twoFactorEnabled: true })
          if(twoFaPin) twoFaPin.value = ''
          if(twoFaPinConfirm) twoFaPinConfirm.value = ''
          twoFaToggle.checked = true
          renderTwoFaState()
          notifySuccess('Đã bật xác thực 2 lớp', '')
        }catch(err){
          const msg = apiMessage(err, 'Không thể bật xác thực 2 lớp')
          if(String(msg).toLowerCase().indexOf('pin.confirm.mismatch') >= 0){
            notifyError('Bật xác thực 2 lớp thất bại', 'Mã PIN nhập lại không khớp')
          } else if(String(msg).toLowerCase().indexOf('pin.invalid.format') >= 0){
            notifyError('Bật xác thực 2 lớp thất bại', 'Mã PIN phải gồm đúng 6 chữ số')
          } else {
            notifyError('Bật xác thực 2 lớp thất bại', msg)
          }
        }
        return
      }

      const currentPin = (twoFaCurrentPin && twoFaCurrentPin.value || '').trim()
      if(!isPinValid(currentPin)){
        notifyError('Tắt xác thực 2 lớp thất bại', 'Vui lòng nhập đúng mã PIN 6 số hiện tại')
        return
      }

      try{
        await axios.post(AUTH_API + '/2fa/configure', {
          username: current.username,
          enabled: false,
          currentPin: currentPin
        })
        currentTwoFactorEnabled = false
        setCurrentUserPatch({ twoFactorEnabled: false })
        if(twoFaCurrentPin) twoFaCurrentPin.value = ''
        twoFaToggle.checked = false
        renderTwoFaState()
        notifySuccess('Đã tắt xác thực 2 lớp', '')
      }catch(err){
        const msg = apiMessage(err, 'Không thể tắt xác thực 2 lớp')
        if(String(msg).toLowerCase().indexOf('pin.invalid') >= 0){
          notifyError('Tắt xác thực 2 lớp thất bại', 'Mã PIN hiện tại không đúng')
        } else {
          notifyError('Tắt xác thực 2 lớp thất bại', msg)
        }
      }
    })
  }

  if(isGoogleLogin(current)){
    if(disabledAlert) disabledAlert.classList.remove('d-none')
    if(submitBtn) submitBtn.disabled = true
    if(form){
      Array.from(form.querySelectorAll('input')).forEach(function(input){ input.disabled = true })
    }
  } else if(form){
    form.addEventListener('submit', async function(e){
      e.preventDefault()

      const oldPassword = document.getElementById('old-password').value
      const newPassword = document.getElementById('new-password').value
      const confirmPassword = document.getElementById('confirm-password').value

      if(!oldPassword || !newPassword || !confirmPassword){
        notifyError('Đổi mật khẩu thất bại', 'Vui lòng nhập đầy đủ thông tin')
        return
      }
      if(newPassword.length < 6){
        notifyError('Đổi mật khẩu thất bại', 'Mật khẩu mới phải có ít nhất 6 ký tự')
        return
      }
      if(newPassword !== confirmPassword){
        notifyError('Đổi mật khẩu thất bại', 'Mật khẩu xác nhận không khớp')
        return
      }

      try{
        await axios.post(AUTH_API + '/change-password', {
          username: current.username,
          oldPassword: oldPassword,
          newPassword: newPassword
        })

        const nextCurrent = Object.assign({}, current, { password: newPassword })
        localStorage.setItem('currentUser', JSON.stringify(nextCurrent))

        try{
          const users = JSON.parse(localStorage.getItem('users') || '[]')
          const idx = users.findIndex(function(u){ return u.username === current.username })
          if(idx >= 0){
            users[idx].password = newPassword
            localStorage.setItem('users', JSON.stringify(users))
          }
        }catch(err){}

        form.reset()
        notifySuccess('Đổi mật khẩu thành công', '')
      }catch(err){
        const msg = apiMessage(err, 'Không thể đổi mật khẩu')
        if(String(msg).toLowerCase().indexOf('old.password.invalid') >= 0){
          notifyError('Đổi mật khẩu thất bại', 'Mật khẩu cũ không đúng')
        } else if(String(msg).toLowerCase().indexOf('password.change.not.supported.google') >= 0){
          notifyError('Không hỗ trợ', 'Tài khoản đăng nhập bằng Google không đổi mật khẩu ở đây')
        } else if(String(msg).toLowerCase().indexOf('password.same.as.old') >= 0){
          notifyError('Đổi mật khẩu thất bại', 'Mật khẩu mới không được trùng mật khẩu cũ')
        } else {
          notifyError('Đổi mật khẩu thất bại', msg)
        }
      }
    })
  }

  loadTwoFactorStatus()
})();
