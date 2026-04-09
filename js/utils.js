// Utility helpers for price parsing/formatting and other small globals
(function(){
    function parsePrice(p){
        if(p==null) return 0;
        if(typeof p === 'number') return Math.round(p);
        const digits = String(p).replace(/[^0-9]/g,'');
        return digits ? parseInt(digits,10) : 0;
    }

    function formatVND(v){
        const n = parsePrice(v);
        return new Intl.NumberFormat('vi-VN').format(n) + ' VNĐ';
    }

    function formatNumber(v){
        const n = parsePrice(v);
        return new Intl.NumberFormat('vi-VN').format(n);
    }

    window.parsePrice = parsePrice;
    window.formatVND = formatVND;
    window.formatNumber = formatNumber;
})();
