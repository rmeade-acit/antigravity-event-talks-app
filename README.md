# BigQuery Release Notes Explorer 🚀

A modern, high-fidelity developer dashboard that fetches, parses, and formats the official Google Cloud BigQuery Release Notes RSS/Atom feed. Built with Python Flask on the backend and plain vanilla HTML, CSS, and JavaScript on the frontend.

👉 **View GitHub Repository:** [rmeade-acit/antigravity-event-talks-app](https://github.com/rmeade-acit/antigravity-event-talks-app)

---

## ✨ Key Features

* **Real-time Atom Feed Integration:** Pulls release updates directly from Google's official feed.
* **Granular Entry Splitting:** Atom feed daily entries containing multiple updates are automatically parsed and displayed as separate, filterable cards.
* **10-Minute Cache & Fail-Safe:** Caches notes in memory on the server for 10 minutes to minimize loading times and feed requests. Automatically falls back to stale cache if the feed goes offline.
* **Premium Glassmorphic UI:** A beautiful dark dashboard featuring responsive layout grids, backdrop blurs, glow effects, and smooth layout animations.
* **Advanced Client-Side Filters:**
  * **Dynamic Search:** Filters content by keywords instantly across title dates, tags, and content.
  * **Type Tabs:** Filter release notes by type (Features, Announcements, Issues/Fixes/Deprecations).
  * **Sort Toggle:** Order updates chronologically (Newest First vs. Oldest First).
* **Deep Linking / Sharing:** Share links to specific updates. Loading the app with a specific card hash automatically resets blocking filters, scrolls to the card, and highlights it with a pulse animation.
* **Overview Analytics:** A live counter tracking total updates, features, announcements, and issues, which also filters the timeline when clicked.

---

## 📂 Project Structure

```text
bq-release-notes/
├── app.py                # Flask server (downloads, parses XML, manages cache & endpoints)
├── README.md             # Project documentation (this file)
├── .gitignore            # Git exclusion rules
├── templates/
│   └── index.html        # HTML layout (structured semantic tags & metadata)
└── static/
    ├── css/
    │   └── style.css     # UI design styles, glassmorphic layout, & responsive styling
    └── js/
        └── main.js       # Client side XML parser, active filters state, & share controller
```

---

## ⚙️ Running the Application Locally

### Prerequisites
* Python 3.x
* Flask and Requests packages

### Setup Instructions
1. **Clone the Repository:**
   ```bash
   git clone https://github.com/rmeade-acit/antigravity-event-talks-app.git
   cd antigravity-event-talks-app
   ```

2. **Install Dependencies:**
   Make sure you have Flask and requests installed:
   ```bash
   pip install flask requests
   ```

3. **Run the Server:**
   ```bash
   python app.py
   ```

4. **Launch the Dashboard:**
   Open your browser and navigate to:
   👉 **[http://localhost:5000](http://localhost:5000)**

---

## 🔌 API Endpoints

### Get parsed release notes
* **Endpoint:** `/api/notes`
* **Method:** `GET`
* **Query Parameters:**
  * `refresh=true` (Optional): Force-bypasses the cache to request the live XML feed directly.
* **Success Response Schema:**
  ```json
  {
    "success": true,
    "title": "BigQuery - Release notes",
    "updated": "2026-06-17T00:00:00-07:00",
    "source": "live | cache | cache_fallback",
    "entries": [
      {
        "title": "June 17, 2026",
        "id": "tag:google.com,2016:bigquery-release-notes#June_17_2026",
        "updated": "2026-06-17T00:00:00-07:00",
        "link": "https://docs.cloud.google.com/bigquery/docs/release-notes#June_17_2026",
        "content": "<h3>Feature</h3><p>You can enable autonomous embedding generation...</p>"
      }
    ]
  }
  ```

---

## 📝 License
This project is open-source. BigQuery release notes data is owned by Google Cloud Platform.
