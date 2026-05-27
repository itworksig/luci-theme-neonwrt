document.querySelectorAll('.mainmenu a').forEach((link) => {
  link.addEventListener('click', (event) => {
    event.preventDefault();
    document.querySelectorAll('.mainmenu a').forEach((item) => item.classList.remove('active'));
    link.classList.add('active');
  });
});
