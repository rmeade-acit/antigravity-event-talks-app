// App State
let allNotes = [];
const currentFilters = {
    type: 'all',
    searchQuery: '',
    sortOrder: 'newest'
};

// DOM Elements
const statusIndicator = document.getElementById('status-indicator');
const statusText = document.getElementById('status-text');
const btnRefresh = document.getElementById('btn-refresh');
const timelineLoading = document.getElementById('timeline-loading');
const timelineError = document.getElementById('timeline-error');
const timelineEmpty = document.getElementById('timeline-empty');
const notesTimeline = document.getElementById('notes-timeline');
const errorMessage = document.getElementById('error-message');
const btnRetry = document.getElementById('btn-retry');
const searchInput = document.getElementById('search-input');
const searchClearBtn = document.getElementById('search-clear-btn');
const categoryTabs = document.getElementById('category-tabs');
const sortSelect = document.getElementById('sort-select');
const activeFiltersSummary = document.getElementById('active-filters-summary');
const filtersSummaryText = document.getElementById('filters-summary-text');
const btnClearFilters = document.getElementById('btn-clear-filters');
const btnResetFilters = document.getElementById('btn-reset-filters');
const toast = document.getElementById('toast');
const toastMessage = document.getElementById('toast-message');

// Stats Elements
const statTotal = document.getElementById('stat-total');
const statFeatures = document.getElementById('stat-features');
const statAnnouncements = document.getElementById('stat-announcements');
const statIssues = document.getElementById('stat-issues');

// Initialize App
document.addEventListener('DOMContentLoaded', () => {
    fetchReleaseNotes();
    setupEventListeners();
});

// Setup Events
function setupEventListeners() {
    // Refresh button
    btnRefresh.addEventListener('click', () => {
        fetchReleaseNotes(true);
    });

    // Retry button on error
    btnRetry.addEventListener('click', () => {
        fetchReleaseNotes();
    });

    // Search input
    searchInput.addEventListener('input', (e) => {
        currentFilters.searchQuery = e.target.value;
        toggleSearchClearBtn();
        applyFiltersAndRender();
    });

    // Clear search button
    searchClearBtn.addEventListener('click', () => {
        searchInput.value = '';
        currentFilters.searchQuery = '';
        toggleSearchClearBtn();
        applyFiltersAndRender();
        searchInput.focus();
    });

    // Category Tabs
    categoryTabs.addEventListener('click', (e) => {
        const tab = e.target.closest('.tab-btn');
        if (!tab) return;

        // Toggle active states
        document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
        tab.classList.add('active');

        currentFilters.type = tab.dataset.type;
        applyFiltersAndRender();
        updateActiveStatHighlight();
    });

    // Sort Dropdown
    sortSelect.addEventListener('change', (e) => {
        currentFilters.sortOrder = e.target.value;
        applyFiltersAndRender();
    });

    // Clear all filters triggers
    btnClearFilters.addEventListener('click', resetAllFilters);
    btnResetFilters.addEventListener('click', resetAllFilters);

    // Sidebar Stats Card clicks (acting as category filters)
    document.querySelectorAll('.stat-card').forEach(card => {
        card.addEventListener('click', () => {
            const filterType = card.dataset.filter;
            
            // Sync with tabs
            document.querySelectorAll('.tab-btn').forEach(btn => {
                if (btn.dataset.type === filterType) {
                    btn.click();
                }
            });
        });
    });

    // Listen for hash change in URL (deep linking)
    window.addEventListener('hashchange', handleUrlHash);
}

// Toggle Search Clear Button visibility
function toggleSearchClearBtn() {
    if (searchInput.value.length > 0) {
        searchClearBtn.style.display = 'block';
    } else {
        searchClearBtn.style.display = 'none';
    }
}

// Fetch Notes from API
async function fetchReleaseNotes(forceRefresh = false) {
    showLoading(true);
    btnRefresh.disabled = true;
    btnRefresh.classList.add('refreshing');
    
    statusIndicator.className = 'status-indicator loading';
    statusText.textContent = forceRefresh ? 'Refreshing feed...' : 'Fetching release notes...';
    
    let url = '/api/notes';
    if (forceRefresh) {
        url += '?refresh=true';
    }
    
    try {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`Server returned HTTP ${response.status}`);
        }
        
        const data = await response.json();
        
        if (!data.success) {
            throw new Error(data.error || 'Failed to fetch release notes.');
        }
        
        // Parse and process notes
        processNotes(data.entries);
        
        // Update Feed Meta Status
        updateFeedStatus(data);
        
        // Calculate Stats
        calculateAndDisplayStats();
        
        // Apply Filters and Render
        applyFiltersAndRender();
        
        // Handle URL Hash if present (for deep link scrolling)
        setTimeout(handleUrlHash, 300);
        
        if (forceRefresh) {
            showToast("Feed successfully refreshed!");
        }
    } catch (err) {
        console.error('Error fetching release notes:', err);
        statusIndicator.className = 'status-indicator error';
        statusText.textContent = 'Connection failed';
        showError(err.message);
    } finally {
        showLoading(false);
        btnRefresh.disabled = false;
        btnRefresh.classList.remove('refreshing');
    }
}

// Show/Hide loading state
function showLoading(isLoading) {
    if (isLoading) {
        timelineLoading.style.display = 'flex';
        timelineError.style.display = 'none';
        timelineEmpty.style.display = 'none';
        notesTimeline.style.display = 'none';
    } else {
        timelineLoading.style.display = 'none';
    }
}

// Show error panel
function showError(msg) {
    errorMessage.textContent = msg;
    timelineError.style.display = 'flex';
    timelineLoading.style.display = 'none';
    timelineEmpty.style.display = 'none';
    notesTimeline.style.display = 'none';
}

// Update the feed connection metadata block
function updateFeedStatus(data) {
    statusIndicator.className = `status-indicator ${data.source}`;
    
    let sourceLabel = 'Live';
    if (data.source === 'cache') {
        sourceLabel = 'Cached';
    } else if (data.source === 'cache_fallback') {
        sourceLabel = 'Fallback';
    }
    
    // Pretty print timestamp if available
    let updatedText = '';
    if (data.updated) {
        try {
            const date = new Date(data.updated);
            updatedText = ` • Updated: ${date.toLocaleDateString()} ${date.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}`;
        } catch(e) {
            updatedText = ` • Updated: ${data.updated}`;
        }
    }
    
    statusText.textContent = `${sourceLabel} Feed${updatedText}`;
}

// Unpack & Normalize release note feed entries
function processNotes(entries) {
    allNotes = [];
    const parser = new DOMParser();
    
    entries.forEach((entry, entryIndex) => {
        // Parse the HTML content inside the Atom entry
        const doc = parser.parseFromString(entry.content, 'text/html');
        const children = Array.from(doc.body.children);
        
        let itemIndex = 0;
        let currentType = 'General';
        let currentElements = [];
        
        // Process HTML children sequentially and group by <h3> tags
        children.forEach((child) => {
            if (child.tagName === 'H3') {
                // If we have accumulated previous content block, push it
                if (currentElements.length > 0 || currentType !== 'General') {
                    pushProcessedItem(entry, entryIndex, itemIndex++, currentType, currentElements);
                }
                currentType = child.textContent.trim();
                currentElements = [];
            } else {
                currentElements.push(child);
            }
        });
        
        // Push remaining elements
        if (currentElements.length > 0 || itemIndex === 0) {
            pushProcessedItem(entry, entryIndex, itemIndex, currentType, currentElements);
        }
    });
}

// Helper to push a normalized release note item
function pushProcessedItem(entry, entryIndex, itemIndex, type, elements) {
    const contentHtml = elements.map(el => el.outerHTML).join('\n');
    
    // Create a plain text version of the HTML elements for local filtering
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = contentHtml;
    const rawText = tempDiv.textContent || tempDiv.innerText || '';
    
    // Generate clean ID for anchoring
    const cleanDateId = entry.title.toLowerCase().replace(/[^a-z0-9]/g, '_');
    const uniqueId = `${cleanDateId}-${itemIndex}`;
    
    // Parse Date for sorting
    let timestamp = 0;
    try {
        timestamp = Date.parse(entry.title) || 0;
    } catch(e) {
        timestamp = 0;
    }
    
    allNotes.push({
        id: uniqueId,
        date: entry.title,
        timestamp: timestamp,
        type: type,
        contentHtml: contentHtml,
        rawText: rawText,
        link: entry.link
    });
}

// Calculate counts for Overview Stats panel
function calculateAndDisplayStats() {
    const total = allNotes.length;
    let features = 0;
    let announcements = 0;
    let issues = 0;
    
    allNotes.forEach(note => {
        const type = note.type.toLowerCase();
        if (type.includes('feature')) {
            features++;
        } else if (type.includes('announc')) {
            announcements++;
        } else if (type.includes('issue') || type.includes('fix') || type.includes('deprecat')) {
            issues++;
        }
    });
    
    statTotal.textContent = total;
    statFeatures.textContent = features;
    statAnnouncements.textContent = announcements;
    statIssues.textContent = issues;
}

// Update border style of stats card to reflect active filter selection
function updateActiveStatHighlight() {
    document.querySelectorAll('.stat-card').forEach(card => {
        if (card.dataset.filter === currentFilters.type) {
            card.classList.add('active-stat');
        } else {
            card.classList.remove('active-stat');
        }
    });
}

// Apply Search & Tag filters and Render items
function applyFiltersAndRender() {
    let filteredNotes = [...allNotes];
    
    // 1. Filter by Category Type
    if (currentFilters.type !== 'all') {
        const targetType = currentFilters.type.toLowerCase();
        filteredNotes = filteredNotes.filter(note => {
            const noteType = note.type.toLowerCase();
            if (targetType === 'feature') {
                return noteType.includes('feature');
            } else if (targetType === 'announcement') {
                return noteType.includes('announc');
            } else if (targetType === 'issue') {
                return noteType.includes('issue') || noteType.includes('fix') || noteType.includes('deprecat');
            }
            return false;
        });
    }
    
    // 2. Filter by Search Query
    if (currentFilters.searchQuery.trim().length > 0) {
        const query = currentFilters.searchQuery.toLowerCase().trim();
        filteredNotes = filteredNotes.filter(note => {
            return note.rawText.toLowerCase().includes(query) || 
                   note.date.toLowerCase().includes(query) || 
                   note.type.toLowerCase().includes(query);
        });
    }
    
    // 3. Sort Chronologically
    filteredNotes.sort((a, b) => {
        if (currentFilters.sortOrder === 'newest') {
            return b.timestamp - a.timestamp;
        } else {
            return a.timestamp - b.timestamp;
        }
    });
    
    // Render
    renderTimelineItems(filteredNotes);
    
    // Update summary text
    updateFiltersSummary(filteredNotes.length);
}

// Build and render items to the DOM
function renderTimelineItems(notes) {
    if (notes.length === 0) {
        notesTimeline.style.display = 'none';
        timelineEmpty.style.display = 'flex';
        return;
    }
    
    timelineEmpty.style.display = 'none';
    notesTimeline.innerHTML = '';
    
    // Group notes by date
    const groups = {};
    notes.forEach(note => {
        if (!groups[note.date]) {
            groups[note.date] = [];
        }
        groups[note.date].push(note);
    });
    
    // Generate dates list based on sorted notes order (maintaining sort structure)
    const uniqueDates = [];
    notes.forEach(note => {
        if (!uniqueDates.includes(note.date)) {
            uniqueDates.push(note.date);
        }
    });
    
    // Render daily blocks
    uniqueDates.forEach(dateStr => {
        const dayNotes = groups[dateStr];
        
        const dayGroupEl = document.createElement('div');
        dayGroupEl.className = 'timeline-day-group';
        
        // Marker dot
        const marker = document.createElement('div');
        marker.className = 'timeline-day-marker';
        dayGroupEl.appendChild(marker);
        
        // Day Header
        const header = document.createElement('header');
        header.className = 'day-header';
        
        const title = document.createElement('h3');
        title.className = 'day-title';
        title.textContent = dateStr;
        
        // Add relative time tag (e.g. "2 days ago") if parsing succeeds
        const relativeTime = getRelativeTime(dayNotes[0].timestamp);
        if (relativeTime) {
            const timeSpan = document.createElement('span');
            timeSpan.className = 'day-relative-time';
            timeSpan.textContent = relativeTime;
            title.appendChild(timeSpan);
        }
        
        header.appendChild(title);
        dayGroupEl.appendChild(header);
        
        // Render each release note item within this day
        dayNotes.forEach((note, index) => {
            const card = document.createElement('article');
            card.className = 'update-card';
            card.id = note.id;
            // Introduce sequential delay for modern entry transitions
            card.style.animationDelay = `${index * 50}ms`;
            
            // Card Header details
            const cardHeader = document.createElement('div');
            cardHeader.className = 'card-header';
            
            const badge = document.createElement('span');
            badge.className = `badge ${getBadgeClass(note.type)}`;
            badge.textContent = note.type;
            cardHeader.appendChild(badge);
            
            // Actions (Share & Anchor Links)
            const actions = document.createElement('div');
            actions.className = 'card-actions';
            
            // Link back to Google Docs
            if (note.link) {
                const docLink = document.createElement('a');
                docLink.className = 'btn-card-action';
                docLink.href = note.link;
                docLink.target = '_blank';
                docLink.rel = 'noopener noreferrer';
                docLink.title = 'View Official Documentation';
                docLink.ariaLabel = 'View Official Documentation';
                docLink.innerHTML = `
                    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2005/svg">
                        <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6M15 3h6v6M10 14L21 3" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                `;
                actions.appendChild(docLink);
            }
            
            // Share Anchor link
            const shareBtn = document.createElement('button');
            shareBtn.className = 'btn-card-action';
            shareBtn.title = 'Copy Direct Link';
            shareBtn.ariaLabel = 'Copy Direct Link';
            shareBtn.innerHTML = `
                <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2005/svg">
                    <path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                    <path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
            `;
            shareBtn.addEventListener('click', () => {
                copyAnchorLink(note.id);
            });
            actions.appendChild(shareBtn);
            
            cardHeader.appendChild(actions);
            card.appendChild(cardHeader);
            
            // Content
            const content = document.createElement('div');
            content.className = 'card-content';
            content.innerHTML = note.contentHtml;
            card.appendChild(content);
            
            dayGroupEl.appendChild(card);
        });
        
        notesTimeline.appendChild(dayGroupEl);
    });
    
    notesTimeline.style.display = 'flex';
}

// Generate relative time helper
function getRelativeTime(timestamp) {
    if (!timestamp) return null;
    
    const now = new Date();
    const then = new Date(timestamp);
    const diffTime = now - then;
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays < 0) return null; // Future date
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 30) return `${diffDays} days ago`;
    
    const diffMonths = Math.floor(diffDays / 30);
    if (diffMonths === 1) return '1 month ago';
    if (diffMonths < 12) return `${diffMonths} months ago`;
    
    return null; // Don't show relative time for very old updates
}

// Helper to determine CSS class based on entry type
function getBadgeClass(type) {
    const t = type.toLowerCase();
    if (t.includes('feature')) return 'badge-feature';
    if (t.includes('announc')) return 'badge-announcement';
    if (t.includes('issue')) return 'badge-issue';
    if (t.includes('fix')) return 'badge-fix';
    if (t.includes('deprecat')) return 'badge-deprecation';
    return 'badge-general';
}

// Handle copying anchors to clipboard
function copyAnchorLink(noteId) {
    const url = `${window.location.origin}${window.location.pathname}#${noteId}`;
    navigator.clipboard.writeText(url)
        .then(() => {
            showToast("Copied link to clipboard!");
            // Smoothly update location hash without triggering jump immediately (since we have hashchange hook)
            history.pushState(null, null, `#${noteId}`);
            
            // Highlight card locally
            const cardEl = document.getElementById(noteId);
            if (cardEl) {
                cardEl.classList.add('anchor-highlight');
                setTimeout(() => {
                    cardEl.classList.remove('anchor-highlight');
                }, 2000);
            }
        })
        .catch(err => {
            console.error('Could not copy text: ', err);
            showToast("Failed to copy link.");
        });
}

// Highlight and Scroll deep link targets
function handleUrlHash() {
    const hash = window.location.hash;
    if (!hash) return;
    
    const targetId = hash.substring(1);
    const targetItem = allNotes.find(item => item.id === targetId);
    
    if (targetItem) {
        // If filters hide this card, reset filters to show it
        let requiresReset = false;
        
        // Check if query restricts it
        if (currentFilters.searchQuery.trim().length > 0) {
            const query = currentFilters.searchQuery.toLowerCase().trim();
            if (!targetItem.rawText.toLowerCase().includes(query) && !targetItem.date.toLowerCase().includes(query)) {
                searchInput.value = '';
                currentFilters.searchQuery = '';
                toggleSearchClearBtn();
                requiresReset = true;
            }
        }
        
        // Check if category type tab restricts it
        if (currentFilters.type !== 'all') {
            const targetType = currentFilters.type.toLowerCase();
            const noteType = targetItem.type.toLowerCase();
            let matched = false;
            
            if (targetType === 'feature' && noteType.includes('feature')) matched = true;
            else if (targetType === 'announcement' && noteType.includes('announc')) matched = true;
            else if (targetType === 'issue' && (noteType.includes('issue') || noteType.includes('fix') || noteType.includes('deprecat'))) matched = true;
            
            if (!matched) {
                document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
                document.getElementById('tab-all').classList.add('active');
                currentFilters.type = 'all';
                updateActiveStatHighlight();
                requiresReset = true;
            }
        }
        
        if (requiresReset) {
            applyFiltersAndRender();
        }
        
        // Scroll the element into view
        setTimeout(() => {
            const cardEl = document.getElementById(targetId);
            if (cardEl) {
                cardEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
                cardEl.classList.add('anchor-highlight');
                
                showToast("Navigated to selected release note");
                
                setTimeout(() => {
                    cardEl.classList.remove('anchor-highlight');
                }, 4000);
            }
        }, 150);
    }
}

// Reset filters to default state
function resetAllFilters() {
    searchInput.value = '';
    currentFilters.searchQuery = '';
    toggleSearchClearBtn();
    
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    document.getElementById('tab-all').classList.add('active');
    currentFilters.type = 'all';
    updateActiveStatHighlight();
    
    currentFilters.sortOrder = 'newest';
    sortSelect.value = 'newest';
    
    applyFiltersAndRender();
    showToast("Filters reset successfully");
}

// Update Active Filter Summary message
function updateFiltersSummary(filteredCount) {
    const activeSearch = currentFilters.searchQuery.trim().length > 0;
    const activeCategory = currentFilters.type !== 'all';
    
    if (activeSearch || activeCategory) {
        activeFiltersSummary.style.display = 'flex';
        
        let typeLabel = 'notes';
        if (currentFilters.type === 'Feature') typeLabel = 'features';
        if (currentFilters.type === 'Announcement') typeLabel = 'announcements';
        if (currentFilters.type === 'Issue') typeLabel = 'issues';
        
        let msg = `Found ${filteredCount} ${typeLabel}`;
        if (activeSearch) {
            msg += ` matching "${currentFilters.searchQuery}"`;
        }
        
        filtersSummaryText.textContent = msg;
    } else {
        activeFiltersSummary.style.display = 'none';
    }
}

// Toast Controller
function showToast(msg) {
    toastMessage.textContent = msg;
    toast.classList.add('show');
    
    // Clear any previous timers and hide toast
    if (window.toastTimer) {
        clearTimeout(window.toastTimer);
    }
    
    window.toastTimer = setTimeout(() => {
        toast.classList.remove('show');
    }, 3500);
}
