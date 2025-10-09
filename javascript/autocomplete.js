/**
 * Generic autocomplete setup function
 * @param {string} targetSelector - CSS selector for the target input/textarea
 * @param {function} fetcher - async function(query) => Promise<string[]>
 */
function setupAutocomplete(targetSelector, fetcher) {
  const input = document.querySelector(targetSelector);
  if (!input) return;

  // Create dropdown container
  const dropdown = document.createElement("ul");
  dropdown.style.position = "absolute";
  dropdown.style.background = "white";
  dropdown.style.border = "1px solid #ccc";
  dropdown.style.listStyle = "none";
  dropdown.style.padding = "0";
  dropdown.style.margin = "0";
  dropdown.style.maxHeight = "150px";
  dropdown.style.overflowY = "auto";
  dropdown.style.zIndex = "1000";
  dropdown.hidden = true;

  // Ensure parent is positioned for absolute dropdown
  input.parentNode.style.position = "relative";
  input.parentNode.appendChild(dropdown);

  const MIN_DROPDOWN_WIDTH = 220;
  const syncDropdownWidth = () => {
    const width = input.getBoundingClientRect().width || input.offsetWidth || MIN_DROPDOWN_WIDTH;
    dropdown.style.minWidth = `${Math.max(width, MIN_DROPDOWN_WIDTH)}px`;
  };
  syncDropdownWidth();
  input.addEventListener("focus", syncDropdownWidth);
  window.addEventListener("resize", syncDropdownWidth);

  let timer = null;
  let selectedIndex = -1;

  // Update dropdown suggestions
  async function updateSuggestions(query) {
    try {
      const results = await fetcher(query);
      dropdown.innerHTML = "";
      selectedIndex = -1;

      if (!results || results.length === 0) {
        dropdown.hidden = true;
        return;
      }

      results.forEach((name, idx) => {
        const li = document.createElement("li");
        li.textContent = name;
        li.style.padding = "4px";
        li.style.cursor = "pointer";

        // Mouse click selection
        li.addEventListener("mousedown", () => {
          input.value = name;
          dropdown.hidden = true;
        });

        dropdown.appendChild(li);
      });

      dropdown.hidden = false;
    } catch (err) {
      console.error("Autocomplete fetch error", err);
    }
  }

  // Input event: fetch suggestions after debounce
  input.addEventListener("input", () => {
    clearTimeout(timer);
    const query = input.value.trim();
    if (!query) {
      dropdown.hidden = true;
      return;
    }
    timer = setTimeout(() => updateSuggestions(query), 300);
  });

  // Keyboard navigation
  input.addEventListener("keydown", (e) => {
    const items = dropdown.querySelectorAll("li");
    if (dropdown.hidden || items.length === 0) return;

    if (e.key === "Tab") {
      // Tab moves down one item
      e.preventDefault();
      selectedIndex = (selectedIndex + 1) % items.length;
      items.forEach((li, idx) => {
        li.style.background = idx === selectedIndex ? "#def" : "white";
      });
      items[selectedIndex].scrollIntoView({ block: "nearest" });

    } else if (e.key === "Enter" || e.key === " ") {
      // Enter or Space applies the selected suggestion
      if (selectedIndex >= 0 && selectedIndex < items.length) {
        e.preventDefault();
        input.value = items[selectedIndex].textContent;
        dropdown.hidden = true;
      }

    } else if (e.key === "ArrowDown") {
      // Move selection down
      e.preventDefault();
      selectedIndex = (selectedIndex + 1) % items.length;
      items.forEach((li, idx) => {
        li.style.background = idx === selectedIndex ? "#def" : "white";
      });
      items[selectedIndex].scrollIntoView({ block: "nearest" });

    } else if (e.key === "ArrowUp") {
      // Move selection up
      e.preventDefault();
      selectedIndex = (selectedIndex - 1 + items.length) % items.length;
      items.forEach((li, idx) => {
        li.style.background = idx === selectedIndex ? "#def" : "white";
      });
      items[selectedIndex].scrollIntoView({ block: "nearest" });

    } else if (e.key === "ArrowLeft") {
      // Jump to the first suggestion
      e.preventDefault();
      selectedIndex = 0;
      items.forEach((li, idx) => {
        li.style.background = idx === selectedIndex ? "#def" : "white";
      });
      items[selectedIndex].scrollIntoView({ block: "nearest" });

    } else if (e.key === "ArrowRight") {
      // Jump to the last suggestion
      e.preventDefault();
      selectedIndex = items.length - 1;
      items.forEach((li, idx) => {
        li.style.background = idx === selectedIndex ? "#def" : "white";
      });
      items[selectedIndex].scrollIntoView({ block: "nearest" });
    }
  });

  // Hide dropdown when input loses focus
  input.addEventListener("blur", () => {
    setTimeout(() => dropdown.hidden = true, 200);
  });
}

/**
 * Fetcher for Civitai API (model names)
 */
async function civitaiFetcher(query) {
  if (!query) return [];
  const res = await fetch(`/civitai_suggest?q=${encodeURIComponent(query)}`);
  const data = await res.json();
  return data.results || [];
}

/**
 * Fetcher for Civitai API (tags)
 */
async function civitaiTagFetcher(query) {
  if (!query) return [];
  const res = await fetch(`/civitai_tag_suggest?q=${encodeURIComponent(query)}`);
  const data = await res.json();
  return data.results || [];
}

// Initialize on WebUI load
onUiLoaded(() => {
  setupAutocomplete("#ch_browser_query textarea", civitaiFetcher);
  setupAutocomplete("#ch_browser_query input", civitaiFetcher);

  setupAutocomplete("#ch_browser_tag textarea", civitaiTagFetcher);
  setupAutocomplete("#ch_browser_tag input", civitaiTagFetcher);

  function initAutoSearch() {
    const btn = document.getElementById("ch_browser_search_btn");
    if (!btn) return;
    const targets = [
      ...document.querySelectorAll("#ch_browser_query textarea"),
      ...document.querySelectorAll("#ch_browser_query input")
    ];
    let timer = null;
    targets.forEach(el => {
      el.addEventListener("input", () => {
        clearTimeout(timer);
        const val = el.value.trim();
        if (val.length === 0) return;
        timer = setTimeout(() => btn.click(), 600);
      });
    });
  }
  initAutoSearch();
 
  function initSidebarToggle(){
    const sidebar = document.getElementById("ch_filter_sidebar");
    const toggleBtn = document.querySelector("#ch_filter_toggle_btn button, #ch_filter_toggle_btn"); // Gradio wrap対策
    const firstFocusable = () => sidebar.querySelector("input,textarea,select,button");
    const backdrop = document.getElementById("ch_filter_backdrop") || (()=>{
      const div=document.createElement("div");div.id="ch_filter_backdrop";document.body.appendChild(div);return div;
    })();
    if(!sidebar || !toggleBtn) return;

    const KEY = "ch_filter_sidebar_open";
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let isMobile = () => window.matchMedia("(max-width: 900px)").matches;

    function applyState(open, skipFocus=false){
      open ? sidebar.classList.remove("closed") : sidebar.classList.add("closed");
      toggleBtn.setAttribute("aria-expanded", String(open));
      if(isMobile()){
        backdrop.classList.toggle("show", open);
        if(open) document.body.style.overflow="hidden"; else document.body.style.overflow="";
      } else {
        backdrop.classList.remove("show");
        document.body.style.overflow="";
      }
      localStorage.setItem(KEY, open ? "1":"0");
      if(open && !skipFocus){
        const f = firstFocusable();
        if(f){ setTimeout(()=> f.focus(), 30); }
      }
      if(!open && !skipFocus){
        setTimeout(()=> toggleBtn.focus(), 30);
      }
    }

    const stored = localStorage.getItem(KEY);
    const initialOpen = stored === null ? true : stored === "1";
    sidebar.classList.add("closed");
    applyState(initialOpen, true);

    toggleBtn.setAttribute("aria-controls", "ch_filter_sidebar");
    toggleBtn.setAttribute("aria-expanded", String(initialOpen));
    toggleBtn.setAttribute("type","button");

    function toggle(){
      const open = !toggleBtn.getAttribute("aria-expanded") || toggleBtn.getAttribute("aria-expanded")==="false";
      applyState(open);
    }

    toggleBtn.addEventListener("click", toggle);
    toggleBtn.addEventListener("keydown", e=>{
      if(e.key==="Enter"||e.key===" "){
        e.preventDefault(); toggle();
      }
    });


    sidebar.addEventListener("keydown", e=>{
      if(e.key==="Escape"){
        if(toggleBtn.getAttribute("aria-expanded")==="true"){
          e.stopPropagation();
          applyState(false);
        }
      }
      if(e.key==="Tab" && isMobile() && toggleBtn.getAttribute("aria-expanded")==="true"){

        const focusables = sidebar.querySelectorAll("a,button,input,textarea,select,[tabindex]:not([tabindex='-1'])");
        if(focusables.length===0) return;
        const first = focusables[0];
        const last = focusables[focusables.length-1];
        if(e.shiftKey && document.activeElement===first){
          e.preventDefault(); last.focus();
        } else if(!e.shiftKey && document.activeElement===last){
          e.preventDefault(); first.focus();
        }
      }
    });

    backdrop.addEventListener("click", ()=>{
      if(toggleBtn.getAttribute("aria-expanded")==="true"){
        applyState(false);
      }
    });

    window.addEventListener("resize", ()=>{
      if(!isMobile()){
        backdrop.classList.remove("show");
        document.body.style.overflow="";
      } else if(toggleBtn.getAttribute("aria-expanded")==="true"){
        backdrop.classList.add("show");
        document.body.style.overflow="hidden";
      }
    });

    if(prefersReducedMotion){
      sidebar.style.transition="none";
      backdrop.style.transition="none";
    }
  }
  initSidebarToggle();
});