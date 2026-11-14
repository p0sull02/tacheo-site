/* Reserve and Message Sully forms. They post to Sully's own Google Apps Script ("Tacheo website"), which emails him,
   alerts his phone and logs the reservation in a Google Sheet. Nothing else sees the form.
   Copyright (C) 2026 Phillip M. Sullivan. */
(function () {
  // Paste the web app address from "Tacheo website - set up once.txt" (it ends in /exec).
  var FORM_URL = 'PASTE_WEB_APP_URL_HERE';
  var PRICE = 380;
  var opened = Date.now();

  function $(f, sel) { return f.querySelector(sel); }
  function money(n) { return '$' + n.toLocaleString('en-US'); }

  function qty(f) {
    var r = $(f, 'input[name=qty]:checked');
    if (!r) return 1;
    if (r.value === 'other') return Math.max(3, Math.min(25, parseInt($(f, 'input[name=qtyOther]').value, 10) || 3));
    return parseInt(r.value, 10);
  }

  function update(f) {
    var more = $(f, '.more'), cn = $(f, '.customname'), ph = $(f, '.phone');
    var other = $(f, 'input[name=qty][value=other]');
    if (more) more.hidden = !(other && other.checked);
    var cnBox = $(f, 'input[value="Custom name"]');
    if (cn) cn.hidden = !(cnBox && cnBox.checked);
    var tx = $(f, 'input[name=wantsText]');
    if (ph) ph.hidden = !(tx && tx.checked);
    var t = $(f, '#rtotal');
    if (t) {
      var each = PRICE;
      f.querySelectorAll('input[name=addons]:checked').forEach(function (a) { each += Number(a.dataset.price || 0); });
      t.textContent = money(each * qty(f));
    }
  }

  function gather(f) {
    var d = { kind: f.dataset.kind, page: location.href, filledInSeconds: Math.round((Date.now() - opened) / 1000) };
    ['name', 'email', 'shipTo', 'customName', 'phone', 'notes', 'website'].forEach(function (k) {
      var el = f.querySelector('[name=' + k + ']');
      if (el && !el.closest('[hidden]')) d[k] = el.value.trim();
    });
    if (f.dataset.kind === 'reservation') {
      d.qty = qty(f);
      d.addons = Array.prototype.map.call(f.querySelectorAll('input[name=addons]:checked'), function (a) { return a.value; });
      d.wantsText = !!$(f, 'input[name=wantsText]').checked;
      d.estimate = $(f, '#rtotal').textContent;
    }
    return d;
  }

  function check(f, d) {
    if (!d.name) return 'Please add your name.';
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(d.email || '')) return 'Please check your email address.';
    if (f.dataset.kind === 'message' && !d.notes) return 'Please type your message.';
    if (d.wantsText && (d.phone || '').replace(/\D/g, '').length < 10) return 'Please add your mobile number, or untick "Text me".';
    if (d.addons && d.addons.indexOf('Custom name') >= 0 && !d.customName) return 'Please add the name or club to letter on it.';
    return '';
  }

  function say(f, text, kind) {
    var s = $(f, '.rstatus');
    s.textContent = text;
    s.className = 'rstatus ' + (kind || '');
  }

  function wire(f) {
    if (!f) return;
    f.addEventListener('change', function () { update(f); });
    f.addEventListener('input', function () { update(f); });
    update(f);
    f.addEventListener('submit', function (ev) {
      ev.preventDefault();
      var d = gather(f), problem = check(f, d);
      if (problem) { say(f, problem, 'bad'); return; }
      if (FORM_URL.indexOf('/exec') < 0) { say(f, 'This form isn\'t switched on yet.', 'bad'); return; }
      var btn = $(f, 'button[type=submit]');
      btn.disabled = true;
      say(f, 'Sending…');
      // text/plain keeps this a "simple" request, which Apps Script answers without a CORS preflight.
      fetch(FORM_URL, { method: 'POST', body: JSON.stringify(d) })
        .then(function (r) { return r.json(); })
        .then(function (res) {
          if (!res.ok) throw new Error(res.error || 'not sent');
          f.reset(); update(f);
          say(f, f.dataset.kind === 'reservation'
            ? 'Reserved. A confirmation is on its way to your inbox' + (d.wantsText ? ', and I\'ll text you.' : '.')
            : 'Sent. I\'ll answer by email.', 'ok');
        })
        .catch(function (e) {
          say(f, 'That didn\'t go through (' + (e && e.message || 'network') + '). Please try again in a minute.', 'bad');
        })
        .then(function () { btn.disabled = false; });
    });
  }

  wire(document.getElementById('reserve-form'));
  wire(document.getElementById('message-form'));
})();
