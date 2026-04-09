(function(){
  const images = ['assets/hello1.jpg','assets/hello2.jpg','assets/hello3.jpg']
  let idx = 0
  const imgEl = document.getElementById('header-carousel-img')
  const nextBtn = document.getElementById('header-carousel-next')

  const placeholderSvg = encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="400">'
    + '<rect width="100%" height="100%" fill="%23FFD166"/>'
    + '<text x="50%" y="50%" font-size="36" text-anchor="middle" fill="%23000000" dy=".3em">No image</text>'
    + '</svg>'
  )
  const placeholderData = 'data:image/svg+xml;utf8,' + placeholderSvg

  function show(i){
    if(!imgEl) return
    idx = (i + images.length) % images.length
    imgEl.src = images[idx]
  }
  function next(){ show(idx+1) }

  // handle missing images: advance to next or use placeholder
  if(imgEl){
    imgEl.onerror = function(){
      console.warn('Hero image not found:', imgEl.src)
      // try next image; if cycled through all, show placeholder
      const tried = images.indexOf(imgEl.src.replace(window.location.origin + '/', ''))
      if(tried >= 0 && tried >= images.length - 1){
        imgEl.src = placeholderData
      } else {
        next()
      }
    }
  }

  // also attach fallback for site logo if missing
  const siteLogo = document.getElementById('site-logo')
  if(siteLogo){
    siteLogo.onerror = function(){
      this.onerror = null
      this.src = 'data:image/svg+xml;utf8,' + encodeURIComponent(
        '<svg xmlns="http://www.w3.org/2000/svg" width="160" height="48">'
        + '<rect width="100%" height="100%" fill="%23FF6F3C"/>'
        + '<text x="50%" y="50%" font-size="18" text-anchor="middle" fill="%23ffffff" dy=".3em">myshoes</text>'
        + '</svg>'
      )
    }
  }

  // auto cycle
  let timer = setInterval(next, 4000)
  // click to advance
  if(nextBtn){
    nextBtn.addEventListener('click', function(e){
      e.preventDefault()
      next()
      clearInterval(timer)
      timer = setInterval(next, 4000)
    })
  }

  // init
  show(0)
})();
