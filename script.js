function searchCocktails() {
  const input = document.getElementById('searchInput');
  if (!input) return;

  const filter = input.value.toLowerCase();
  const cards = document.querySelectorAll('#cocktailGrid .card');

  cards.forEach(card => {
    const name = card.getAttribute('data-name') || '';
    const text = card.innerText.toLowerCase();
    if (name.includes(filter) || text.includes(filter)) {
      card.style.display = 'block';
    } else {
      card.style.display = 'none';
    }
  });
}
