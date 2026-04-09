(function(){
  const BACKEND = 'https://be-shoesshop.onrender.com';
  const ORDERS_KEY = 'orders_v1';

  function getAuthHeaders(){
    try{
      const cur = JSON.parse(localStorage.getItem('currentUser')||'null');
      if(cur && cur.username && cur.password){
        return { Authorization: 'Basic ' + btoa(cur.username + ':' + cur.password) };
      }
    }catch(e){}
    return {};
  }

  function readLocalOrders(){
    try{ return JSON.parse(localStorage.getItem(ORDERS_KEY)||'[]') || []; }
    catch(e){ return []; }
  }

  function parseAmount(v){
    if(v == null) return 0;
    if(typeof v === 'number') return v;
    const digits = String(v).replace(/[^0-9]/g,'');
    return digits ? parseInt(digits, 10) : 0;
  }

  function formatVND(v){
    const n = Math.round(v || 0);
    return new Intl.NumberFormat('vi-VN').format(n) + ' đ';
  }

  function toDate(order){
    const raw = order && order.createdAt;
    if(raw == null) return null;
    const d = new Date(Number(raw));
    if(Number.isNaN(d.getTime())) return null;
    return d;
  }

  async function fetchOrders(){
    let list = [];
    try{
      const headers = Object.assign({ 'Content-Type':'application/json' }, getAuthHeaders());
      if(headers.Authorization){
        const resp = await fetch(BACKEND + '/api/orders', { headers });
        if(resp.ok){
          list = await resp.json();
        }
      }
    }catch(e){ /* fallback below */ }

    if(!Array.isArray(list) || list.length === 0){
      list = readLocalOrders();
    }
    return Array.isArray(list) ? list : [];
  }

  function approvedOrders(orders){
    return (orders || []).filter(function(o){
      return String((o && o.status) || '').toLowerCase() === 'approved';
    });
  }

  function calcMonthlyRevenue(orders, year){
    const byMonth = new Array(12).fill(0);
    (orders || []).forEach(function(o){
      const d = toDate(o);
      if(!d || d.getFullYear() !== year) return;
      byMonth[d.getMonth()] += parseAmount(o.total);
    });
    return byMonth;
  }

  function calcCurrentMonthRevenue(orders){
    const now = new Date();
    const y = now.getFullYear();
    const m = now.getMonth();
    let sum = 0;
    (orders || []).forEach(function(o){
      const d = toDate(o);
      if(!d) return;
      if(d.getFullYear() === y && d.getMonth() === m){
        sum += parseAmount(o.total);
      }
    });
    return sum;
  }

  function calcMonthRevenueByDate(orders, year, month){
    let sum = 0;
    (orders || []).forEach(function(o){
      const d = toDate(o);
      if(!d) return;
      if(d.getFullYear() === year && d.getMonth() === month){
        sum += parseAmount(o.total);
      }
    });
    return sum;
  }

  function calcTopProducts(orders){
    const map = new Map();
    (orders || []).forEach(function(o){
      const items = Array.isArray(o.items) ? o.items : [];
      items.forEach(function(it){
        const name = (it && it.name ? String(it.name) : 'Không rõ').trim() || 'Không rõ';
        const qty = Math.max(0, parseInt(it && it.qty != null ? it.qty : 0, 10) || 0);
        const amt = parseAmount(it && it.price) * qty;
        const cur = map.get(name) || { name: name, qty: 0, revenue: 0 };
        cur.qty += qty;
        cur.revenue += amt;
        map.set(name, cur);
      });
    });

    return Array.from(map.values())
      .sort(function(a,b){
        if(b.qty !== a.qty) return b.qty - a.qty;
        return b.revenue - a.revenue;
      })
      .slice(0, 10);
  }

  function renderMonthlyRevenueCard(amount){
    const el = document.getElementById('monthly-revenue-value');
    if(el) el.textContent = formatVND(amount);
  }

  function renderMonthlyDiffCard(diff, current, previous){
    const valueEl = document.getElementById('monthly-diff-value');
    const noteEl = document.getElementById('monthly-diff-note');
    const cardEl = document.getElementById('monthly-diff-card');
    if(!valueEl || !noteEl || !cardEl) return;

    const abs = Math.abs(diff || 0);
    valueEl.textContent = (diff >= 0 ? '+' : '-') + formatVND(abs);

    if(diff > 0){
      valueEl.className = 'h3 mb-0 text-success';
      noteEl.className = 'small mt-1 text-success';
      noteEl.textContent = 'Lãi so với tháng trước';
      cardEl.style.borderLeft = '4px solid #198754';
    }else if(diff < 0){
      valueEl.className = 'h3 mb-0 text-danger';
      noteEl.className = 'small mt-1 text-danger';
      noteEl.textContent = 'Lỗ so với tháng trước';
      cardEl.style.borderLeft = '4px solid #dc3545';
    }else{
      valueEl.className = 'h3 mb-0 text-secondary';
      noteEl.className = 'small mt-1 text-muted';
      noteEl.textContent = 'Không thay đổi so với tháng trước';
      cardEl.style.borderLeft = '4px solid #6c757d';
    }

    const detail = 'Tháng này: ' + formatVND(current) + ' | Tháng trước: ' + formatVND(previous);
    noteEl.title = detail;
  }

  function renderRevenueChart(values, year){
    const chart = document.getElementById('year-revenue-chart');
    if(!chart) return;

    const labels = ['T1','T2','T3','T4','T5','T6','T7','T8','T9','T10','T11','T12'];
    const max = Math.max(1, ...values);

    chart.innerHTML = '';
    chart.className = 'px-2 py-3';
    chart.style.height = '280px';
    chart.style.background = '#fafafa';
    chart.style.border = '1px solid #eee';
    chart.style.borderRadius = '8px';
    chart.style.position = 'relative';

    const width = chart.clientWidth > 0 ? chart.clientWidth : 900;
    const height = 240;
    const leftPad = 18;
    const rightPad = 18;
    const topPad = 14;
    const bottomPad = 42;
    const drawW = width - leftPad - rightPad;
    const drawH = height - topPad - bottomPad;

    const points = values.map(function(v, i){
      const x = leftPad + (drawW * i / (labels.length - 1));
      const y = topPad + drawH - ((v || 0) / max) * drawH;
      return { x: x, y: y, value: v || 0, label: labels[i] };
    });

    const polyline = points.map(function(p){ return p.x + ',' + p.y; }).join(' ');

    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('width', String(width));
    svg.setAttribute('height', String(height));
    svg.setAttribute('viewBox', '0 0 ' + width + ' ' + height);

    const gridColor = '#e9ecef';
    for(let i=0;i<=4;i++){
      const gy = topPad + (drawH * i / 4);
      const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      line.setAttribute('x1', String(leftPad));
      line.setAttribute('x2', String(width - rightPad));
      line.setAttribute('y1', String(gy));
      line.setAttribute('y2', String(gy));
      line.setAttribute('stroke', gridColor);
      line.setAttribute('stroke-width', '1');
      svg.appendChild(line);
    }

    const path = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
    path.setAttribute('fill', 'none');
    path.setAttribute('stroke', '#0b69a3');
    path.setAttribute('stroke-width', '3');
    path.setAttribute('points', polyline);
    svg.appendChild(path);

    points.forEach(function(p){
      const dot = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      dot.setAttribute('cx', String(p.x));
      dot.setAttribute('cy', String(p.y));
      dot.setAttribute('r', '4');
      dot.setAttribute('fill', '#22b8cf');
      dot.setAttribute('stroke', '#0b69a3');
      dot.setAttribute('stroke-width', '2');

      const title = document.createElementNS('http://www.w3.org/2000/svg', 'title');
      title.textContent = p.label + ' ' + year + ': ' + formatVND(p.value);
      dot.appendChild(title);

      svg.appendChild(dot);
    });

    points.forEach(function(p){
      const tx = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      tx.setAttribute('x', String(p.x));
      tx.setAttribute('y', String(height - 14));
      tx.setAttribute('text-anchor', 'middle');
      tx.setAttribute('font-size', '12');
      tx.setAttribute('fill', '#666');
      tx.textContent = p.label;
      svg.appendChild(tx);
    });

    chart.appendChild(svg);
  }

  function renderTop10(list){
    const tbody = document.getElementById('top-products-body');
    if(!tbody) return;
    tbody.innerHTML = '';

    if(!list || list.length === 0){
      tbody.innerHTML = '<tr><td colspan="4" class="text-muted">Chưa có dữ liệu đơn đã duyệt.</td></tr>';
      return;
    }

    list.forEach(function(item, idx){
      const tr = document.createElement('tr');
      tr.innerHTML =
        '<td>#' + (idx + 1) + '</td>' +
        '<td>' + item.name + '</td>' +
        '<td>' + new Intl.NumberFormat('vi-VN').format(item.qty) + '</td>' +
        '<td>' + formatVND(item.revenue) + '</td>';
      tbody.appendChild(tr);
    });
  }

  function markSidebarActive(){
    try{
      var links = document.querySelectorAll('.admin-sidebar a');
      var path = window.location.pathname.replace(/\\/g,'/');
      links.forEach(function(a){
        var href = a.getAttribute('href');
        if(!href) return;
        var linkPath = href.indexOf('http')===0 ? (new URL(href)).pathname : href;
        if(path.endsWith(linkPath) || path.indexOf(linkPath) !== -1){
          a.classList.add('active');
        }
      });
    }catch(e){ console.warn(e); }
  }

  async function renderDashboard(){
    const year = new Date().getFullYear();
    const now = new Date();
    const yearLabel = document.getElementById('revenue-year-label');
    if(yearLabel) yearLabel.textContent = String(year);

    const orders = await fetchOrders();
    const approved = approvedOrders(orders);

    const current = calcCurrentMonthRevenue(approved);
    const prevDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const previous = calcMonthRevenueByDate(approved, prevDate.getFullYear(), prevDate.getMonth());
    renderMonthlyRevenueCard(current);
    renderMonthlyDiffCard(current - previous, current, previous);
    renderRevenueChart(calcMonthlyRevenue(approved, year), year);
    renderTop10(calcTopProducts(approved));
  }

  document.addEventListener('DOMContentLoaded', function(){
    markSidebarActive();
    renderDashboard();
    window.addEventListener('storage', function(e){
      if(e.key === 'ordersUpdatedAt' || e.key === ORDERS_KEY){
        renderDashboard();
      }
    });
  });
})();
