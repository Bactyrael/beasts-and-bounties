// B&B Digital Library Bookshelf & Reader
window.BB_LIBRARY = (() => {
  let activeBook = null;
  let activeChapterIndex = 0;
  let isEditing = false;

  function init() {
    loadCustomBooks();
    render();
  }

  function loadCustomBooks() {
    try {
      const custom = JSON.parse(localStorage.getItem("BB_CUSTOM_BOOKS"));
      if (custom) {
        window.BB_DATABASE.BOOKS.forEach(b => {
          if (custom[b.id]) {
            b.chapters.forEach((chap, idx) => {
              if (custom[b.id][idx]) {
                chap.content = custom[b.id][idx];
              }
            });
          }
        });
      }
    } catch(e) {}
  }

  function saveCustomBooks() {
    try {
      if (!activeBook) return;
      let custom = JSON.parse(localStorage.getItem("BB_CUSTOM_BOOKS")) || {};
      if (!custom[activeBook.id]) custom[activeBook.id] = {};
      custom[activeBook.id][activeChapterIndex] = activeBook.chapters[activeChapterIndex].content;
      localStorage.setItem("BB_CUSTOM_BOOKS", JSON.stringify(custom));
      window.BB_DICE.showToastNotification("Chapter content saved!");
    } catch(e) {}
  }

  function render() {
    const container = document.getElementById("main-view-container");
    if (!container) return;

    const books = window.BB_DATABASE.BOOKS;

    let booksHTML = "";
    books.forEach(book => {
      booksHTML += `
        <div class="book-card-wrapper">
          <div class="book-item glass hover-lift" data-id="${book.id}">
            <div class="book-cover-img-wrapper">
              <img src="${book.cover}" alt="${book.title} Cover" class="book-cover-img">
            </div>
            <div class="book-info">
              <h3 class="book-title">${book.title}</h3>
              <p class="book-subtitle">${book.subtitle}</p>
              <button class="btn btn-secondary btn-sm read-book-btn" data-id="${book.id}">Open Book</button>
            </div>
          </div>
        </div>
      `;
    });

    container.innerHTML = `
      <div class="library-page">
        <div class="page-header">
          <h1>Digital Library</h1>
          <p>Read core manuals, bestiaries, and logs from the Hunter's Archive</p>
        </div>

        <div class="bookshelf-container">
          <div class="bookshelf-wooden-rack">
            ${booksHTML}
          </div>
        </div>

        <!-- E-Reader Modal -->
        <div class="reader-modal-overlay" id="book-reader-modal">
          <div class="reader-modal-content glass">
            <div class="reader-header">
              <div class="reader-book-title-area">
                <span class="reader-mini-tag">READING ARCHIVE</span>
                <h2 id="reader-book-title">Book Title</h2>
              </div>
              <div style="display:flex; gap:10px; align-items:center;">
                <button class="btn btn-primary btn-sm" id="edit-chapter-btn" style="display:none;">Edit Chapter</button>
                <button class="reader-close-btn" id="close-reader-btn">×</button>
              </div>
            </div>
            
            <div class="reader-workspace">
              <!-- Sidebar Table of Contents -->
              <div class="reader-toc-sidebar glass" id="reader-toc">
                <h3>Chapters</h3>
                <ul class="toc-list" id="reader-toc-list">
                  <!-- Dynamic Toc -->
                </ul>
              </div>

              <!-- Main Reading Pages -->
              <div class="reader-page-body glass">
                <div class="reader-content-scroll" id="reader-content-area">
                  <!-- Dynamic Chapter Content -->
                </div>
                <div class="reader-navigation">
                  <button class="btn btn-secondary btn-sm" id="reader-prev-chapter">◀ Previous Chapter</button>
                  <span class="reader-page-indicator" id="reader-page-indicator">Chapter 1 of 4</span>
                  <button class="btn btn-secondary btn-sm" id="reader-next-chapter">Next Chapter ▶</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;

    setupEventListeners();
  }

  function setupEventListeners() {
    // Open book click
    document.querySelectorAll(".book-item, .read-book-btn").forEach(el => {
      el.addEventListener("click", (e) => {
        // Prevent trigger twice if clicking button inside the card
        e.stopPropagation();
        const bookId = el.getAttribute("data-id");
        openBook(bookId);
      });
    });

    const closeBtn = document.getElementById("close-reader-btn");
    if (closeBtn) {
      closeBtn.addEventListener("click", closeReader);
    }

    const prevBtn = document.getElementById("reader-prev-chapter");
    if (prevBtn) {
      prevBtn.addEventListener("click", () => navigateChapter(-1));
    }

    const nextBtn = document.getElementById("reader-next-chapter");
    if (nextBtn) {
      nextBtn.addEventListener("click", () => navigateChapter(1));
    }

    const editBtn = document.getElementById("edit-chapter-btn");
    if (editBtn) {
      editBtn.addEventListener("click", toggleEditMode);
    }
  }

  function toggleEditMode() {
    if (!activeBook || activeChapterIndex < 0) return;
    
    const chapter = activeBook.chapters[activeChapterIndex];
    const contentBody = document.querySelector(".chapter-text-body");
    const editBtn = document.getElementById("edit-chapter-btn");

    if (!isEditing) {
      // Switch to edit mode
      isEditing = true;
      editBtn.textContent = "Save Chapter";
      editBtn.classList.remove("btn-primary");
      editBtn.classList.add("btn-success");
      
      const currentText = chapter.content;
      contentBody.innerHTML = `<textarea id="chapter-edit-textarea" style="width:100%; height:400px; background:rgba(0,0,0,0.5); color:#fff; border:1px solid var(--amber); padding:10px; font-family:monospace; border-radius:4px;">${currentText}</textarea>`;
    } else {
      // Save changes
      const textarea = document.getElementById("chapter-edit-textarea");
      if (textarea) {
        chapter.content = textarea.value;
        saveCustomBooks();
      }
      isEditing = false;
      editBtn.textContent = "Edit Chapter";
      editBtn.classList.remove("btn-success");
      editBtn.classList.add("btn-primary");
      
      // Reload chapter view
      loadChapter(activeChapterIndex);
    }
  }

  function openBook(bookId) {
    const book = window.BB_DATABASE.BOOKS.find(b => b.id === bookId);
    if (!book) return;

    activeBook = book;
    activeChapterIndex = 0;

    const modal = document.getElementById("book-reader-modal");
    if (!modal) return;

    document.getElementById("reader-book-title").textContent = book.title;
    document.getElementById("edit-chapter-btn").style.display = "block";
    
    // Render TOC
    const tocList = document.getElementById("reader-toc-list");
    tocList.innerHTML = "";
    book.chapters.forEach((chap, idx) => {
      const li = document.createElement("li");
      li.className = `toc-item ${idx === 0 ? "active" : ""}`;
      li.textContent = chap.title;
      li.addEventListener("click", () => loadChapter(idx));
      tocList.appendChild(li);
    });

    loadChapter(0);
    modal.classList.add("open");
  }

  function loadChapter(idx) {
    if (!activeBook || idx < 0 || idx >= activeBook.chapters.length) return;
    
    activeChapterIndex = idx;

    // Reset edit mode if active
    isEditing = false;
    const editBtn = document.getElementById("edit-chapter-btn");
    if (editBtn) {
      editBtn.textContent = "Edit Chapter";
      editBtn.classList.remove("btn-success");
      editBtn.classList.add("btn-primary");
    }

    // Update TOC active state
    const items = document.querySelectorAll("#reader-toc-list .toc-item");
    items.forEach((item, itemIdx) => {
      if (itemIdx === idx) item.classList.add("active");
      else item.classList.remove("active");
    });

    const chapter = activeBook.chapters[idx];
    const contentArea = document.getElementById("reader-content-area");
    contentArea.scrollTop = 0;
    
    contentArea.innerHTML = `
      <div class="chapter-content-wrapper">
        <h2 class="chapter-content-title">${chapter.title}</h2>
        <div class="chapter-divider">❖</div>
        <div class="chapter-text-body">${chapter.content}</div>
      </div>
    `;

    // Update controls
    document.getElementById("reader-page-indicator").textContent = `Chapter ${idx + 1} of ${activeBook.chapters.length}`;
    
    const prevBtn = document.getElementById("reader-prev-chapter");
    const nextBtn = document.getElementById("reader-next-chapter");
    
    if (prevBtn) prevBtn.disabled = (idx === 0);
    if (nextBtn) nextBtn.disabled = (idx === activeBook.chapters.length - 1);
  }

  function navigateChapter(dir) {
    // If they are editing and click next, maybe force save?
    if (isEditing) {
      toggleEditMode(); // save before moving
    }
    loadChapter(activeChapterIndex + dir);
  }

  function closeReader() {
    const modal = document.getElementById("book-reader-modal");
    if (modal) {
      modal.classList.remove("open");
    }
    activeBook = null;
    isEditing = false;
  }

  return {
    init,
    openBook
  };
})();
