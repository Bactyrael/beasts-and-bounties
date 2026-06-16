// B&B Main Application Initialization
document.addEventListener("DOMContentLoaded", async () => {
  if (window.BB_ASSETS) {
     try {
       await window.BB_ASSETS.init();
     } catch (e) {
       console.error("Failed to init assets:", e);
     }
  }

  // Register Routes
  window.BB_ROUTER.register("#/", renderDashboard);
  window.BB_ROUTER.register("#/campaign", () => {
    window.BB_CAMPAIGN.init();
  });
  window.BB_ROUTER.register("#/map-editor", () => {
    window.BB_MAP_EDITOR.init();
  });
  window.BB_ROUTER.register("#/vtt", () => {
    // We expect the map ID to be in the URL hash, e.g. #/vtt?map=123
    // But since our simple router doesn't parse queries well automatically,
    // we can parse it here.
    let hash = window.location.hash;
    let mapId = null;
    if (hash.includes("?map=")) {
      mapId = hash.split("?map=")[1];
    }
    window.BB_VTT.init(mapId);
  });
  window.BB_ROUTER.register("#/builder", () => {
    window.BB_BUILDER.init();
  });
  window.BB_ROUTER.register("#/characters", () => {
    window.BB_CHARACTER_SHEET.init();
  });
  window.BB_ROUTER.register("#/library", () => {
    window.BB_LIBRARY.init();
  });
  window.BB_ROUTER.register("#/compendium", () => {
    window.BB_COMPENDIUM.init();
  });

  // Global search input in the Navbar
  const navSearchBar = document.getElementById("nav-search-input");
  const navSearchBtn = document.getElementById("nav-search-submit");

  if (navSearchBar) {
    navSearchBar.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        const query = navSearchBar.value.trim();
        if (query) {
          window.BB_COMPENDIUM.openGlobalSearch(query);
          navSearchBar.value = ""; // Clear
        }
      }
    });
  }

  if (navSearchBtn && navSearchBar) {
    navSearchBtn.addEventListener("click", () => {
      const query = navSearchBar.value.trim();
      if (query) {
        window.BB_COMPENDIUM.openGlobalSearch(query);
        navSearchBar.value = ""; // Clear
      }
    });
  }

  // Mobile Menu Toggle
  const mobileMenuBtn = document.getElementById("mobile-menu-toggle");
  const navLinks = document.querySelector(".nav-links-list");
  if (mobileMenuBtn && navLinks) {
    mobileMenuBtn.addEventListener("click", () => {
      navLinks.classList.toggle("open");
    });
    
    // Close mobile menu on nav link clicks
    document.querySelectorAll(".nav-link").forEach(link => {
      link.addEventListener("click", () => {
        navLinks.classList.remove("open");
      });
    });
  }

    window.BB_ROUTER.init();
    console.log('Router initialized');
});

// Dashboard View Renderer
function renderDashboard() {
  const container = document.getElementById("main-view-container");
  if (!container) return;

  const characters = window.BB_STATE.getSavedCharacters();
  const books = window.BB_DATABASE.BOOKS;

  // Build character list HTML
  let charCardsHTML = "";
  if (characters.length === 0) {
    charCardsHTML = ``;
  } else {
    characters.forEach(c => {
      charCardsHTML += `
        <div class="dash-char-card glass hover-lift" data-id="${c.id}">
          <div class="dash-char-info">
            <h4>${c.name}</h4>
            <p>Level ${c.level} ${c.class}</p>
          </div>
          <div style="display:flex; gap:8px;">
            <button class="btn btn-secondary btn-sm select-char-dash-btn" data-id="${c.id}">Open Sheet</button>
            <button class="btn btn-danger btn-sm delete-char-dash-btn" data-id="${c.id}" data-name="${c.name}" title="Delete Character" style="padding:4px 8px;">🗑</button>
          </div>
        </div>
      `;
    });
  }

  // Build library preview cards
  let booksHTML = "";
  books.slice(0, 3).forEach(b => {
    booksHTML += `
      <div class="dash-book-preview glass hover-lift" data-id="${b.id}">
        <img src="${b.cover}" alt="${b.title} cover" class="dash-book-img">
        <div class="dash-book-info">
          <h5>${b.title}</h5>
          <p>${b.subtitle}</p>
        </div>
      </div>
    `;
  });

  container.innerHTML = `
    <div class="dashboard-page">
      <!-- Huge Hero Banner -->
      <div class="hero-banner" style="background-image: linear-gradient(rgba(0,0,0,0.3), rgba(18,18,18,0.95)), url('assets/dashboard_banner.png');">
        <div class="hero-content">

          <h1 class="hero-title">Beasts & Bounties</h1>
          <div class="hero-buttons">
            <a href="#/builder" class="btn btn-primary">Forge Hero</a>
            <a href="#/compendium" class="btn btn-secondary">Explore Compendium</a>
          </div>
        </div>
      </div>

      <!-- Dashboard Layout Columns -->
      <div class="dash-columns">
        
        <!-- Left Side: My Characters -->
        <div class="dash-column">
          <div class="dash-column-header">
            <h3>Character List</h3>
            <a href="#/builder" class="btn btn-link btn-sm">Forge New +</a>
          </div>
          <div class="dash-char-list">
            ${charCardsHTML}
          </div>
        </div>

        <!-- Right Side: Library & Compendium Snippet -->
        <div class="dash-column">
          <div class="dash-column-header">
            <h3>Featured Archives</h3>
            <a href="#/library" class="btn btn-link btn-sm">View Library</a>
          </div>
          <div class="dash-books-preview-list">
            ${booksHTML}
          </div>

          <div class="quick-compendium-search glass">
            <h4>Quick Compendium Search</h4>
            <p>Direct lookup for items, spells, and beast species.</p>
            <div class="quick-search-input-wrapper">
              <input type="text" id="dash-quick-search" placeholder="Type a monster, spell, or item..." class="form-control">
              <button class="btn btn-primary" id="btn-dash-quick-search">Search</button>
            </div>
          </div>
        </div>

      </div>
    </div>
  `;

  // Setup event listeners for Dashboard cards
  document.querySelectorAll(".dash-char-card, .select-char-dash-btn").forEach(card => {
    card.addEventListener("click", (e) => {
      if (e.target.closest('.delete-char-dash-btn')) return;
      e.stopPropagation();
      const id = card.getAttribute("data-id");
      window.BB_STATE.setActiveCharacter(id);
      window.location.hash = "#/characters";
    });
  });

  document.querySelectorAll(".delete-char-dash-btn").forEach(btn => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const id = btn.getAttribute("data-id");
      const name = btn.getAttribute("data-name");
      const expected = `delete ${name}`;
      const input = prompt(`Are you sure you want to delete ${name}?\n\nPlease type "${expected}" to confirm:`);
      if (input !== null) {
        if (input.trim().toLowerCase() === expected.toLowerCase()) {
          window.BB_STATE.deleteCharacter(id);
          renderDashboard();
        } else {
          alert("Deletion cancelled: incorrect confirmation.");
        }
      }
    });
  });

  document.querySelectorAll(".dash-book-preview").forEach(card => {
    card.addEventListener("click", () => {
      const id = card.getAttribute("data-id");
      window.location.hash = "#/library";
      // Delay slightly to allow library view to render before opening book reader
      setTimeout(() => {
        window.BB_LIBRARY.openBook(id);
      }, 150);
    });
  });

  // Quick search handler
  const quickSearchInput = document.getElementById("dash-quick-search");
  const quickSearchBtn = document.getElementById("btn-dash-quick-search");
  
  const handleQuickSearch = () => {
    const query = quickSearchInput.value.trim();
    if (query) {
      window.BB_COMPENDIUM.openGlobalSearch(query);
    }
  };

  if (quickSearchInput) {
    quickSearchInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") handleQuickSearch();
    });
  }
  if (quickSearchBtn) {
    quickSearchBtn.addEventListener("click", handleQuickSearch);
  }
}
