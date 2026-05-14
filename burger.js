function toggleNav() {
  const nav = document.getElementById('mainNav');
  const checkbox = document.getElementById('check');
  nav.classList.toggle('open');
  const isOpen = nav.classList.contains('open');
  if (checkbox) checkbox.checked = isOpen;
  document.body.style.overflow = isOpen ? 'hidden' : '';
}

document.addEventListener('DOMContentLoaded', function () {
  const navLinks = document.querySelectorAll('#mainNav a');
  const nav = document.getElementById('mainNav');
  const checkbox = document.getElementById('check');

  navLinks.forEach(function (link) {
    link.addEventListener('click', function () {
      nav.classList.remove('open');
      if (checkbox) checkbox.checked = false;
      document.body.style.overflow = '';
    });
  });

  // Close panel when clicking outside of it
  document.addEventListener('click', function (e) {
    const navbar = document.querySelector('.navbar');
    if (nav.classList.contains('open') && !nav.contains(e.target) && !navbar.contains(e.target)) {
      nav.classList.remove('open');
      if (checkbox) checkbox.checked = false;
      document.body.style.overflow = '';
    }
  });
});
