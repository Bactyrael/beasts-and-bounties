// B&B Client-side Router
window.BB_ROUTER = (() => {
  const routes = {};

  function register(route, renderFn) {
    routes[route] = renderFn;
  }

  function handleRoute() {
    const hash = window.location.hash || "#/";
    console.log('Router handling route', hash);
    
    // Deactivate all nav links first
    document.querySelectorAll(".nav-link").forEach(link => {
      link.classList.remove("active");
      if (link.getAttribute("href") === hash) {
        link.classList.add("active");
      }
    });

    // Close any open modals when navigating
    const searchModal = document.getElementById("search-modal");
    if (searchModal) searchModal.classList.remove("open");

    // Route matching
    let matchedFn = routes[hash];
    
    // Fallback or exact match check
    if (!matchedFn) {
      // If there's a dynamic path like #/characters?id=xxx, extract it
      if (hash.startsWith("#/characters")) {
        matchedFn = routes["#/characters"];
      } else if (hash.startsWith("#/vtt")) {
        matchedFn = routes["#/vtt"];
      } else {
        matchedFn = routes["#/"]; // Fallback to home
        window.location.hash = "#/";
        return;
      }
    }

    if (matchedFn) {
      localStorage.setItem("bb_last_route", hash);
      matchedFn();
    }
  }

  function init() {
    window.addEventListener("hashchange", handleRoute);
    if (!window.location.hash) {
      const savedRoute = localStorage.getItem("bb_last_route");
      if (savedRoute) {
        window.location.hash = savedRoute;
      }
    }
    // Initial load route trigger
    setTimeout(handleRoute, 100);
  }

  return {
    register,
    init,
    navigate: (hash) => {
      window.location.hash = hash;
    }
  };
})();
