document.addEventListener('DOMContentLoaded', ()=>{
    function getHomeUrl(){
        try{
            const p = String(window.location.pathname || '').replace(/\\/g, '/').toLowerCase();
            return p.indexOf('/admin/') >= 0 ? '../index.html' : 'index.html';
        }catch(e){
            return 'index.html';
        }
    }

    const logo = document.getElementById('site-logo');
    if(logo){
        logo.style.cursor = 'pointer';
        logo.addEventListener('click', (e)=>{
            e.preventDefault();
            window.location.href = getHomeUrl();
        });
    }
});
