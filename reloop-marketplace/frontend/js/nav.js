function renderNav(activeSearchQuery) {
  const header = document.createElement('header');
  header.className = 'site';
  header.innerHTML = `
    <a class="brand" href="index.html"><span class="tag-hole"></span>ReLoop</a>
    <div class="search-box">
      <input type="search" id="navSearch" placeholder="Search second-hand items…" value="${activeSearchQuery ? activeSearchQuery.replace(/"/g, '&quot;') : ''}">
    </div>
    <nav id="navLinks"></nav>
  `;
  document.body.prepend(header);

  header.querySelector('#navSearch').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      location.href = 'index.html?q=' + encodeURIComponent(e.target.value);
    }
  });

  const navLinks = header.querySelector('#navLinks');
  if (CURRENT_USER) {
    navLinks.innerHTML = `
      <a href="sell.html">Sell an item</a>
      <a href="dashboard.html">Dashboard</a>
      <a href="messages.html">Messages</a>
      ${CURRENT_USER.is_admin ? '<a href="admin.html">Admin</a>' : ''}
      <a href="#" id="logoutLink">Log out (${CURRENT_USER.name.split(' ')[0]})</a>
    `;
    navLinks.querySelector('#logoutLink').addEventListener('click', async (e) => {
      e.preventDefault();
      await apiFetch('/auth/logout', { method: 'POST' });
      location.href = 'index.html';
    });
  } else {
    navLinks.innerHTML = `<a href="login.html">Log in</a> <a href="register.html" class="btn btn-ochre btn-sm">Sign up</a>`;
  }
}

async function initPage(opts = {}) {
  await loadCurrentUser();
  renderNav(opts.searchQuery);
}
